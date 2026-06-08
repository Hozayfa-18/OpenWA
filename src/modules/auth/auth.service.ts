import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { ApiKey, ApiKeyRole } from './entities/api-key.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { ApiKeyEncryptionService } from './services/api-key-encryption.service';
import { createLogger } from '../../common/services/logger.service';

const API_KEY_FILE = join(process.cwd(), 'data', '.api-key');

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = createLogger('AuthService');

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly encryption: ApiKeyEncryptionService,
  ) {}

  /** Build the encrypted-at-rest fields for a freshly generated raw key. */
  private encryptRawKey(rawKey: string): Pick<
    ApiKey,
    'keyCiphertext' | 'keyIv' | 'keyAuthTag' | 'keyEncVersion'
  > {
    const enc = this.encryption.encrypt(rawKey);
    return {
      keyCiphertext: enc.ciphertext,
      keyIv: enc.iv,
      keyAuthTag: enc.authTag,
      keyEncVersion: enc.encVersion,
    };
  }

  async onModuleInit(): Promise<void> {
    // Seed a default API key if none exist
    const count = await this.apiKeyRepository.count();
    let displayKey: string;
    let isNewKey = false;

    if (count === 0) {
      // Use predictable key in development, random key in production
      displayKey =
        process.env.NODE_ENV === 'production' ? `owa_k1_${randomBytes(32).toString('hex')}` : 'dev-admin-key';

      await this.seedApiKey(displayKey, 'Default Admin Key', ApiKeyRole.ADMIN);
      isNewKey = true;

      // Save raw key to file for startup script to read
      try {
        writeFileSync(API_KEY_FILE, displayKey, 'utf-8');
      } catch (err) {
        this.logger.warn('Could not save API key file', { error: String(err) });
      }
    } else {
      // Read saved API key from file if exists
      if (existsSync(API_KEY_FILE)) {
        try {
          displayKey = readFileSync(API_KEY_FILE, 'utf-8').trim();
        } catch (error) {
          this.logger.warn(`Failed to read API key file: ${API_KEY_FILE}`, { error: String(error) });
          displayKey = '(check dashboard for keys)';
        }
      } else {
        displayKey = '(check dashboard for keys)';
      }
    }

    // Always show the welcome banner on startup
    const apiBaseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 2785}`;
    const dashboardUrl = process.env.DASHBOARD_URL || `http://localhost:${process.env.DASHBOARD_PORT || 2886}`;

    this.logger.log('');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('');
    this.logger.log('  🟢 Welcome to OpenWA - WhatsApp API Gateway');
    this.logger.log('');
    this.logger.log(`  📊 Dashboard: ${dashboardUrl}`);
    this.logger.log(`  📚 API Docs:  ${apiBaseUrl}/api/docs`);
    this.logger.log('');
    if (isNewKey) {
      this.logger.log('  🔑 API Key (newly created):');
    } else {
      this.logger.log('  🔑 API Key:');
    }
    this.logger.log(`     ${displayKey}`);
    this.logger.log('');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('');
  }

  private async seedApiKey(rawKey: string, name: string, role: ApiKeyRole): Promise<ApiKey> {
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const apiKey = this.apiKeyRepository.create({
      name,
      keyHash,
      keyPrefix,
      role,
      ...this.encryptRawKey(rawKey),
    });

    return this.apiKeyRepository.save(apiKey);
  }

  async createApiKey(dto: CreateApiKeyDto): Promise<{ apiKey: ApiKey; rawKey: string }> {
    // Generate secure random key: owa_k1_<32 bytes hex>
    const rawKey = `owa_k1_${randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const apiKey = this.apiKeyRepository.create({
      name: dto.name,
      keyHash,
      keyPrefix,
      role: dto.role || ApiKeyRole.OPERATOR,
      allowedIps: dto.allowedIps || null,
      allowedSessions: dto.allowedSessions || null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      ...this.encryptRawKey(rawKey),
    });

    const saved = await this.apiKeyRepository.save(apiKey);
    this.logger.log(`API key created: ${saved.name}`, {
      keyId: saved.id,
      role: saved.role,
      action: 'api_key_created',
    });

    return { apiKey: saved, rawKey };
  }

  async findAll(): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException(`API key with id '${id}' not found`);
    }
    return apiKey;
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<ApiKey> {
    const apiKey = await this.findOne(id);

    if (dto.name) apiKey.name = dto.name;
    if (dto.role) apiKey.role = dto.role;
    if (dto.allowedIps !== undefined) apiKey.allowedIps = dto.allowedIps;
    if (dto.allowedSessions !== undefined) apiKey.allowedSessions = dto.allowedSessions;
    if (dto.expiresAt !== undefined) apiKey.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    return this.apiKeyRepository.save(apiKey);
  }

  async delete(id: string): Promise<void> {
    const apiKey = await this.findOne(id);
    await this.apiKeyRepository.remove(apiKey);
    this.logger.log(`API key deleted: ${apiKey.name}`, {
      keyId: id,
      action: 'api_key_deleted',
    });
  }

  async findAllForTenant(tenantId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createApiKeyForTenant(
    tenantId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const rawKey    = `owa_k1_${randomBytes(32).toString('hex')}`;
    const keyHash   = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const apiKey = this.apiKeyRepository.create({
      name: dto.name,
      keyHash,
      keyPrefix,
      role: dto.role || ApiKeyRole.OPERATOR,
      allowedIps: dto.allowedIps || null,
      allowedSessions: dto.allowedSessions || null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      tenantId,
      scopes: null,
      ...this.encryptRawKey(rawKey),
    });

    const saved = await this.apiKeyRepository.save(apiKey);
    return { apiKey: saved, rawKey };
  }

  /**
   * Reveal the raw key for a tenant-owned key (ADR-002). JWT-gated at the
   * controller. Keys created before encryption have no ciphertext and cannot be
   * revealed — the caller must rotate to obtain a fresh, revealable key.
   */
  async revealForTenant(tenantId: string, id: string): Promise<{ key: string; prefix: string }> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id, tenantId } });
    if (!apiKey) {
      throw new NotFoundException(`API key '${id}' not found`);
    }
    if (
      apiKey.keyEncVersion == null ||
      !apiKey.keyCiphertext ||
      !apiKey.keyIv ||
      !apiKey.keyAuthTag
    ) {
      throw new UnprocessableEntityException(
        'This key was created before encryption was enabled and cannot be revealed. Rotate it to get a new, revealable key.',
      );
    }
    const key = this.encryption.decrypt({
      ciphertext: apiKey.keyCiphertext,
      iv: apiKey.keyIv,
      authTag: apiKey.keyAuthTag,
      encVersion: apiKey.keyEncVersion,
    });
    return { key, prefix: apiKey.keyPrefix };
  }

  /**
   * Rotate a tenant key (ADR-006). Atomically issues a new key (inheriting role,
   * IP/session restrictions, expiry) and starts the grace window on the old one.
   * `gracePeriodHours` 0 = revoke the old key immediately.
   */
  async rotateForTenant(
    tenantId: string,
    id: string,
    gracePeriodHours?: number,
  ): Promise<{
    id: string;
    name: string;
    keyPrefix: string;
    apiKey: string;
    oldKeyId: string;
    oldKeyExpiresAt: Date;
  }> {
    const oldKey = await this.apiKeyRepository.findOne({ where: { id, tenantId } });
    if (!oldKey) {
      throw new NotFoundException(`API key '${id}' not found`);
    }

    const graceHours =
      gracePeriodHours ??
      parseInt(process.env.API_KEY_GRACE_PERIOD_HOURS ?? '24', 10);
    const now = new Date();
    const oldKeyExpiresAt = new Date(now.getTime() + Math.max(0, graceHours) * 3_600_000);

    const rawKey = `owa_k1_${randomBytes(32).toString('hex')}`;

    const newKey = this.apiKeyRepository.create({
      name: oldKey.name,
      keyHash: this.hashKey(rawKey),
      keyPrefix: rawKey.substring(0, 8),
      role: oldKey.role,
      allowedIps: oldKey.allowedIps,
      allowedSessions: oldKey.allowedSessions,
      expiresAt: oldKey.expiresAt,
      tenantId,
      scopes: oldKey.scopes,
      rotatedFrom: oldKey.id,
      ...this.encryptRawKey(rawKey),
    });

    oldKey.rotatedAt = now;
    oldKey.gracePeriodEndsAt = oldKeyExpiresAt;
    if (graceHours <= 0) {
      oldKey.isActive = false;
    }

    const saved = await this.apiKeyRepository.manager.transaction(async manager => {
      await manager.save(oldKey);
      return manager.save(newKey);
    });

    this.logger.log(`API key rotated: ${oldKey.name}`, {
      oldKeyId: oldKey.id,
      newKeyId: saved.id,
      action: 'api_key_rotated',
    });

    return {
      id: saved.id,
      name: saved.name,
      keyPrefix: saved.keyPrefix,
      apiKey: rawKey,
      oldKeyId: oldKey.id,
      oldKeyExpiresAt,
    };
  }

  /**
   * Deactivate rotated keys whose grace window has fully closed. Called by the
   * scheduled cleanup job (ADR-006). Returns the number deactivated.
   */
  async deactivateExpiredRotatedKeys(): Promise<number> {
    const result = await this.apiKeyRepository
      .createQueryBuilder()
      .update(ApiKey)
      .set({ isActive: false })
      .where('gracePeriodEndsAt IS NOT NULL')
      .andWhere('gracePeriodEndsAt < :now', { now: new Date() })
      .andWhere('isActive = :active', { active: true })
      .execute();
    return result.affected ?? 0;
  }

  async deleteForTenant(tenantId: string, id: string): Promise<void> {
    const key = await this.apiKeyRepository.findOne({ where: { id, tenantId } });
    if (!key) throw new NotFoundException(`API key '${id}' not found`);
    await this.apiKeyRepository.remove(key);
  }

  async revoke(id: string): Promise<ApiKey> {
    const apiKey = await this.findOne(id);
    apiKey.isActive = false;
    return this.apiKeyRepository.save(apiKey);
  }

  async validateApiKey(rawKey: string, clientIp?: string, sessionId?: string): Promise<ApiKey> {
    const keyHash = this.hashKey(rawKey);
    const apiKey = await this.apiKeyRepository.findOne({ where: { keyHash } });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!apiKey.isActive) {
      throw new UnauthorizedException('API key is revoked');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Reject a rotated key once its grace window has closed (ADR-006). A cleanup
    // job also flips isActive=false, but this is the enforcement line.
    if (apiKey.gracePeriodEndsAt && apiKey.gracePeriodEndsAt < new Date()) {
      throw new UnauthorizedException('API key has been rotated and is no longer valid');
    }

    // Check IP whitelist
    if (apiKey.allowedIps && apiKey.allowedIps.length > 0 && clientIp) {
      if (!this.isIpAllowed(clientIp, apiKey.allowedIps)) {
        this.logger.warn(`IP not allowed: ${clientIp}`, {
          keyId: apiKey.id,
          action: 'ip_rejected',
        });
        throw new UnauthorizedException('IP address not allowed');
      }
    }

    // Check session restriction
    if (apiKey.allowedSessions && apiKey.allowedSessions.length > 0 && sessionId) {
      if (!apiKey.allowedSessions.includes(sessionId)) {
        throw new UnauthorizedException('API key not authorized for this session');
      }
    }

    // Update usage stats
    apiKey.lastUsedAt = new Date();
    apiKey.usageCount += 1;
    await this.apiKeyRepository.save(apiKey);

    return apiKey;
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  private isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
    // Phase 3 Security Audit: Support both exact match and CIDR notation
    for (const entry of allowedIps) {
      if (entry.includes('/')) {
        // CIDR notation (e.g., "10.0.0.0/24")
        if (this.ipInCidr(clientIp, entry)) {
          return true;
        }
      } else {
        // Exact match
        if (clientIp === entry) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if an IPv4 address is within a CIDR range
   * @param ip - Client IP address (e.g., "192.168.1.100")
   * @param cidr - CIDR notation (e.g., "192.168.1.0/24")
   */
  private ipInCidr(ip: string, cidr: string): boolean {
    try {
      const [range, bitsStr] = cidr.split('/');
      const bits = parseInt(bitsStr, 10);

      if (isNaN(bits) || bits < 0 || bits > 32) {
        return false;
      }

      const mask = ~(2 ** (32 - bits) - 1);
      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(range);

      return (ipNum & mask) === (rangeNum & mask);
    } catch (error) {
      this.logger.warn(`Invalid CIDR format: ${cidr}`, { error: String(error) });
      return false;
    }
  }

  /**
   * Convert IPv4 address string to 32-bit number
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) return 0;

    return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  hasPermission(apiKey: ApiKey, requiredRole: ApiKeyRole): boolean {
    const roleHierarchy: Record<ApiKeyRole, number> = {
      [ApiKeyRole.VIEWER]: 1,
      [ApiKeyRole.OPERATOR]: 2,
      [ApiKeyRole.ADMIN]: 3,
    };

    return roleHierarchy[apiKey.role] >= roleHierarchy[requiredRole];
  }
}
