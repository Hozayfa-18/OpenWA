import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum BatchStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum BatchMessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface BatchMessageResult {
  chatId: string;
  status: BatchMessageStatus;
  messageId?: string;
  error?: { code: string; message: string };
  sentAt?: Date;
}

export interface BatchProgress {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  cancelled: number;
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Entity('message_batches')
export class MessageBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, default: DEFAULT_TENANT_ID })
  tenantId: string;

  @Column({ name: 'batch_id', unique: true })
  batchId: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ type: 'varchar', default: BatchStatus.PENDING })
  status: BatchStatus;

  @Column({ type: 'jsonb' })
  messages: Array<{
    chatId: string;
    type: string;
    content: Record<string, unknown>;
    variables?: Record<string, string>;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  options: {
    delayBetweenMessages: number;
    randomizeDelay: boolean;
    stopOnError: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  progress: BatchProgress;

  @Column({ type: 'jsonb', nullable: true })
  results: BatchMessageResult[];

  @Column({ name: 'current_index', default: 0 })
  currentIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
