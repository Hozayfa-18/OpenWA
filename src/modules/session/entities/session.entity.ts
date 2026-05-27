import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SessionStatus {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  QR_READY = 'qr_ready',
  AUTHENTICATING = 'authenticating',
  READY = 'ready',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, default: DEFAULT_TENANT_ID })
  tenantId: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 50, default: SessionStatus.CREATED })
  status: SessionStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pushName: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  config: Record<string, unknown>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proxyUrl: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  proxyType: 'http' | 'https' | 'socks4' | 'socks5' | null;

  @Column({ type: 'timestamp', nullable: true })
  connectedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
