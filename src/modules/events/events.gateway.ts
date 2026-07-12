import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { ClerkTokenService } from '../auth/clerk/clerk-token.service';
import { ClerkProvisioningService } from '../auth/clerk/clerk-provisioning.service';
import type {
  WSClientMessage,
  WSSubscribeRequest,
  WSUnsubscribeRequest,
  WSSubscribedResponse,
  WSUnsubscribedResponse,
  WSEventMessage,
  WSErrorResponse,
  WSPongResponse,
} from './dto/ws-messages.dto';
import { SUBSCRIBABLE_EVENTS, buildRoomName } from './dto/ws-messages.dto';

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

const buildTenantRoomName = (tenantId: string, sessionId: string, event: string): string =>
  `tenant:${tenantId}:${buildRoomName(sessionId, event)}`;

@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict this
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly clerkToken: ClerkTokenService,
    private readonly clerkProvisioning: ClerkProvisioningService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const authHeader = client.handshake.headers.authorization;
    const authFromHandshake = (client.handshake.auth as { token?: string } | undefined)?.token;
    const jwtToken =
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) || authFromHandshake || null;
    const apiKey = (client.handshake.headers['x-api-key'] as string) || (client.handshake.query.apiKey as string);

    let tenantId: string | null = null;

    if (jwtToken) {
      // First try a locally-signed JWT (embed / user tokens); fall back to Clerk.
      try {
        const payload = this.jwtService.verify<{ tenantId: string; sub: string }>(jwtToken);
        tenantId = payload.tenantId;
        (client.data as Record<string, unknown>).userId = payload.sub;
        (client.data as Record<string, unknown>).tenantId = tenantId;
      } catch {
        const claims = await this.clerkToken.verify(jwtToken);
        const resolved = claims ? await this.clerkProvisioning.resolveFromClaims(claims) : null;
        if (!resolved) {
          this.logger.warn(`Client ${client.id} rejected: invalid token`);
          client.emit('message', this.createError('UNAUTHORIZED', 'Invalid token'));
          client.disconnect();
          return;
        }
        tenantId = resolved.tenantId;
        (client.data as Record<string, unknown>).userId = resolved.userId;
        (client.data as Record<string, unknown>).tenantId = tenantId;
      }
    } else if (apiKey) {
      try {
        const validKey = await this.authService.validateApiKey(apiKey);
        tenantId = validKey.tenantId ?? DEFAULT_TENANT_ID;

        (client.data as Record<string, unknown>).apiKey = validKey;
        (client.data as Record<string, unknown>).tenantId = tenantId;
        this.logger.log(`Client connected: ${client.id} (key: ${validKey.name})`);
      } catch (error) {
        this.logger.warn(`Client ${client.id} rejected: Auth error`, {
          error: error instanceof Error ? error.message : String(error),
        });
        client.emit('message', this.createError('UNAUTHORIZED', 'Invalid API key'));
        client.disconnect();
        return;
      }
    } else {
      this.logger.warn(`Client ${client.id} rejected: No credentials`);
      client.emit('message', this.createError('UNAUTHORIZED', 'API key or JWT required'));
      client.disconnect();
      return;
    }

    if (tenantId) {
      void client.join(`tenant:${tenantId}`);
      this.logger.debug(`Client ${client.id} joined tenant room: ${tenantId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(@ConnectedSocket() client: Socket, @MessageBody() message: WSClientMessage) {
    switch (message.type) {
      case 'subscribe':
        return this.handleSubscribe(client, message);
      case 'unsubscribe':
        return this.handleUnsubscribe(client, message);
      case 'ping':
        return this.handlePing(client, message.requestId);
      default:
        return this.createError(
          'INVALID_MESSAGE',
          `Unknown message type`,
          (message as { requestId?: string }).requestId,
        );
    }
  }

  private handleSubscribe(client: Socket, message: WSSubscribeRequest): WSSubscribedResponse | WSErrorResponse {
    const { sessionId, events, requestId } = message;

    // Validate sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return this.createError('INVALID_SESSION', 'sessionId is required', requestId);
    }

    // Validate events
    if (!events || !Array.isArray(events) || events.length === 0) {
      return this.createError('INVALID_EVENTS', 'events array is required', requestId);
    }

    // Validate each event type
    const validEvents = events.filter(
      e => e === '*' || SUBSCRIBABLE_EVENTS.includes(e as (typeof SUBSCRIBABLE_EVENTS)[number]),
    );
    if (validEvents.length === 0) {
      return this.createError(
        'INVALID_EVENTS',
        `No valid events. Valid: ${SUBSCRIBABLE_EVENTS.join(', ')}, *`,
        requestId,
      );
    }

    const tenantId = (client.data as { tenantId?: string }).tenantId;
    if (!tenantId) {
      return this.createError('UNAUTHORIZED', 'Tenant context is required', requestId);
    }

    // Join tenant-scoped rooms for each session/event combination.
    const rooms: string[] = [];
    for (const event of validEvents) {
      const room = buildTenantRoomName(tenantId, sessionId, event);
      void client.join(room);
      rooms.push(room);
    }

    this.logger.debug(`Client ${client.id} subscribed to: ${rooms.join(', ')}`);

    return {
      type: 'subscribed',
      sessionId,
      events: validEvents,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  private handleUnsubscribe(client: Socket, message: WSUnsubscribeRequest): WSUnsubscribedResponse {
    const { sessionId, requestId } = message;

    // Leave all rooms for this session
    const clientRooms = Array.from(client.rooms);
    const tenantId = (client.data as { tenantId?: string }).tenantId;
    const sessionPrefix = tenantId ? `tenant:${tenantId}:session:${sessionId}:` : `session:${sessionId}:`;
    const wildcardPrefix = tenantId ? `tenant:${tenantId}:session:` : 'session:';

    for (const room of clientRooms) {
      if (room.startsWith(sessionPrefix) || (sessionId === '*' && room.startsWith(wildcardPrefix))) {
        void client.leave(room);
      }
    }

    this.logger.debug(`Client ${client.id} unsubscribed from session: ${sessionId}`);

    return {
      type: 'unsubscribed',
      sessionId,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  private handlePing(_client: Socket, requestId?: string): WSPongResponse {
    return {
      type: 'pong',
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  private createError(code: string, message: string, requestId?: string): WSErrorResponse {
    return {
      type: 'error',
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  // ========== Event Emission Methods (room-based) ==========

  /**
   * Emit event to specific rooms based on sessionId and event type
   */
  private emitToRooms(sessionId: string, event: string, data: unknown, tenantId?: string): void {
    const eventMessage: WSEventMessage = {
      type: 'event',
      payload: { event, sessionId, data },
      timestamp: new Date().toISOString(),
    };

    if (tenantId) {
      this.server.to(buildTenantRoomName(tenantId, sessionId, event)).emit('message', eventMessage);
      this.server.to(buildTenantRoomName(tenantId, sessionId, '*')).emit('message', eventMessage);
      this.server.to(buildTenantRoomName(tenantId, '*', event)).emit('message', eventMessage);
      this.server.to(buildTenantRoomName(tenantId, '*', '*')).emit('message', eventMessage);
      return;
    }

    // Emit to specific session + event room
    this.server.to(buildRoomName(sessionId, event)).emit('message', eventMessage);

    // Emit to wildcard rooms
    this.server.to(buildRoomName(sessionId, '*')).emit('message', eventMessage);
    this.server.to(buildRoomName('*', event)).emit('message', eventMessage);
    this.server.to(buildRoomName('*', '*')).emit('message', eventMessage);
  }

  /**
   * Emit session status change
   */
  emitSessionStatus(sessionId: string, status: string, data?: Record<string, unknown>, tenantId?: string) {
    this.emitToRooms(sessionId, 'session.status', { status, ...data }, tenantId);
  }

  /**
   * Emit QR code update for a session
   */
  emitQRCode(sessionId: string, qrCode: string, tenantId?: string) {
    this.emitToRooms(sessionId, 'session.qr', { qrCode }, tenantId);
  }

  /**
   * Emit new message notification
   */
  emitMessage(sessionId: string, message: Record<string, unknown>, tenantId?: string) {
    this.emitToRooms(sessionId, 'message.received', message, tenantId);
  }

  /**
   * Emit message sent notification
   */
  emitMessageSent(sessionId: string, message: Record<string, unknown>, tenantId?: string) {
    this.emitToRooms(sessionId, 'message.sent', message, tenantId);
  }

  /**
   * Emit message acknowledgment
   */
  emitMessageAck(sessionId: string, data: { messageId: string; ack: number; ackName: string }, tenantId?: string) {
    this.emitToRooms(sessionId, 'message.ack', data, tenantId);
  }

  /**
   * Emit webhook delivery status (broadcast to all - no session context)
   */
  emitWebhookStatus(webhookId: string, success: boolean, error?: string) {
    // This one broadcasts to all since webhooks don't have session context in the same way
    this.server.emit('webhook:delivery', {
      webhookId,
      success,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  emitConversationNew(tenantId: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit('conversation.new', data);
  }

  emitConversationUpdated(tenantId: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit('conversation.updated', data);
  }

  emitConversationAssigned(tenantId: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit('conversation.assigned', data);
  }

  emitTenantMessage(tenantId: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit('message.received', data);
  }
}
