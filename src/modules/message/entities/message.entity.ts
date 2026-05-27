import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';

export enum MessageDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Entity('messages')
@Index(['sessionId', 'createdAt'])
@Index(['chatId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, default: DEFAULT_TENANT_ID })
  tenantId: string;

  @Column()
  @Index()
  sessionId: string;

  @Column({ nullable: true })
  waMessageId: string;

  @Column()
  chatId: string;

  @Column()
  from: string;

  @Column()
  to: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({ default: 'text' })
  type: string;

  @Column({
    type: 'varchar',
    default: MessageDirection.OUTGOING,
  })
  direction: MessageDirection;

  @Column({ type: 'bigint', nullable: true })
  timestamp: number;

  @Column({ type: jsonColumnType(), nullable: true })
  metadata: Record<string, unknown>;

  @Column({
    type: 'varchar',
    default: MessageStatus.SENT,
  })
  @Index()
  status: MessageStatus;

  @CreateDateColumn()
  createdAt: Date;
}
