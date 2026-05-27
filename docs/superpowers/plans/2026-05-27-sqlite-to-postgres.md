# SQLite → Supabase (Postgres) Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every trace of SQLite from the codebase, collapsing the dual `main`/`data` TypeORM connections into one Postgres-only connection pointed at Supabase.

**Architecture:** Single `TypeOrmModule.forRootAsync` (connection name `default`) owns all entities. The `column-types` and `date.transformer` helpers are deleted — entities use native Postgres types directly. Migrations drop their SQLite branches entirely.

**Tech Stack:** NestJS, TypeORM 0.3.x, PostgreSQL (Supabase), pnpm

---

## File Map

| File | Change |
|------|--------|
| `src/config/configuration.ts` | Remove `database` (sqlite) block; rename `dataDatabase` → `database` |
| `src/app.module.ts` | Replace two connections with one `postgres` connection, all entities, SSL support |
| `src/database/data-source.ts` | Postgres-only DataSource |
| `src/common/utils/column-types.ts` | **Delete** |
| `src/common/transformers/date.transformer.ts` | **Delete** |
| `src/modules/auth/entities/api-key.entity.ts` | `'datetime'` → `'timestamp'`; drop transformer imports |
| `src/modules/auth/entities/refresh-token.entity.ts` | `'varchar'` + local transformer → `'timestamp'` |
| `src/modules/audit/entities/audit-log.entity.ts` | `'simple-json'` → `'jsonb'`; add connection name |
| `src/modules/session/entities/session.entity.ts` | `dateColumnType()` → `'timestamp'`; `jsonColumnType()` → `'jsonb'` |
| `src/modules/webhook/entities/webhook.entity.ts` | same |
| `src/modules/message/entities/message.entity.ts` | `jsonColumnType()` → `'jsonb'` |
| `src/modules/message/entities/message-batch.entity.ts` | `dateColumnType()` → `'timestamp'`; `jsonColumnType()` → `'jsonb'` |
| `src/modules/crm/entities/contact.entity.ts` | `jsonColumnType()` → `'jsonb'` |
| `src/modules/crm/entities/deal.entity.ts` | same |
| `src/modules/conversations/entities/conversation.entity.ts` | `dateColumnType()` → `'timestamp'`; drop transformer |
| `src/database/migrations/1770108659848-AddMessageStatus.ts` | Remove SQLite branch |
| `src/database/migrations/1748390000000-AddTenantFoundation.ts` | Remove SQLite branch |
| `src/database/migrations/1748410000000-AddCrmEntities.ts` | Remove SQLite branch |
| `src/database/migrations/1748430000000-AddConversations.ts` | Remove SQLite branch |
| `src/modules/infra/infra.controller.ts` | Single `@InjectDataSource()`, drop `'sqlite'` from DTO, update config keys |
| `src/main.ts` | Remove SQLite default from generated `.env.generated` template |
| `docker-compose.yml` | `DATABASE_TYPE` default → `postgres`; remove optional `postgres` profile |
| `.env.example` | Postgres-only docs |
| `.env.minimal` | Supabase connection vars |

---

## Task 1: Delete the sqlite compat helpers

**Files:**
- Delete: `src/common/utils/column-types.ts`
- Delete: `src/common/transformers/date.transformer.ts`

- [ ] **Step 1: Delete both files**

```powershell
Remove-Item "src\common\utils\column-types.ts"
Remove-Item "src\common\transformers\date.transformer.ts"
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: delete sqlite column-type and date-transformer helpers"
```

---

## Task 2: Update all entities — native Postgres types

**Files:**
- Modify: `src/modules/auth/entities/api-key.entity.ts`
- Modify: `src/modules/auth/entities/refresh-token.entity.ts`
- Modify: `src/modules/audit/entities/audit-log.entity.ts`
- Modify: `src/modules/session/entities/session.entity.ts`
- Modify: `src/modules/webhook/entities/webhook.entity.ts`
- Modify: `src/modules/message/entities/message.entity.ts`
- Modify: `src/modules/message/entities/message-batch.entity.ts`
- Modify: `src/modules/crm/entities/contact.entity.ts`
- Modify: `src/modules/crm/entities/deal.entity.ts`
- Modify: `src/modules/conversations/entities/conversation.entity.ts`

- [ ] **Step 1: Replace `api-key.entity.ts`**

Full file content:

