import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Session } from '../../session/entities/session.entity';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, default: DEFAULT_TENANT_ID })
  tenantId: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: Session;

  @Column({ type: 'varchar', length: 2048 })
  url: string;

  @Column({ type: 'jsonb', default: '["message.received"]' })
  events: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  secret: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  headers: Record<string, string>;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 3 })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastTriggeredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
