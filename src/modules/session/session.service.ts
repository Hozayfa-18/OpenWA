import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Session, SessionStatus } from './entities/session.entity';
import { CreateSessionDto } from './dto';
import { EngineFactory } from '../../engine/engine.factory';
import { IWhatsAppEngine, EngineStatus } from '../../engine/interfaces/whatsapp-engine.interface';
import { createLogger } from '../../common/services/logger.service';
import { EventsGateway } from '../events/events.gateway';
import { WebhookService } from '../webhook/webhook.service';
import { CrmOutboundService } from '../crm/services/crm-outbound.service';
import { HookManager } from '../../core/hooks';
import { Message, MessageDirection, MessageStatus } from '../message/entities/message.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { extractPhoneNumber } from '../conversations/utils/phone';
import { StorageService } from '../../common/storage/storage.service';
import { buildMediaKey, type StoredMedia } from '../../common/storage/media.util';

interface ConversationUpdateData {
  tenantId: string;
  sessionId: string;
  chatId: string;
  messageId: string;
  messageAt: number;
  direction: 'incoming' | 'outgoing';
  from?: string;
  phoneNumber?: string;
  pushName?: string;
}

interface ReconnectState {
  attempts: number;
  timer: NodeJS.Timeout | null;
  maxAttempts: number;
  baseDelay: number;
}