```typescript
// src/modules/auth/entities/api-key.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ApiKeyRole {
  ADMIN    = 'admin',
  OPERATOR = 'operator',
  VIEWER   = 'viewer',
}

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  keyHash: string;

  @Column({ type: 'varchar', length: 8 })
  keyPrefix: string;

  @Column({ type: 'varchar', length: 20, default: ApiKeyRole.OPERATOR })
  role: ApiKeyRole;

  @Column({ type: 'simple-array', nullable: true })
  allowedIps: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  allowedSessions: string[] | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  tenantId: string | null;

  @Column({ type: 'simple-array', nullable: true })
  scopes: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 2: Replace `refresh-token.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

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

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 3: Replace `audit-log.entity.ts`**

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
  API_KEY_CREATED = 'api_key_created',
  API_KEY_USED = 'api_key_used',
  API_KEY_REVOKED = 'api_key_revoked',
  API_KEY_DELETED = 'api_key_deleted',
  API_KEY_AUTH_FAILED = 'api_key_auth_failed',
  SESSION_CREATED = 'session_created',
  SESSION_STARTED = 'session_started',
  SESSION_STOPPED = 'session_stopped',
  SESSION_DELETED = 'session_deleted',
  SESSION_QR_GENERATED = 'session_qr_generated',
  SESSION_CONNECTED = 'session_connected',
  SESSION_DISCONNECTED = 'session_disconnected',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_FAILED = 'message_failed',
  WEBHOOK_CREATED = 'webhook_created',
  WEBHOOK_DELETED = 'webhook_deleted',
  WEBHOOK_TRIGGERED = 'webhook_triggered',
  WEBHOOK_FAILED = 'webhook_failed',
}

export enum AuditSeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, default: DEFAULT_TENANT_ID })
  tenantId: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 10, default: AuditSeverity.INFO })
  severity: AuditSeverity;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  apiKeyId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  apiKeyName: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionName: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  path: string | null;

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 4: Replace `session.entity.ts`**

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SessionStatus {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  QR_READY = 'qr_ready',
  AUTHENTICATING = 'authenticating',
  READY = 'ready',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, default: DEFAULT_TENANT_ID })
  tenantId: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 50, default: SessionStatus.CREATED })
  status: SessionStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pushName: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  config: Record<string, unknown>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proxyUrl: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  proxyType: 'http' | 'https' | 'socks4' | 'socks5' | null;

  @Column({ type: 'timestamp', nullable: true })
  connectedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 5: Replace `webhook.entity.ts`**

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Session } from '../../session/entities/session.entity';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, default: DEFAULT_TENANT_ID })
  tenantId: string;

  @Column({ type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: Session;

  @Column({ type: 'varchar', length: 2048 })
  url: string;

  @Column({ type: 'jsonb', default: '["message.received"]' })
  events: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  secret: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  headers: Record<string, string>;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 3 })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastTriggeredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 6: Replace `message.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

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

  @Column({ type: 'varchar', default: MessageDirection.OUTGOING })
  direction: MessageDirection;

  @Column({ type: 'bigint', nullable: true })
  timestamp: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'varchar', default: MessageStatus.SENT })
  @Index()
  status: MessageStatus;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 7: Replace `message-batch.entity.ts`**

```typescript
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
```

- [ ] **Step 8: Replace `contact.entity.ts`**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ type: 'jsonb', default: '[]' })
  contactData: ContactDataEntry[];

  @Column({ type: 'varchar', length: 2048, nullable: true })
  uri: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 9: Replace `deal.entity.ts`**

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ type: 'jsonb', default: '[]' })
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
```

- [ ] **Step 10: Replace `conversation.entity.ts`**

```typescript
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

  @Column({ type: 'varchar' })
  lastMessageId: string;

  @Column({ type: 'timestamp' })
  lastMessageAt: Date;

  @Column({ default: 0 })
  unreadCount: number;
}
```

- [ ] **Step 11: Commit entities**

```bash
git add src/modules
git commit -m "refactor: use native postgres types in all entities"
```

---

## Task 3: Simplify migrations to Postgres-only

**Files:**
- Modify: `src/database/migrations/1770108659848-AddMessageStatus.ts`
- Modify: `src/database/migrations/1748390000000-AddTenantFoundation.ts`
- Modify: `src/database/migrations/1748410000000-AddCrmEntities.ts`
- Modify: `src/database/migrations/1748430000000-AddConversations.ts`

- [ ] **Step 1: Replace `1770108659848-AddMessageStatus.ts`**

