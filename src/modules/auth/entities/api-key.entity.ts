// src/modules/auth/entities/api-key.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ApiKeyRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  keyHash: string;

  @Column({ type: 'varchar', length: 8 })
  keyPrefix: string;

  // ── Reversible storage (ADR-002) ────────────────────────────────────────
  // The raw key is additionally stored AES-256-GCM encrypted so it can be
  // re-displayed ("always-viewable") and rotated. `keyHash` stays the lookup
  // index; decryption only ever happens on an explicit, JWT-gated reveal.
  // Keys created before this feature have no ciphertext — `keyEncVersion` is
  // null and reveal returns a "rotate to get a new key" error.
  @Column({ type: 'text', nullable: true })
  keyCiphertext: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  keyIv: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  keyAuthTag: string | null;

  @Column({ type: 'int', nullable: true })
  keyEncVersion: number | null;

  // ── Rotation (ADR-006) ──────────────────────────────────────────────────
  @Column({ type: 'uuid', nullable: true })
  rotatedFrom: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rotatedAt: Date | null;

  // While set in the future, a rotated key still authenticates (grace window);
  // once past, validation rejects it and a cleanup job deactivates it.
  @Column({ type: 'timestamp', nullable: true })
  gracePeriodEndsAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: ApiKeyRole.OPERATOR })
  role: ApiKeyRole;

  @Column({ type: 'simple-array', nullable: true })
  allowedIps: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  allowedSessions: string[] | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  tenantId: string | null;

  @Column({ type: 'simple-array', nullable: true })
  scopes: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
