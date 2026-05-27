import { MigrationInterface, QueryRunner } from 'typeorm';

const DEFAULT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

export class AddTenantIdsForRemainingRlsTables1779235200002 implements MigrationInterface {
  name = 'AddTenantIdsForRemainingRlsTables1779235200002';

  private readonly tables = ['sessions', 'webhooks', 'messages', 'api_keys', 'message_batches', 'audit_logs'];

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    for (const table of this.tables) {
      await this.addTenantColumn(queryRunner, table);
    }

    await this.backfillTenantIds(queryRunner);

    for (const table of this.tables) {
      await this.enforceTenantColumn(queryRunner, table);
      await this.applyTenantPolicy(queryRunner, table);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    for (const table of [...this.tables].reverse()) {
      if (!(await queryRunner.hasTable(table))) continue;

      await queryRunner.query(`DROP POLICY IF EXISTS "${this.policyName(table)}" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);

      if (await queryRunner.hasColumn(table, 'tenantId')) {
        await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "tenantId"`);
      }
    }
  }

  private async addTenantColumn(queryRunner: QueryRunner, table: string): Promise<void> {
    if (!(await queryRunner.hasTable(table))) return;
    if (await queryRunner.hasColumn(table, 'tenantId')) return;

    await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "tenantId" varchar(36)`);
  }

  private async backfillTenantIds(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasTenantColumn(queryRunner, 'sessions')) {
      await queryRunner.query(`UPDATE "sessions" SET "tenantId" = $1 WHERE "tenantId" IS NULL`, [DEFAULT_ID]);
    }

    if ((await this.hasTenantColumn(queryRunner, 'webhooks')) && (await this.hasTenantColumn(queryRunner, 'sessions'))) {
      await queryRunner.query(
        `
          UPDATE "webhooks" w
          SET "tenantId" = s."tenantId"
          FROM "sessions" s
          WHERE w."sessionId"::text = s.id::text
            AND w."tenantId" IS NULL
        `,
      );
    }

    if ((await this.hasTenantColumn(queryRunner, 'messages')) && (await this.hasTenantColumn(queryRunner, 'sessions'))) {
      await queryRunner.query(
        `
          UPDATE "messages" m
          SET "tenantId" = s."tenantId"
          FROM "sessions" s
          WHERE m."sessionId"::text = s.id::text
            AND m."tenantId" IS NULL
        `,
      );
    }

    if (
      (await this.hasTenantColumn(queryRunner, 'message_batches')) &&
      (await this.hasTenantColumn(queryRunner, 'sessions'))
    ) {
      await queryRunner.query(
        `
          UPDATE "message_batches" mb
          SET "tenantId" = s."tenantId"
          FROM "sessions" s
          WHERE mb."session_id"::text = s.id::text
            AND mb."tenantId" IS NULL
        `,
      );
    }

    if (await this.hasTenantColumn(queryRunner, 'api_keys')) {
      await queryRunner.query(`UPDATE "api_keys" SET "tenantId" = $1 WHERE "tenantId" IS NULL`, [DEFAULT_ID]);
    }

    if ((await this.hasTenantColumn(queryRunner, 'audit_logs')) && (await this.hasTenantColumn(queryRunner, 'sessions'))) {
      await queryRunner.query(
        `
          UPDATE "audit_logs" a
          SET "tenantId" = s."tenantId"
          FROM "sessions" s
          WHERE a."sessionId"::text = s.id::text
            AND a."tenantId" IS NULL
        `,
      );
    }

    if ((await this.hasTenantColumn(queryRunner, 'audit_logs')) && (await this.hasTenantColumn(queryRunner, 'api_keys'))) {
      await queryRunner.query(
        `
          UPDATE "audit_logs" a
          SET "tenantId" = ak."tenantId"
          FROM "api_keys" ak
          WHERE a."apiKeyId"::text = ak.id::text
            AND a."tenantId" IS NULL
        `,
      );
    }

    for (const table of this.tables) {
      if (await this.hasTenantColumn(queryRunner, table)) {
        await queryRunner.query(`UPDATE "${table}" SET "tenantId" = $1 WHERE "tenantId" IS NULL`, [DEFAULT_ID]);
      }
    }
  }

  private async enforceTenantColumn(queryRunner: QueryRunner, table: string): Promise<void> {
    if (!(await this.hasTenantColumn(queryRunner, table))) return;

    await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET DEFAULT '${DEFAULT_ID}'`);
    await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_${table}_tenantId" ON "${table}" ("tenantId")`);
  }

  private async applyTenantPolicy(queryRunner: QueryRunner, table: string): Promise<void> {
    if (!(await this.hasTenantColumn(queryRunner, table))) return;

    await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "${this.policyName(table)}" ON "${table}"`);
    await queryRunner.query(`
      CREATE POLICY "${this.policyName(table)}"
      ON "${table}"
      FOR ALL
      USING ("tenantId"::text = openwa_current_tenant_id())
      WITH CHECK ("tenantId"::text = openwa_current_tenant_id())
    `);
  }

  private async hasTenantColumn(queryRunner: QueryRunner, table: string): Promise<boolean> {
    return (await queryRunner.hasTable(table)) && (await queryRunner.hasColumn(table, 'tenantId'));
  }

  private policyName(table: string): string {
    return `POL_${table}_tenant_isolation`;
  }
}