@Injectable()
export class SessionService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = createLogger('SessionService');

  // In-memory map of active engine instances
  private engines: Map<string, IWhatsAppEngine> = new Map();

  // Reconnection state per session
  private reconnectStates: Map<string, ReconnectState> = new Map();

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly engineFactory: EngineFactory,
    private readonly eventsGateway: EventsGateway,
    private readonly webhookService: WebhookService,
    private readonly crmOutboundService: CrmOutboundService,
    private readonly hookManager: HookManager,
    private readonly storageService: StorageService,
  ) {}

  /**
   * On backend startup, reset all active session statuses to disconnected
   * because the engines are not running yet after restart
   */
  async onModuleInit(): Promise<void> {
    const activeStatuses = [
      SessionStatus.READY,
      SessionStatus.INITIALIZING,
      SessionStatus.QR_READY,
      SessionStatus.AUTHENTICATING,
    ];

    const result = await this.sessionRepository.update(
      { status: In(activeStatuses) },
      { status: SessionStatus.DISCONNECTED },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Reset ${result.affected} session(s) to disconnected on startup`, {
        action: 'startup_reset',
        affected: result.affected,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Clean up all engines on shutdown
    for (const [sessionId, engine] of this.engines) {
      this.logger.log(`Destroying engine for session ${sessionId}`, {
        sessionId,
        action: 'shutdown',
      });
      await engine.destroy();
    }
    this.engines.clear();

    // Clear all reconnect timers
    for (const [, state] of this.reconnectStates) {
      if (state.timer) {
        clearTimeout(state.timer);
      }
    }
    this.reconnectStates.clear();
  }

  async create(dto: CreateSessionDto, tenantId: string): Promise<Session> {
    // Check if session with same name exists
    const existing = await this.sessionRepository.findOne({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Session with name '${dto.name}' already exists`);
    }

    const session = this.sessionRepository.create({
      tenantId,
      name: dto.name,
      config: dto.config || {},
      proxyUrl: dto.proxyUrl || null,
      proxyType: dto.proxyType || null,
      status: SessionStatus.CREATED,
    });

    const saved = await this.dataSource.transaction(async manager => {
      return await manager.save(session);
    });
    this.logger.log(`Session created: ${saved.name}`, {
      sessionId: saved.id,
      action: 'create',
    });

    // Execute hook after session created (outside transaction since hooks do external I/O)
    await this.hookManager.execute('session:created', saved, {
      sessionId: saved.id,
      source: 'SessionService',
    });

    return saved;
  }

  async findAll(): Promise<Session[]> {
    return this.sessionRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Tenant-scoped session list. This is the only list method reachable from the
   * public/dashboard API — callers pass the authenticated tenant so one tenant
   * can never enumerate another's sessions.
   */
  async findAllForTenant(tenantId: string): Promise<Session[]> {
    return this.sessionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({ where: { id } });
    if (!session) {
      throw new NotFoundException(`Session with id '${id}' not found`);
    }
    return session;
  }

  async findByName(name: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({ where: { name } });
    if (!session) {
      throw new NotFoundException(`Session with name '${name}' not found`);
    }
    return session;
  }

  async delete(id: string): Promise<void> {
    const session = await this.findOne(id);

    // Cancel any reconnection attempts
    this.cancelReconnect(id);

    // Stop engine and clear auth data so re-use of the same session name starts fresh
    const engine = this.engines.get(id);
    if (engine) {
      await engine.logout(); // logout() deletes the LocalAuth directory; destroy() does not
      this.engines.delete(id);
    } else {
      // No live engine (e.g. container was rebooted) — delete the auth directory directly
      const sessionDataPath = this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
      const sessionDir = path.join(path.resolve(sessionDataPath), `session-${session.name}`);
      try {
        await fs.rm(sessionDir, { recursive: true, force: true });
      } catch (error) {
        this.logger.warn(`Failed to remove auth dir for session ${session.name}`, { error: String(error) });
      }
    }

    // Execute hook BEFORE delete so plugins can access session data
    await this.hookManager.execute(
      'session:deleted',
      {
        id: session.id,
        name: session.name,
        phone: session.phone,
        pushName: session.pushName,
      },
      {
        sessionId: id,
        source: 'SessionService',
      },
    );

    await this.dataSource.transaction(async manager => {
      await manager.remove(session);
    });
    this.logger.log(`Session deleted: ${session.name}`, {
      sessionId: id,
      action: 'delete',
    });
  }

  async start(id: string): Promise<Session> {
    const session = await this.findOne(id);

    if (this.engines.has(id)) {
      throw new BadRequestException('Session is already started');
    }

    // Execute hook before starting
    await this.hookManager.execute(
      'session:starting',
      { sessionId: id },
      {
        sessionId: id,
        source: 'SessionService',
      },
    );

    // Initialize reconnect state
    const config = session.config as {
      maxReconnectAttempts?: number;
      reconnectBaseDelay?: number;
    } | null;
    this.reconnectStates.set(id, {
      attempts: 0,
      timer: null,
      maxAttempts: config?.maxReconnectAttempts ?? 5,
      baseDelay: config?.reconnectBaseDelay ?? 5000,
    });

    await this.initializeEngine(id, session);
    return this.findOne(id);
  }

  private async initializeEngine(id: string, session: Session): Promise<void> {
    this.logger.log(`Initializing engine for session: ${session.name}`, {
      sessionId: id,
      action: 'engine_init',
      proxyEnabled: !!session.proxyUrl,
    });

    const engine = this.engineFactory.create({
      sessionId: session.name,
      proxyUrl: session.proxyUrl || undefined,
      proxyType: session.proxyType || undefined,
    });
    this.engines.set(id, engine);

    await engine.initialize({
      onQRCode: (qr: string): void => {
        this.logger.log('QR code generated', {
          sessionId: id,
          action: 'qr_generated',
        });

        // Execute hook for QR event
        void this.hookManager.execute(
          'session:qr',
          { sessionId: id },
          {
            sessionId: id,
            source: 'Engine',
          },
        );

        void this.updateStatus(id, SessionStatus.QR_READY, session.tenantId);
        // Push the QR to connected dashboards so the modal fills without polling.
        this.eventsGateway.emitQRCode(id, qr, session.tenantId);
      },
      onReady: (phone: string, pushName: string): void => {
        this.logger.log(`Session ready: ${phone}`, {
          sessionId: id,
          phone,
          pushName,
          action: 'ready',
        });

        // Execute hook for ready event
        void this.hookManager.execute(
          'session:ready',
          { phone, pushName },
          {
            sessionId: id,
            source: 'Engine',
          },
        );

        // Reset reconnect attempts on successful connection
        const reconnectState = this.reconnectStates.get(id);
        if (reconnectState) {
          reconnectState.attempts = 0;
        }

        void this.sessionRepository.update(id, {
          status: SessionStatus.READY,
          phone,
          pushName,
          connectedAt: new Date(),
          lastActiveAt: new Date(),
        });
      },
      onMessage: (message): void => {
        this.logger.debug(`Message received from ${message.from}`, {
          sessionId: id,
          messageId: message.id,
          from: message.from,
          action: 'message_received',
        });
        // Update last active timestamp
        void this.sessionRepository.update(id, { lastActiveAt: new Date() });
        // Convert IncomingMessage to plain object for dispatch
        const messageData = { ...message };

        // Execute hook for message received - plugins can modify or stop processing
        void this.hookManager
          .execute('message:received', messageData, {
            sessionId: id,
            source: 'Engine',
          })
          .then(async ({ continue: shouldContinue, data: finalMessage }) => {
            if (!shouldContinue) {
              // Plugin stopped processing (e.g., auto-reply handled it)
              return;
            }

            const msg = finalMessage as {
              chatId?: string;
              direction?: MessageDirection;
              fromMe?: boolean;
              id?: string;
              timestamp?: number;
              body?: string;
              from?: string;
              to?: string;
              type?: string;
              phoneNumber?: string;
              pushName?: string;
              media?: { mimetype: string; filename?: string; data?: string };
            };
            const direction =
              msg.direction === MessageDirection.OUTGOING || msg.fromMe
                ? MessageDirection.OUTGOING
                : MessageDirection.INCOMING;

            if (msg.chatId) {
              // Messages sent from this app are already persisted by MessageService,
              // then echoed back by the engine's 'message_create' event. Dedup so the
              // echo updates the existing row instead of inserting a duplicate.
              //
              // 1. Match by WhatsApp message id (the echo arrived after MessageService
              //    stamped the id onto its row).
              let existing = msg.id
                ? await this.messageRepository.findOne({ where: { sessionId: id, waMessageId: msg.id } })
                : null;

              // 2. Fallback: the echo can arrive before MessageService stamps the id
              //    (row still null), OR the echo's id may differ from the one the API
              //    returned. Either way, claim the most recent matching outgoing row
              //    (same chat + type + body) rather than inserting a duplicate. Type
              //    must match too: media echoes carry an empty body, so without it a
              //    sticker/image echo would wrongly claim an unrelated empty-body row
              //    (e.g. a previously sent image) and be swallowed instead of stored.
              if (!existing && direction === MessageDirection.OUTGOING) {
                existing = await this.messageRepository.findOne({
                  where: {
                    sessionId: id,
                    chatId: msg.chatId,
                    direction: MessageDirection.OUTGOING,
                    type: msg.type ?? 'text',
                    body: msg.body ?? '',
                  },
                  order: { createdAt: 'DESC' },
                });
              }

              if (existing) {
                existing.waMessageId = msg.id ?? existing.waMessageId;
                existing.status = MessageStatus.DELIVERED;
                existing.timestamp = msg.timestamp ?? existing.timestamp;
                await this.messageRepository.save(existing);
              } else {
                // Persist any attached media (voice notes, images, documents) to
                // storage and keep a lightweight reference on the row's metadata.
                const storedMedia = await this.persistMessageMedia(id, msg.id, msg.media);
                await this.messageRepository.save(
                  this.messageRepository.create({
                    tenantId: session.tenantId,
                    sessionId: id,
                    waMessageId: msg.id,
                    chatId: msg.chatId,
                    from: msg.from ?? msg.chatId,
                    to: msg.to ?? session.phone ?? 'me',
                    body: msg.body,
                    type: msg.type ?? 'text',
                    direction,
                    timestamp: msg.timestamp,
                    status: MessageStatus.DELIVERED,
                    metadata: storedMedia ? { media: storedMedia } : undefined,
                  }),
                );
              }
            }

            if (session.tenantId && msg.chatId) {
              const jobData: ConversationUpdateData = {
                tenantId: session.tenantId,
                sessionId: id,
                chatId: msg.chatId,
                messageId: msg.id ?? '',
                messageAt: msg.timestamp ?? Math.floor(Date.now() / 1000),
                direction: direction === MessageDirection.OUTGOING ? 'outgoing' : 'incoming',
                from: msg.from ?? msg.chatId,
                phoneNumber: msg.phoneNumber,
                pushName: msg.pushName,
              };

              await this.applyConversationUpdate(jobData);
            }

            // Notify external and socket consumers only after local persistence is durable.
            // `message.received` is the legacy/internal real-time event; `message.inbound`
            // (with the createContact lead hint) is the canonical public webhook for
            // incoming customer messages (ADR-005).
            void this.webhookService.dispatch(id, 'message.received', finalMessage);
            this.eventsGateway.emitMessage(id, finalMessage, session.tenantId);

            if (direction === MessageDirection.INCOMING && session.tenantId && msg.chatId) {
              void this.crmOutboundService
                .notifyMessageInbound({
                  sessionId: id,
                  tenantId: session.tenantId,
                  chatType: 'whatsapp',
                  chatId: msg.chatId,
                  messageId: msg.id ?? '',
                  body: msg.body ?? '',
                  timestamp: msg.timestamp ?? Math.floor(Date.now() / 1000),
                })
                .catch((error: unknown) => {
                  this.logger.error(
                    'Failed to dispatch message.inbound webhook',
                    error instanceof Error ? error.message : String(error),
                    { sessionId: id, action: 'crm_inbound_error' },
                  );
                });
            }
          })
          .catch((error: unknown) => {
            this.logger.error(
              'Failed to process incoming message',
              error instanceof Error ? error.message : String(error),
              {
                sessionId: id,
                action: 'message_received_error',
              },
            );
          });
      },
      onDisconnected: (reason: string): void => {
        this.logger.warn(`Session disconnected: ${reason}`, {
          sessionId: id,
          reason,
          action: 'disconnected',
        });

        // Execute hook for disconnected event
        void this.hookManager.execute(
          'session:disconnected',
          { reason },
          {
            sessionId: id,
            source: 'Engine',
          },
        );

        void this.updateStatus(id, SessionStatus.DISCONNECTED, session.tenantId);

        // Attempt to reconnect
        this.scheduleReconnect(id, session);
      },
      onStateChanged: (engineState: EngineStatus): void => {
        const statusMap: Record<EngineStatus, SessionStatus> = {
          [EngineStatus.DISCONNECTED]: SessionStatus.DISCONNECTED,
          [EngineStatus.INITIALIZING]: SessionStatus.INITIALIZING,
          [EngineStatus.QR_READY]: SessionStatus.QR_READY,
          [EngineStatus.AUTHENTICATING]: SessionStatus.AUTHENTICATING,
          [EngineStatus.READY]: SessionStatus.READY,
          [EngineStatus.FAILED]: SessionStatus.FAILED,
        };
        const newStatus = statusMap[engineState];
        if (newStatus) {
          void this.updateStatus(id, newStatus, session.tenantId);
        }
      },
    });

    await this.updateStatus(id, SessionStatus.INITIALIZING, session.tenantId);
  }

  private scheduleReconnect(id: string, session: Session): void {
    const state = this.reconnectStates.get(id);
    if (!state) return;

    if (state.attempts >= state.maxAttempts) {
      this.logger.error(`Max reconnect attempts reached for session: ${session.name}`, undefined, {
        sessionId: id,
        attempts: state.attempts,
        action: 'reconnect_failed',
      });
      return;
    }

    // Exponential backoff: baseDelay * 2^attempts (with jitter)
    const delay = state.baseDelay * Math.pow(2, state.attempts) + Math.random() * 1000;
    state.attempts++;

    this.logger.log(
      `Scheduling reconnect attempt ${state.attempts}/${state.maxAttempts} in ${Math.round(delay / 1000)}s`,
      {
        sessionId: id,
        attempt: state.attempts,
        delayMs: delay,
        action: 'reconnect_scheduled',
      },
    );

    state.timer = setTimeout(() => {
      void this.executeReconnect(id, session, state);
    }, delay);
  }

  private async executeReconnect(id: string, session: Session, state: ReconnectState): Promise<void> {
    try {
      // Clean up old engine
      const oldEngine = this.engines.get(id);
      if (oldEngine) {
        await oldEngine.destroy();
        this.engines.delete(id);
      }

      // Re-initialize
      await this.initializeEngine(id, session);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Reconnect attempt ${state.attempts} failed`, errorMessage, {
        sessionId: id,
        action: 'reconnect_error',
      });
      // Schedule another attempt
      this.scheduleReconnect(id, session);
    }
  }

  private cancelReconnect(id: string): void {
    const state = this.reconnectStates.get(id);
    if (state?.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    this.reconnectStates.delete(id);
  }

  async stop(id: string): Promise<Session> {
    const session = await this.findOne(id);

    // Cancel any reconnection attempts
    this.cancelReconnect(id);

    const engine = this.engines.get(id);

    if (engine) {
      await engine.disconnect();
      this.engines.delete(id);
    }

    this.logger.log(`Session stopped: ${session.name}`, {
      sessionId: id,
      action: 'stop',
    });
    await this.updateStatus(id, SessionStatus.DISCONNECTED, session.tenantId);
    return this.findOne(id);
  }

  async getQRCode(id: string): Promise<{ qrCode: string; status: SessionStatus }> {
    const session = await this.findOne(id);
    const engine = this.engines.get(id);

    if (!engine) {
      throw new BadRequestException('Session is not started. Call POST /sessions/:id/start first.');
    }

    const qrCode = engine.getQRCode();

    if (!qrCode) {
      if (session.status === SessionStatus.READY) {
        throw new BadRequestException('Session is already authenticated, no QR code needed');
      }
      throw new BadRequestException('QR code is not ready yet. Please wait...');
    }

    return {
      qrCode,
      status: session.status,
    };
  }

  getEngine(id: string): IWhatsAppEngine | undefined {
    return this.engines.get(id);
  }

  async getGroups(id: string): Promise<{ id: string; name: string }[]> {
    await this.findOne(id); // Verify session exists
    const engine = this.engines.get(id);

    if (!engine) {
      throw new BadRequestException('Session is not started');
    }

    const groups = await engine.getGroups();
    return groups.map(g => ({
      id: g.id,
      name: g.name,
    }));
  }

  private async updateStatus(id: string, status: SessionStatus, tenantId?: string): Promise<void> {
    await this.sessionRepository.update(id, { status });
    this.logger.debug(`Session status updated to ${status}`, {
      sessionId: id,
      status,
      action: 'status_update',
    });
    // Emit real-time event to connected WebSocket clients
    this.eventsGateway.emitSessionStatus(id, status, undefined, tenantId);
  }

  // Upload inbound message media to storage, returning a metadata reference, or
  // undefined when there is no media or persistence fails (never throws — a
  // failed upload must not drop the message row itself).
  private async persistMessageMedia(
    sessionId: string,
    messageId: string | undefined,
    media: { mimetype: string; filename?: string; data?: string } | undefined,
  ): Promise<StoredMedia | undefined> {
    if (!media?.data || !messageId) return undefined;
    try {
      const key = buildMediaKey(sessionId, messageId, media.mimetype, media.filename);
      await this.storageService.putFile(key, Buffer.from(media.data, 'base64'));
      return { key, mimetype: media.mimetype, filename: media.filename };
    } catch (error) {
      this.logger.error('Failed to persist message media', error instanceof Error ? error.message : String(error), {
        sessionId,
        action: 'media_persist_error',
      });
      return undefined;
    }
  }

  private async applyConversationUpdate(data: ConversationUpdateData): Promise<void> {
    const lastMessageAt = new Date(data.messageAt * 1000);
    // The conversation counterpart is always the chat (recipient for outgoing,
    // sender for incoming) — never `from`, which for outgoing messages is our own
    // session number and would mislabel the conversation with our number.
    const phoneNumber =
      (data.phoneNumber ? extractPhoneNumber(data.phoneNumber) : null) ?? extractPhoneNumber(data.chatId);

    try {
      await this.conversationRepository.insert({
        tenantId: data.tenantId,
        sessionId: data.sessionId,
        chatId: data.chatId,
        contactId: null,
        assignedUserId: null,
        phoneNumber,
        contactName: data.pushName ?? null,
        lastMessageId: data.messageId,
        lastMessageAt,
        unreadCount: data.direction === 'incoming' ? 1 : 0,
      });
      this.eventsGateway.emitConversationNew(data.tenantId, {
        tenantId: data.tenantId,
        sessionId: data.sessionId,
        chatId: data.chatId,
      });
      return;
    } catch {
      await this.conversationRepository
        .createQueryBuilder()
        .update(Conversation)
        .set({
          lastMessageId: () =>
            `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageId ELSE "lastMessageId" END`,
          lastMessageAt: () =>
            `CASE WHEN "lastMessageAt" <= :lastMessageAt THEN :lastMessageAt ELSE "lastMessageAt" END`,
          unreadCount: () => (data.direction === 'incoming' ? '"unreadCount" + 1' : '"unreadCount"'),
          contactName: () => `COALESCE("contactName", :pushName)`,
          // Safety net: backfill the number if an earlier row was created without one.
          phoneNumber: () => `COALESCE("phoneNumber", :phoneNumber)`,
        })
        .where({
          tenantId: data.tenantId,
          sessionId: data.sessionId,
          chatId: data.chatId,
        })
        .setParameters({
          lastMessageId: data.messageId,
          lastMessageAt,
          pushName: data.pushName ?? null,
          phoneNumber,
        })
        .execute();
      this.eventsGateway.emitConversationUpdated(data.tenantId, {
        tenantId: data.tenantId,
        sessionId: data.sessionId,
        chatId: data.chatId,
      });
    }
  }

  /**
   * Get overall session statistics for multi-session monitoring
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    active: number;
    ready: number;
    disconnected: number;
    byStatus: Record<string, number>;
    memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
  }> {
    const sessions = await this.findAllForTenant(tenantId);
    const byStatus: Record<string, number> = {};

    for (const session of sessions) {
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;
    }

    // Active count is scoped to this tenant's own sessions, not the global
    // engine map (which spans every tenant).
    const active = sessions.filter(s => this.engines.has(s.id)).length;
    const memory = process.memoryUsage();

    return {
      total: sessions.length,
      active,
      ready: byStatus[SessionStatus.READY] || 0,
      disconnected: byStatus[SessionStatus.DISCONNECTED] || 0,
      byStatus,
      memoryUsage: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        rss: Math.round(memory.rss / 1024 / 1024),
      },
    };
  }

  /**
   * Get count of currently active (running) sessions
   */
  getActiveCount(): number {
    return this.engines.size;
  }

  /**
   * Check if session is currently active (engine running)
   */
  isActive(id: string): boolean {
    return this.engines.has(id);
  }
}
