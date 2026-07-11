import { ApiKeyEncryptionService } from './api-key-encryption.service';

describe('ApiKeyEncryptionService', () => {
  let service: ApiKeyEncryptionService;

  beforeEach(() => {
    process.env.API_KEY_ENC_MASTER = 'a'.repeat(64); // 32-byte hex master key
    service = new ApiKeyEncryptionService();
    service.onModuleInit();
  });

  it('round-trips a key through encrypt/decrypt', () => {
    const raw = 'owa_k1_deadbeef';
    const enc = service.encrypt(raw);
    expect(enc.ciphertext).not.toContain(raw);
    expect(enc.encVersion).toBe(1);
    expect(service.decrypt(enc)).toBe(raw);
  });

  it('produces a unique IV per encryption', () => {
    const a = service.encrypt('same');
    const b = service.encrypt('same');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects a tampered auth tag', () => {
    const enc = service.encrypt('owa_k1_secret');
    const tampered = { ...enc, authTag: 'f'.repeat(enc.authTag.length) };
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('throws in production when no master key is set', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevMaster = process.env.API_KEY_ENC_MASTER;
    process.env.NODE_ENV = 'production';
    delete process.env.API_KEY_ENC_MASTER;
    try {
      expect(() => new ApiKeyEncryptionService()).toThrow(/API_KEY_ENC_MASTER is required/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.API_KEY_ENC_MASTER = prevMaster;
    }
  });
});
