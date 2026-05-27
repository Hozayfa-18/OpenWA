import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';

export type ContactChatType = 'whatsapp' | 'telegram' | 'instagram' | 'viber' | 'vk' | 'avito';

export interface ContactDataEntry {
  chatType: ContactChatType;
  chatId: string;
  username?: string;
}

@Entity('crm_contacts')
export class Contact {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @PrimaryColumn({ type: 'varchar', length: 36 })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  responsibleUserId: string | null;

  @Column({ type: jsonColumnType(), default: '[]' })
  contactData: ContactDataEntry[];

  @Column({ type: 'varchar', length: 2048, nullable: true })
  uri: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
