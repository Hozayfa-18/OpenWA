import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum UserRole {
  OWNER          = 'owner',
  ADMIN          = 'admin',
  MANAGER        = 'manager',
  SALES_REP      = 'sales_rep',
  QUALITY_CONTROL = 'quality_control',
}

@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** bcrypt hash — nullable now that Clerk owns credentials for dashboard users. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  passwordHash: string | null;

  /** Clerk user id this row is linked to (null for legacy password/API-key users). */
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  @Index()
  clerkUserId: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30, default: UserRole.SALES_REP })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
