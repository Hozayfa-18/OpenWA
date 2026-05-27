import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversations1748430000000 implements MigrationInterface {
  name = 'AddConversations1748430000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const isSQLite = queryRunner.connection.options.type === 'sqlite';

    if (isSQLite) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "conversations" (
          "tenantId"       VARCHAR NOT NULL,
          "sessionId"      VARCHAR NOT NULL,
          "chatId"         VARCHAR NOT NULL,
          "contactId"      VARCHAR,
          "assignedUserId" VARCHAR,
          "lastMessageId"  VARCHAR NOT NULL DEFAULT '',
          "lastMessageAt"  TEXT NOT NULL DEFAULT '',
          "unreadCount"    INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY ("tenantId", "sessionId", "chatId")
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_conv_tenant_time"
          ON "conversations" ("tenantId", "lastMessageAt")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_conv_tenant_assigned"
          ON "conversations" ("tenantId", "assignedUserId")
      `);
      return;
    }

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
