import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';

@Entity('crm_deals')
export class Deal {
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
  contactIds: string[];

  @Column({ type: 'boolean', default: false })
  closed: boolean;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  uri: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
