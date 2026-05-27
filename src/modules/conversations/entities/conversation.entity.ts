import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { dateColumnType } from '../../../common/utils/column-types';

@Entity('conversations')
@Index(['tenantId', 'lastMessageAt'])
@Index(['tenantId', 'assignedUserId'])
export class Conversation {
  @PrimaryColumn({ type: 'varchar' })
  tenantId: string;

  @PrimaryColumn({ type: 'varchar' })
  sessionId: string;

  @PrimaryColumn({ type: 'varchar' })
  chatId: string;

  @Column({ nullable: true, type: 'varchar' })
  contactId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  assignedUserId: string | null;

  @Column({ type: 'varchar' })
  lastMessageId: string;

  @Column({ type: dateColumnType(), transformer: DateTransformer })
  lastMessageAt: Date;

  @Column({ default: 0 })
  unreadCount: number;
}