Remove the `isPg` dispatch and both private sqlite methods. Keep only the postgres SQL (previously inside `upPostgres`/`downPostgres`), inlined directly into `up`/`down`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageStatus1770108659848 implements MigrationInterface {
  name = 'AddMessageStatus1770108659848';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sessions" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(100) NOT NULL, "status" varchar(50) NOT NULL DEFAULT 'created', "phone" varchar(20), "pushName" varchar(100), "config" text NOT NULL DEFAULT '{}', "proxyUrl" varchar(255), "proxyType" varchar(10), "connectedAt" timestamp, "lastActiveAt" timestamp, "createdAt" timestamp NOT NULL DEFAULT NOW(), "updatedAt" timestamp NOT NULL DEFAULT NOW(), CONSTRAINT "UQ_ac984ccbd8b01af155e1874e8cb" UNIQUE ("name"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhooks" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "url" varchar(2048) NOT NULL, "events" text NOT NULL DEFAULT '["message.received"]', "secret" varchar(255), "headers" text NOT NULL DEFAULT '{}', "active" boolean NOT NULL DEFAULT true, "retryCount" integer NOT NULL DEFAULT 3, "lastTriggeredAt" timestamp, "createdAt" timestamp NOT NULL DEFAULT NOW(), "updatedAt" timestamp NOT NULL DEFAULT NOW(), CONSTRAINT "FK_d209715bb62b12255e825580af6" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" varchar PRIMARY KEY NOT NULL, "sessionId" varchar NOT NULL, "waMessageId" varchar, "chatId" varchar NOT NULL, "from" varchar NOT NULL, "to" varchar NOT NULL, "body" text, "type" varchar NOT NULL DEFAULT 'text', "direction" varchar NOT NULL DEFAULT 'outgoing', "timestamp" bigint, "metadata" text, "status" varchar NOT NULL DEFAULT 'sent', "createdAt" timestamp NOT NULL DEFAULT NOW())`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_066163c46cda7e8187f96bc87a" ON "messages" ("sessionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_befd307485dbf0559d17e4a4d2" ON "messages" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_36bc604c820bb9adc4c75cd411" ON "messages" ("chatId")`);
    await queryRunner.query(`CREATE INDEX "IDX_399833392126349ef0b04b9bed" ON "messages" ("sessionId", "createdAt")`);
    await queryRunner.query(
      `CREATE TABLE "message_batches" ("id" varchar PRIMARY KEY NOT NULL, "batch_id" varchar NOT NULL, "session_id" varchar NOT NULL, "status" varchar NOT NULL DEFAULT 'pending', "messages" text NOT NULL, "options" text, "progress" text, "results" text, "current_index" integer NOT NULL DEFAULT 0, "created_at" timestamp NOT NULL DEFAULT NOW(), "updated_at" timestamp NOT NULL DEFAULT NOW(), "started_at" timestamp, "completed_at" timestamp, CONSTRAINT "UQ_ff274470c0dbaff6c7d1f9795f5" UNIQUE ("batch_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(100) NOT NULL, "keyHash" varchar(64) NOT NULL, "keyPrefix" varchar(8) NOT NULL, "role" varchar(20) NOT NULL DEFAULT 'operator', "allowedIps" text, "allowedSessions" text, "isActive" boolean NOT NULL DEFAULT true, "expiresAt" timestamp, "lastUsedAt" timestamp, "usageCount" integer NOT NULL DEFAULT 0, "createdAt" timestamp NOT NULL DEFAULT NOW(), "updatedAt" timestamp NOT NULL DEFAULT NOW())`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_df3b25181df0b4b59bd93f16e1" ON "api_keys" ("keyHash")`);
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" varchar PRIMARY KEY NOT NULL, "action" varchar(50) NOT NULL, "severity" varchar(10) NOT NULL DEFAULT 'info', "apiKeyId" varchar(36), "apiKeyName" varchar(100), "sessionId" varchar(36), "sessionName" varchar(100), "ipAddress" varchar(45), "userAgent" varchar(500), "method" varchar(10), "path" varchar(500), "statusCode" integer, "metadata" text, "errorMessage" text, "createdAt" timestamp NOT NULL DEFAULT NOW())`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_741fa976d1e04e695f3aa23cb8" ON "audit_logs" ("apiKeyId")`);
    await queryRunner.query(`CREATE INDEX "IDX_dd2b6e43c767b6b5b2bb227ace" ON "audit_logs" ("sessionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_c69efb19bf127c97e6740ad530" ON "audit_logs" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_c69efb19bf127c97e6740ad530"`);
    await queryRunner.query(`DROP INDEX "IDX_dd2b6e43c767b6b5b2bb227ace"`);
    await queryRunner.query(`DROP INDEX "IDX_741fa976d1e04e695f3aa23cb8"`);
    await queryRunner.query(`DROP INDEX "IDX_cee5459245f652b75eb2759b4c"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "IDX_df3b25181df0b4b59bd93f16e1"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
    await queryRunner.query(`DROP TABLE "message_batches"`);
    await queryRunner.query(`DROP INDEX "IDX_399833392126349ef0b04b9bed"`);
    await queryRunner.query(`DROP INDEX "IDX_36bc604c820bb9adc4c75cd411"`);
    await queryRunner.query(`DROP INDEX "IDX_befd307485dbf0559d17e4a4d2"`);
    await queryRunner.query(`DROP INDEX "IDX_066163c46cda7e8187f96bc87a"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
  }
}
```

- [ ] **Step 2: Replace `1748390000000-AddTenantFoundation.ts`**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
const DEFAULT_SLUG = 'default';
const DEFAULT_NAME = process.env.DEFAULT_TENANT_NAME || 'Default Tenant';
const LEGACY = 'legacy';

export class AddTenantFoundation1748390000000 implements MigrationInterface {
  name = 'AddTenantFoundation1748390000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenants (
        id varchar(36) PRIMARY KEY NOT NULL,
        name varchar(100) NOT NULL,
        slug varchar(100) NOT NULL,
        plan varchar(50) NOT NULL DEFAULT 'free',
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_tenants_slug" UNIQUE (slug)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id varchar(36) PRIMARY KEY NOT NULL,
        "tenantId" varchar(36) NOT NULL,
        email varchar(255) NOT NULL,
        "passwordHash" varchar(60) NOT NULL,
        name varchar(100) NOT NULL,
        role varchar(30) NOT NULL DEFAULT 'sales_rep',
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_users_tenant_email" UNIQUE ("tenantId", email)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_tenantId" ON users ("tenantId")`);

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id varchar(36) PRIMARY KEY NOT NULL,
        "userId" varchar(36) NOT NULL,
        "tenantId" varchar(36) NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "expiresAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_refresh_tokens_hash" UNIQUE ("tokenHash")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_userId" ON refresh_tokens ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_tenantId" ON refresh_tokens ("tenantId")`);

    await queryRunner.query(`ALTER TABLE sessions ADD COLUMN "tenantId" varchar(36) NOT NULL DEFAULT '${LEGACY}'`);
    await queryRunner.query(`ALTER TABLE webhooks ADD COLUMN "tenantId" varchar(36) NOT NULL DEFAULT '${LEGACY}'`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN "tenantId" varchar(36) NOT NULL DEFAULT '${LEGACY}'`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_tenantId" ON sessions ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhooks_tenantId" ON webhooks ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_messages_tenantId" ON messages ("tenantId")`);

    await queryRunner.query(
      `INSERT INTO tenants (id, name, slug, plan, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'free', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_ID, DEFAULT_NAME, DEFAULT_SLUG],
    );

    await queryRunner.query(`UPDATE sessions SET "tenantId" = $1 WHERE "tenantId" = '${LEGACY}'`, [DEFAULT_ID]);
    await queryRunner.query(`UPDATE webhooks SET "tenantId" = $1 WHERE "tenantId" = '${LEGACY}'`, [DEFAULT_ID]);
    await queryRunner.query(`UPDATE messages SET "tenantId" = $1 WHERE "tenantId" = '${LEGACY}'`, [DEFAULT_ID]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_messages_tenantId"`);
    await queryRunner.query(`DROP INDEX "IDX_webhooks_tenantId"`);
    await queryRunner.query(`DROP INDEX "IDX_sessions_tenantId"`);
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN "tenantId"`);
    await queryRunner.query(`ALTER TABLE webhooks DROP COLUMN "tenantId"`);
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN "tenantId"`);
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_tenantId"`);
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_userId"`);
    await queryRunner.query(`DROP TABLE refresh_tokens`);
    await queryRunner.query(`DROP INDEX "IDX_users_tenantId"`);
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TABLE tenants`);
  }
}
```

- [ ] **Step 3: Replace `1748410000000-AddCrmEntities.ts`**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmEntities1748410000000 implements MigrationInterface {
  name = 'AddCrmEntities1748410000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE crm_contacts (
        id varchar(36) NOT NULL,
        "tenantId" varchar(36) NOT NULL,
        name varchar(255) NOT NULL,
        "responsibleUserId" varchar(36),
        "contactData" jsonb NOT NULL DEFAULT '[]',
        uri varchar(2048),
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_crm_contacts" PRIMARY KEY ("tenantId", id)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_contacts_tenantId" ON crm_contacts ("tenantId")`);

    await queryRunner.query(`
      CREATE TABLE crm_deals (
        id varchar(36) NOT NULL,
        "tenantId" varchar(36) NOT NULL,
        name varchar(255) NOT NULL,
        "responsibleUserId" varchar(36),
        "contactIds" jsonb NOT NULL DEFAULT '[]',
        closed boolean NOT NULL DEFAULT false,
        uri varchar(2048),
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_crm_deals" PRIMARY KEY ("tenantId", id)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_deals_tenantId" ON crm_deals ("tenantId")`);

    await queryRunner.query(`
      CREATE TABLE crm_users (
        id varchar(36) NOT NULL,
        "tenantId" varchar(36) NOT NULL,
        name varchar(100) NOT NULL,
        email varchar(255),
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_crm_users" PRIMARY KEY ("tenantId", id)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_users_tenantId" ON crm_users ("tenantId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_crm_users_tenantId"`);
    await queryRunner.query(`DROP TABLE crm_users`);
    await queryRunner.query(`DROP INDEX "IDX_crm_deals_tenantId"`);
    await queryRunner.query(`DROP TABLE crm_deals`);
    await queryRunner.query(`DROP INDEX "IDX_crm_contacts_tenantId"`);
    await queryRunner.query(`DROP TABLE crm_contacts`);
  }
}
```

- [ ] **Step 4: Replace `1748430000000-AddConversations.ts`**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversations1748430000000 implements MigrationInterface {
  name = 'AddConversations1748430000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversations" (
        "tenantId"       VARCHAR NOT NULL,
        "sessionId"      VARCHAR NOT NULL,
        "chatId"         VARCHAR NOT NULL,
        "contactId"      VARCHAR,
        "assignedUserId" VARCHAR,
        "lastMessageId"  VARCHAR NOT NULL DEFAULT '',
        "lastMessageAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
        "unreadCount"    INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "PK_conversations" PRIMARY KEY ("tenantId", "sessionId", "chatId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conv_tenant_time"
        ON "conversations" ("tenantId", "lastMessageAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conv_tenant_assigned"
        ON "conversations" ("tenantId", "assignedUserId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_conv_tenant_assigned"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_conv_tenant_time"');
    await queryRunner.query('DROP TABLE IF EXISTS "conversations"');
  }
}
```

- [ ] **Step 5: Commit migrations**

```bash
git add src/database/migrations
git commit -m "refactor: remove sqlite branches from all migrations"
```

---

## Task 4: Collapse to a single Postgres connection

**Files:**
- Modify: `src/config/configuration.ts`
- Modify: `src/app.module.ts`
- Modify: `src/database/data-source.ts`

- [ ] **Step 1: Replace `configuration.ts`**

```typescript
export default () => ({
  port: parseInt(process.env.PORT || '2785', 10),

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  queue: {
    enabled: process.env.QUEUE_ENABLED === 'true',
  },

  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
  },

  // Single Postgres database (Supabase)
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'postgres',
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
    ssl: process.env.DATABASE_SSL !== 'false', // default true for Supabase
    sslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  },

  engine: {
    type: process.env.ENGINE_TYPE || 'whatsapp-web.js',
    puppeteer: {
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      args: (process.env.PUPPETEER_ARGS || '--no-sandbox,--disable-setuid-sandbox').split(','),
    },
    sessionDataPath: process.env.SESSION_DATA_PATH || './data/sessions',
  },

  webhook: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000', 10),
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '5000', 10),
  },

  api: {
    rateLimit: {
      shortTtl: parseInt(process.env.RATE_LIMIT_SHORT_TTL || '1000', 10),
      shortLimit: parseInt(process.env.RATE_LIMIT_SHORT_LIMIT || '10', 10),
      mediumTtl: parseInt(process.env.RATE_LIMIT_MEDIUM_TTL || '60000', 10),
      mediumLimit: parseInt(process.env.RATE_LIMIT_MEDIUM_LIMIT || '100', 10),
      longTtl: parseInt(process.env.RATE_LIMIT_LONG_TTL || '3600000', 10),
      longLimit: parseInt(process.env.RATE_LIMIT_LONG_LIMIT || '1000', 10),
    },
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  },

  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    localPath: process.env.STORAGE_LOCAL_PATH || './data/media',
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT,
    },
  },
});
```

- [ ] **Step 2: Replace `app.module.ts`**

Replace the two `TypeOrmModule.forRootAsync` blocks with one. Keep all other imports/modules unchanged:

```typescript
// Replace the two TypeOrmModule.forRootAsync blocks (lines 54-120) with:
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres' as const,
    host: configService.get<string>('database.host'),
    port: configService.get<number>('database.port'),
    username: configService.get<string>('database.username'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.database', 'postgres'),
    entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
    synchronize: configService.get<boolean>('database.synchronize', false),
    migrationsRun: !configService.get<boolean>('database.synchronize', false),
    logging: configService.get<boolean>('database.logging', false),
    retryAttempts: 10,
    retryDelay: 3000,
    ssl: configService.get<boolean>('database.ssl', true)
      ? { rejectUnauthorized: configService.get<boolean>('database.sslRejectUnauthorized', false) }
      : false,
    extra: {
      max: configService.get<number>('database.poolSize', 10),
    },
  }),
}),
```

The full file after the change (only the module imports block changes; all other imports stay):

```typescript
import { Module, DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { SessionModule } from './modules/session/session.module';
import { MessageModule } from './modules/message/message.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { EngineModule } from './engine/engine.module';
import { LoggerModule } from './common/services/logger.module';
import { SettingsModule } from './modules/settings/settings.module';
import { InfraModule } from './modules/infra/infra.module';
import { EventsModule } from './modules/events/events.module';
import { ContactModule } from './modules/contact/contact.module';
import { GroupModule } from './modules/group/group.module';
import { LabelModule } from './modules/label/label.module';
import { ChannelModule } from './modules/channel/channel.module';
import { CacheModule } from './common/cache';
import { StorageModule } from './common/storage/storage.module';
import { StatsModule } from './modules/stats/stats.module';
import { StatusModule } from './modules/status/status.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HooksModule } from './core/hooks';
import { PluginsModule } from './core/plugins';
import { PluginsApiModule } from './modules/plugins/plugins.module';
import { TenantModule } from './common/tenant/tenant.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { CrmModule } from './modules/crm/crm.module';
import { ConversationsModule } from './modules/conversations/conversations.module';

const queueModules: Array<Type | DynamicModule> = [];
if (process.env.QUEUE_ENABLED === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const queueModule = require('./modules/queue/queue.module') as { QueueModule: Type };
  queueModules.push(queueModule.QueueModule);
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database', 'postgres'),
        entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.get<boolean>('database.synchronize', false),
        migrationsRun: !configService.get<boolean>('database.synchronize', false),
        logging: configService.get<boolean>('database.logging', false),
        retryAttempts: 10,
        retryDelay: 3000,
        ssl: configService.get<boolean>('database.ssl', true)
          ? { rejectUnauthorized: configService.get<boolean>('database.sslRejectUnauthorized', false) }
          : false,
        extra: { max: configService.get<number>('database.poolSize', 10) },
      }),
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: configService.get<number>('api.rateLimit.shortTtl', 1000), limit: configService.get<number>('api.rateLimit.shortLimit', 10) },
          { name: 'medium', ttl: configService.get<number>('api.rateLimit.mediumTtl', 60000), limit: configService.get<number>('api.rateLimit.mediumLimit', 100) },
          { name: 'long', ttl: configService.get<number>('api.rateLimit.longTtl', 3600000), limit: configService.get<number>('api.rateLimit.longLimit', 1000) },
        ],
      }),
    }),

    HooksModule,
    PluginsModule,
    LoggerModule,
    CacheModule,
    StorageModule,
    AuditModule,
    EventsModule,
    ...queueModules,
    AuthModule,
    TenantModule,
    TenantsModule,
    UsersModule,
    CrmModule,
    ConversationsModule,
    EngineModule,
    SessionModule,
    MessageModule,
    WebhookModule,
    HealthModule,
    SettingsModule,
    InfraModule,
    ContactModule,
    GroupModule,
    LabelModule,
    ChannelModule,
    StatsModule,
    StatusModule,
    CatalogModule,
    PluginsApiModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Replace `data-source.ts`**

