import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
const DEFAULT_SLUG = 'default';
const DEFAULT_NAME = process.env.DEFAULT_TENANT_NAME || 'Default Tenant';
const LEGACY = 'legacy';

export class AddTenantFoundation1748390000000 implements MigrationInterface {
  name = 'AddTenantFoundation1748390000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const isPg = queryRunner.connection.options.type === 'postgres';
    if (isPg) {
      await this.upPostgres(queryRunner);
    } else {
      await this.upSqlite(queryRunner);
    }

    // Shared: create default tenant row (idempotent via INSERT OR IGNORE / ON CONFLICT)
    if (isPg) {
      await queryRunner.query(
        `INSERT INTO tenants (id, name, slug, plan, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'free', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [DEFAULT_ID, DEFAULT_NAME, DEFAULT_SLUG],
      );
    } else {
      await queryRunner.query(
        `INSERT OR IGNORE INTO tenants (id, name, slug, plan, createdAt, updatedAt)
         VALUES (?, ?, ?, 'free', datetime('now'), datetime('now'))`,
        [DEFAULT_ID, DEFAULT_NAME, DEFAULT_SLUG],
      );
    }

    // Back-fill legacy rows
    if (isPg) {
      await queryRunner.query(`UPDATE sessions SET "tenantId" = $1 WHERE "tenantId" = '${LEGACY}'`, [DEFAULT_ID]);
      await queryRunner.query(`UPDATE webhooks SET "tenantId" = $1 WHERE "tenantId" = '${LEGACY}'`, [DEFAULT_ID]);
      await queryRunner.query(`UPDATE messages SET "tenantId" = $1 WHERE "tenantId" = '${LEGACY}'`, [DEFAULT_ID]);
    } else {
      await queryRunner.query(`UPDATE sessions SET tenantId = ? WHERE tenantId = '${LEGACY}'`, [DEFAULT_ID]);
      await queryRunner.query(`UPDATE webhooks SET tenantId = ? WHERE tenantId = '${LEGACY}'`, [DEFAULT_ID]);
      await queryRunner.query(`UPDATE messages SET tenantId = ? WHERE tenantId = '${LEGACY}'`, [DEFAULT_ID]);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const isPg = queryRunner.connection.options.type === 'postgres';
    if (isPg) {
      await this.downPostgres(queryRunner);
    } else {
      await this.downSqlite(queryRunner);
    }
  }

  // ── PostgreSQL ──────────────────────────────────────────────────────

  private async upPostgres(queryRunner: QueryRunner): Promise<void> {
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
  }

  private async downPostgres(queryRunner: QueryRunner): Promise<void> {
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

  // ── SQLite ──────────────────────────────────────────────────────────

  private async upSqlite(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenants (
        id varchar PRIMARY KEY NOT NULL,
        name varchar(100) NOT NULL,
        slug varchar(100) NOT NULL UNIQUE,
        plan varchar(50) NOT NULL DEFAULT 'free',
        createdAt datetime NOT NULL DEFAULT (datetime('now')),
        updatedAt datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id varchar PRIMARY KEY NOT NULL,
        tenantId varchar(36) NOT NULL,
        email varchar(255) NOT NULL,
        passwordHash varchar(60) NOT NULL,
        name varchar(100) NOT NULL,
        role varchar(30) NOT NULL DEFAULT 'sales_rep',
        createdAt datetime NOT NULL DEFAULT (datetime('now')),
        updatedAt datetime NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tenantId, email)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_tenantId" ON users (tenantId)`);

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id varchar PRIMARY KEY NOT NULL,
        userId varchar(36) NOT NULL,
        tenantId varchar(36) NOT NULL,
        tokenHash varchar(64) NOT NULL UNIQUE,
        isActive boolean NOT NULL DEFAULT (1),
        expiresAt datetime,
        createdAt datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_userId" ON refresh_tokens (userId)`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_tenantId" ON refresh_tokens (tenantId)`);

    await queryRunner.query(`ALTER TABLE sessions ADD COLUMN tenantId varchar(36) NOT NULL DEFAULT '${LEGACY}'`);
    await queryRunner.query(`ALTER TABLE webhooks ADD COLUMN tenantId varchar(36) NOT NULL DEFAULT '${LEGACY}'`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN tenantId varchar(36) NOT NULL DEFAULT '${LEGACY}'`);
    await queryRunner.query(`CREATE INDEX "IDX_sessions_tenantId" ON sessions (tenantId)`);
    await queryRunner.query(`CREATE INDEX "IDX_webhooks_tenantId" ON webhooks (tenantId)`);
    await queryRunner.query(`CREATE INDEX "IDX_messages_tenantId" ON messages (tenantId)`);
  }

  private async downSqlite(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_tenantId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_webhooks_tenantId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sessions_tenantId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_tokens_tenantId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_tokens_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_tenantId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
    // Note: tenantId columns on sessions/webhooks/messages cannot be removed in SQLite without full table rebuild.
  }
}
