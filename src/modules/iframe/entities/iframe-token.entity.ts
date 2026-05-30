import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export type IframeScope = 'global' | 'card';

export interface IframeChatFilter {
  chatType: string;
  chatId: string;
  username?: string;
}

export interface IframeActiveChat {
  channelId?: string;
  chatType: string;
  chatId: string;
}

@Entity('iframe_tokens')
@Index(['tenantId', 'expiresAt'])
export class IframeToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar' })
  crmUserId: string;

  @Column({ type: 'varchar', nullable: true })
  crmUserName: string | null;

  @Column({ type: 'varchar', default: 'global' })
  scope: IframeScope;

  @Column({ type: 'jsonb', nullable: true })
  filter: IframeChatFilter[] | null;

  @Column({ type: 'jsonb', nullable: true })
  activeChat: IframeActiveChat | null;

  @Column({ type: 'boolean', default: false })
  useDealsEvents: boolean;

  @Column({ type: 'boolean', default: false })
  useMessageEvents: boolean;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
