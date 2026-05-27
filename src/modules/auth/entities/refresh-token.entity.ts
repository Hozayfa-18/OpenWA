import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ValueTransformer } from 'typeorm';

/** Store dates as ISO-8601 text so the column is compatible with both SQLite and PostgreSQL. */
const dateTransformer: ValueTransformer = {
  to: (value: Date | null) => (value ? value.toISOString() : null),
  from: (value: string | null) => (value ? new Date(value) : null),
};

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true, transformer: dateTransformer })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
