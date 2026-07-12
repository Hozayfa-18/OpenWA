import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  /** Clerk Organization id this tenant is linked to (null for legacy/API-key-only tenants). */
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  @Index()
  clerkOrgId: string | null;

  @Column({ type: 'varchar', length: 50, default: 'free' })
  plan: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