```typescript
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'postgres',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
  ssl: process.env.DATABASE_SSL !== 'false'
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
  extra: {
    max: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add src/config/configuration.ts src/app.module.ts src/database/data-source.ts
git commit -m "refactor: single postgres TypeORM connection, drop sqlite config"
```

---

## Task 5: Remove named connection strings from all modules

**Files:**
- Modify: `src/modules/audit/audit.module.ts`
- Modify: `src/modules/auth/auth.module.ts`
- Modify: `src/modules/crm/crm.module.ts`
- Modify: `src/modules/conversations/conversations.module.ts`
- Modify: `src/modules/message/message.module.ts`
- Modify: `src/modules/queue/queue.module.ts`
- Modify: `src/modules/session/session.module.ts`
- Modify: `src/modules/session/session.service.ts`
- Modify: `src/modules/session/session.service.spec.ts`
- Modify: `src/modules/stats/stats.module.ts`
- Modify: `src/modules/tenants/tenants.module.ts`
- Modify: `src/modules/users/users.module.ts`
- Modify: `src/modules/webhook/webhook.module.ts`

With a single default connection every `TypeOrmModule.forFeature([...], 'main')` and `TypeOrmModule.forFeature([...], 'data')` must drop the second argument, and every `@InjectDataSource('data')` / `@InjectDataSource('main')` must become `@InjectDataSource()`.

