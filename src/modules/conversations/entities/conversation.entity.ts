import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

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

  @Column({ nullable: true, type: 'varchar' })
  phoneNumber: string | null;

  @Column({ nullable: true, type: 'varchar' })
  contactName: string | null;

  @Column({ type: 'varchar' })
  lastMessageId: string;

  @Column({ type: 'timestamp' })
  lastMessageAt: Date;

  @Column({ default: 0 })
  unreadCount: number;
}
