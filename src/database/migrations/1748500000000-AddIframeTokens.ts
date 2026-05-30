import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIframeTokens1748500000000 implements MigrationInterface {
  name = 'AddIframeTokens1748500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const isSQLite = queryRunner.connection.options.type === 'sqlite';

    if (isSQLite) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "iframe_tokens" (
          "id"               VARCHAR   NOT NULL,
          "tenantId"         VARCHAR   NOT NULL,
          "crmUserId"        VARCHAR   NOT NULL,
          "crmUserName"      VARCHAR,
          "scope"            VARCHAR   NOT NULL DEFAULT 'global',
          "filter"           TEXT,
          "activeChat"       TEXT,
          "useDealsEvents"   INTEGER   NOT NULL DEFAULT 0,
          "useMessageEvents" INTEGER   NOT NULL DEFAULT 0,
          "expiresAt"        TEXT      NOT NULL,
          "createdAt"        DATETIME  NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_iframe_tenant_expires"
          ON "iframe_tokens" ("tenantId", "expiresAt")
      `);
    } else {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "iframe_tokens" (
          "id"               UUID      NOT NULL DEFAULT gen_random_uuid(),
          "tenantId"         VARCHAR   NOT NULL,
          "crmUserId"        VARCHAR   NOT NULL,
          "crmUserName"      VARCHAR,
          "scope"            VARCHAR   NOT NULL DEFAULT 'global',
          "filter"           JSONB,
          "activeChat"       JSONB,
          "useDealsEvents"   BOOLEAN   NOT NULL DEFAULT false,
          "useMessageEvents" BOOLEAN   NOT NULL DEFAULT false,
          "expiresAt"        TIMESTAMP NOT NULL,
          "createdAt"        TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT "PK_iframe_tokens" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_iframe_tenant_expires"
          ON "iframe_tokens" ("tenantId", "expiresAt")
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_iframe_tenant_expires"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "iframe_tokens"`);
  }
}