- [ ] **Step 1: Strip connection names from all `forFeature` calls**

Run this sed-equivalent (PowerShell) to remove the `'main'` and `'data'` second arguments in bulk:

```powershell
$files = @(
  "src\modules\audit\audit.module.ts",
  "src\modules\auth\auth.module.ts",
  "src\modules\crm\crm.module.ts",
  "src\modules\conversations\conversations.module.ts",
  "src\modules\message\message.module.ts",
  "src\modules\queue\queue.module.ts",
  "src\modules\session\session.module.ts",
  "src\modules\stats\stats.module.ts",
  "src\modules\tenants\tenants.module.ts",
  "src\modules\users\users.module.ts",
  "src\modules\webhook\webhook.module.ts"
)

foreach ($f in $files) {
  $content = Get-Content $f -Raw
  $content = $content -replace ", 'main'\)", ")"
  $content = $content -replace ", 'data'\)", ")"
  Set-Content $f $content -Encoding utf8
}
```

- [ ] **Step 2: Fix `session.service.ts` — replace `@InjectDataSource('data')` with `@InjectDataSource()`**

Open `src/modules/session/session.service.ts` and change:
```typescript
@InjectDataSource('data')
private readonly dataSource: DataSource,
```
To:
```typescript
@InjectDataSource()
private readonly dataSource: DataSource,
```

