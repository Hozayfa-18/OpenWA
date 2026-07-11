import { Injectable, OnModuleInit } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createLogger } from '../../../common/services/logger.service';

export interface EncryptedKey {
  ciphertext: string;
  iv: string;
  authTag: string;
  encVersion: number;
}

const ALGORITHM = 'aes-256-gcm';
const CURRENT_ENC_VERSION = 1;

/**
 * AES-256-GCM encryption for API keys at rest (ADR-002). Lets a tenant key be
 * re-displayed and rotated while never storing it in plaintext.
 *
 * The 32-byte master key comes from `API_KEY_ENC_MASTER`. In production it is
 * mandatory (the service refuses to start without it). In dev/test a stable key
 * is derived from a fixed string so local workflows and the test suite keep
 * working — with a loud warning.
 */
@Injectable()
export class ApiKeyEncryptionService implements OnModuleInit {
  private readonly logger = createLogger('ApiKeyEncryptionService');
  private readonly masterKey: Buffer;

  constructor() {
    this.masterKey = this.resolveMasterKey();
  }

  onModuleInit(): void {
    if (this.masterKey.length !== 32) {
      throw new Error('API_KEY_ENC_MASTER must resolve to a 32-byte key');
    }
  }

  private resolveMasterKey(): Buffer {
    const raw = process.env.API_KEY_ENC_MASTER;
    if (raw && raw.length > 0) {
      // Accept either a 64-char hex string (32 bytes) or any passphrase, which
      // we hash down to a stable 32-byte key.
      if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, 'hex');
      }
      return createHash('sha256').update(raw).digest();
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('API_KEY_ENC_MASTER is required in production — set a 32-byte (64 hex char) master key.');
    }

    this.logger.warn('API_KEY_ENC_MASTER not set — deriving an insecure development key. DO NOT use in production.', {
      action: 'enc_master_dev_fallback',
    });
    return createHash('sha256').update('openwa-dev-insecure-master-key').digest();
  }

  encrypt(plaintext: string): EncryptedKey {
    const iv = randomBytes(12); // 96-bit nonce recommended for GCM
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: ciphertext.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encVersion: CURRENT_ENC_VERSION,
    };
  }

  decrypt(enc: EncryptedKey): string {
    if (enc.encVersion !== CURRENT_ENC_VERSION) {
      throw new Error(`Unsupported key encryption version: ${enc.encVersion}`);
    }
    const decipher = createDecipheriv(ALGORITHM, this.masterKey, Buffer.from(enc.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(enc.authTag, 'hex'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(enc.ciphertext, 'hex')), decipher.final()]);
    return plaintext.toString('utf8');
  }
}