- [ ] **Step 3: Fix `session.service.spec.ts` — replace `getDataSourceToken('data')` with `getDataSourceToken()`**

Open `src/modules/session/session.service.spec.ts` and change:
```typescript
provide: getDataSourceToken('data'),
```
To:
```typescript
provide: getDataSourceToken(),
```

- [ ] **Step 4: Commit**

```bash
git add src/modules
git commit -m "refactor: remove named connection strings — all modules use default connection"
```

---

## Task 7: Fix InfraController — single DataSource + remove sqlite refs

**Files:**
- Modify: `src/modules/infra/infra.controller.ts`

- [ ] **Step 1: Replace the constructor injection**

Change:
```typescript
@InjectDataSource('main')
private readonly mainDataSource: DataSource,
@InjectDataSource('data')
private readonly dataDataSource: DataSource,
```

To:
```typescript
@InjectDataSource()
private readonly dataSource: DataSource,
```

- [ ] **Step 2: Update `getStatus()` method body**

Change:
```typescript
const mainDbConnected = this.mainDataSource.isInitialized;
const dataDbConnected = this.dataDataSource.isInitialized;
const dbConnected = mainDbConnected && dataDbConnected;
const dbType = this.configService.get<string>('dataDatabase.type', 'sqlite');
const dbHost = this.configService.get<string>('dataDatabase.host', 'localhost');
```

To:
```typescript
const dbConnected = this.dataSource.isInitialized;
const dbType = 'postgres';
const dbHost = this.configService.get<string>('database.host', 'localhost');
```

- [ ] **Step 3: Update `exportData()` and `importData()` — replace `this.dataDataSource` with `this.dataSource`**

Find all occurrences of `this.dataDataSource` in the file and replace with `this.dataSource`. Also update this line in `exportData()`:
```typescript
dataDbType: this.configService.get<string>('dataDatabase.type', 'sqlite'),
```
→
```typescript
dataDbType: 'postgres',
```

- [ ] **Step 4: Update `SaveConfigDto` — remove `'sqlite'` from database type union**

Change:
```typescript
database?: {
  type: 'sqlite' | 'postgres';
```
To:
```typescript
database?: {
  type: 'postgres';
```

- [ ] **Step 5: Remove the sqlite branch from `saveConfig()`**

In the `saveConfig()` method, the `DATABASE_TYPE` default was `'sqlite'`. Change:
```typescript
envLines.push(`DATABASE_TYPE=${config.database.type || 'sqlite'}`);
```
To:
```typescript
envLines.push(`DATABASE_TYPE=postgres`);
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/infra/infra.controller.ts
git commit -m "refactor: infra controller — single DataSource, postgres-only config"
```

---

## Task 6: Fix main.ts generated config default

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace the SQLite default in the generated `.env.generated` template**

Find this block in `main.ts`:
```typescript
const minimalConfig = `# OpenWA Configuration
# Generated automatically on first run
# Edit via Dashboard > Infrastructure or modify this file directly.
# Note: values in process env or project .env take precedence over this file.

# Database (SQLite - no external service required)
DATABASE_TYPE=sqlite
POSTGRES_BUILTIN=false
...
```

Replace with:
```typescript
const minimalConfig = `# OpenWA Configuration
# Generated automatically on first run
# Edit via Dashboard > Infrastructure or modify this file directly.
# Note: values in process env or project .env take precedence over this file.

# Database (PostgreSQL - set your connection details)
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=
DATABASE_SYNCHRONIZE=false
DATABASE_SSL=true

# Redis & Queue (disabled by default)
REDIS_ENABLED=false
REDIS_BUILTIN=false
QUEUE_ENABLED=false

# Storage (Local filesystem)
STORAGE_TYPE=local
MINIO_BUILTIN=false
STORAGE_PATH=./data/media

# Docker Profiles: none (minimal setup)
`;
```

- [ ] **Step 2: Commit**

```bash
git add src/main.ts
git commit -m "chore: update generated env template to postgres defaults"
```

---

## Task 8: Update docker-compose and env files

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `.env.minimal`

- [ ] **Step 1: Update `docker-compose.yml`**

Change the `DATABASE_TYPE` default from `sqlite` to `postgres`:
```yaml
- DATABASE_TYPE=${DATABASE_TYPE:-postgres}
```

Remove the `DATABASE_NAME` sqlite path default — postgres doesn't use a file path:
```yaml
- DATABASE_NAME=${DATABASE_NAME:-postgres}
```

The optional `postgres:` service block can stay as-is (useful for local dev without Supabase) — just remove the comment that calls it "optional".

- [ ] **Step 2: Replace `.env.example`**

```bash
# =============================================================================
# OpenWA - Environment Configuration
# =============================================================================
# Copy this file to .env and customize as needed.

# =============================================================================
# CORE SETTINGS
# =============================================================================
NODE_ENV=production
API_PORT=2785
LOG_LEVEL=info                      # error | warn | info | debug

DOMAIN=localhost
DASHBOARD_PORT=2886
CORS_ORIGINS=*

# =============================================================================
# DATABASE (PostgreSQL / Supabase)
# =============================================================================
DATABASE_HOST=aws-0-eu-central-1.pooler.supabase.com
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USERNAME=postgres.yourprojectref
DATABASE_PASSWORD=your-db-password
DATABASE_SYNCHRONIZE=false          # WARNING: Never true in production!
DATABASE_LOGGING=false
DATABASE_POOL_SIZE=10
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false   # Required for Supabase pooler

# =============================================================================
# ENGINE CONFIGURATION
# =============================================================================
ENGINE_TYPE=whatsapp-web.js
SESSION_DATA_PATH=./data/sessions
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu

# =============================================================================
# REDIS / QUEUE
# =============================================================================
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379

# =============================================================================
# STORAGE
# =============================================================================
STORAGE_TYPE=s3
S3_ENDPOINT=https://yourprojectref.supabase.co/storage/v1/s3
S3_BUCKET=openwa
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key

# =============================================================================
# WEBHOOK
# =============================================================================
WEBHOOK_TIMEOUT=10000
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=5000

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# =============================================================================
# SECURITY
# =============================================================================
API_MASTER_KEY=
JWT_SECRET=change-me-in-production

# =============================================================================
# DEVELOPER SETTINGS
# =============================================================================
ENABLE_SWAGGER=true
DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001
```

- [ ] **Step 3: Replace `.env.minimal`**

```bash
# ===========================================
# OpenWA - Minimal Configuration (Supabase)
# ===========================================

PORT=2785
NODE_ENV=development

# Database — Supabase PostgreSQL
DATABASE_HOST=aws-0-eu-central-1.pooler.supabase.com
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USERNAME=postgres.yourprojectref
DATABASE_PASSWORD=your-db-password
DATABASE_SYNCHRONIZE=false
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false

# WhatsApp Engine
ENGINE_TYPE=whatsapp-web.js
SESSION_DATA_PATH=./data/sessions
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage

# Webhook
WEBHOOK_TIMEOUT=10000
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=5000

# Storage
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./data/media

# Redis & Queue (disabled)
REDIS_ENABLED=false
QUEUE_ENABLED=false
CACHE_ENABLED=false

# API Security
# API_MASTER_KEY=your-master-api-key-here
JWT_SECRET=change-me-in-development
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example .env.minimal
git commit -m "chore: update docker-compose and env templates to postgres-only"
```

---

## Task 9: Verify TypeScript compiles cleanly

- [ ] **Step 1: Run the TypeScript compiler**

```bash
pnpm tsc --noEmit
```

Expected: no errors. If you see `Cannot find module '../../../common/utils/column-types'` or `'../../../common/transformers/date.transformer'` errors, there are entity files that still import the deleted helpers — fix each one by removing the import and using the literal type string directly.

- [ ] **Step 2: Grep for any remaining sqlite references in `src/`**

```bash
grep -r "sqlite\|simple-json\|dateColumnType\|jsonColumnType\|DateTransformer\|datetime('now')\|INSERT OR IGNORE\|upSqlite\|downSqlite\|dataDatabase\|forFeature.*'main'\|forFeature.*'data'\|InjectDataSource('main')\|InjectDataSource('data')" src/ --include="*.ts" -l
```

Expected: no output. Fix any remaining files.

- [ ] **Step 3: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: final sqlite reference cleanup"
```

---

## Task 10: Smoke-test against Supabase

- [ ] **Step 1: Ensure `.env` has Supabase credentials** (already present from earlier session)

The existing `.env` already has:
```
DATABASE_TYPE=postgres
DATABASE_HOST=aws-1-eu-central-1.pooler.supabase.com
DATABASE_USERNAME=postgres.tftsydnvbfjjbcrtyjjo
DATABASE_PASSWORD=...
DATABASE_SYNCHRONIZE=true
```

- [ ] **Step 2: Start the API**

```bash
pnpm start:dev
```

Expected log lines (no errors):
```
[Bootstrap] Loading .env from: ...
[InstanceLoader] TypeOrmCoreModule dependencies initialized
[NestApplication] Nest application successfully started
```

- [ ] **Step 3: Hit the health endpoint**

```bash
curl http://localhost:2785/api/health
```

Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 4: Hit the infra status endpoint**

```bash
curl -H "X-API-Key: localtest" http://localhost:2785/api/infra/status
```

Expected: `{"database":{"connected":true,"type":"postgres",...}}`
