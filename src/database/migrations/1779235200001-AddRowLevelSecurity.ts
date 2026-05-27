import { MigrationInterface, QueryRunner } from 'typeorm';

const TENANT_SETTING = 'openwa.tenant_id';

export class AddRowLevelSecurity1779235200001 implements MigrationInterface {
  name = 'AddRowLevelSecurity1779235200001';

  private readonly tenantColumnTables = [
    'users',
    'refresh_tokens',
    'sessions',
    'webhooks',
    'messages',
    'crm_contacts',
    'crm_deals',
    'crm_users',
  ];

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION openwa_current_tenant_id()
      RETURNS text
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('${TENANT_SETTING}', true), '')
      $$
    `);

    await this.applyPolicyIfTableExists(queryRunner, 'tenants', 'id::text = openwa_current_tenant_id()');

    for (const table of this.tenantColumnTables) {
      await this.applyTenantColumnPolicy(queryRunner, table);
    }

    await this.applyOptionalTenantColumnPolicy(queryRunner, 'api_keys');
    await this.applyMessageBatchesPolicy(queryRunner);
    await this.applyAuditLogsPolicy(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    await this.dropPolicyIfTableExists(queryRunner, 'audit_logs');
    await this.dropPolicyIfTableExists(queryRunner, 'message_batches');
    await this.dropPolicyIfTableExists(queryRunner, 'api_keys');

    for (const table of [...this.tenantColumnTables].reverse()) {
      await this.dropPolicyIfTableExists(queryRunner, table);
    }

    await this.dropPolicyIfTableExists(queryRunner, 'tenants');
    await queryRunner.query(`DROP FUNCTION IF EXISTS openwa_current_tenant_id()`);
  }

  private async applyTenantColumnPolicy(queryRunner: QueryRunner, table: string): Promise<void> {
    await this.applyOptionalTenantColumnPolicy(queryRunner, table);
  }

  private async applyOptionalTenantColumnPolicy(queryRunner: QueryRunner, table: string): Promise<void> {
    if (!(await queryRunner.hasTable(table))) return;
    if (!(await queryRunner.hasColumn(table, 'tenantId'))) return;

    await this.applyPolicy(queryRunner, table, `"tenantId"::text = openwa_current_tenant_id()`);
  }

  private async applyMessageBatchesPolicy(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('message_batches'))) return;
    if (!(await queryRunner.hasTable('sessions'))) return;
    if (!(await queryRunner.hasColumn('sessions', 'tenantId'))) return;

    const condition = `
      EXISTS (
        SELECT 1
        FROM "sessions" s
        WHERE s.id::text = "message_batches"."session_id"::text
          AND s."tenantId"::text = openwa_current_tenant_id()
      )
    `;

    await this.applyPolicy(queryRunner, 'message_batches', condition);
  }

  private async applyAuditLogsPolicy(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('audit_logs'))) return;

    const conditions: string[] = [];

    if ((await queryRunner.hasTable('sessions')) && (await queryRunner.hasColumn('sessions', 'tenantId'))) {
      conditions.push(`
        (
          "audit_logs"."sessionId" IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM "sessions" s
            WHERE s.id::text = "audit_logs"."sessionId"::text
              AND s."tenantId"::text = openwa_current_tenant_id()
          )
        )
      `);
    }

    if ((await queryRunner.hasTable('api_keys')) && (await queryRunner.hasColumn('api_keys', 'tenantId'))) {
      conditions.push(`
        (
          "audit_logs"."apiKeyId" IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM "api_keys" ak
            WHERE ak.id::text = "audit_logs"."apiKeyId"::text
              AND ak."tenantId"::text = openwa_current_tenant_id()
          )
        )
      `);
    }

    if (conditions.length === 0) return;

    await this.applyPolicy(queryRunner, 'audit_logs', conditions.join(' OR '));
  }

  private async applyPolicyIfTableExists(queryRunner: QueryRunner, table: string, condition: string): Promise<void> {
    if (!(await queryRunner.hasTable(table))) return;
    await this.applyPolicy(queryRunner, table, condition);
  }

  private async applyPolicy(queryRunner: QueryRunner, table: string, condition: string): Promise<void> {
    const policyName = this.policyName(table);

    await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "${policyName}" ON "${table}"`);
    await queryRunner.query(`
      CREATE POLICY "${policyName}"
      ON "${table}"
      FOR ALL
      USING (${condition})
      WITH CHECK (${condition})
    `);
  }

  private async dropPolicyIfTableExists(queryRunner: QueryRunner, table: string): Promise<void> {
    if (!(await queryRunner.hasTable(table))) return;

    await queryRunner.query(`DROP POLICY IF EXISTS "${this.policyName(table)}" ON "${table}"`);
    await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
  }

  private policyName(table: string): string {
    return `POL_${table}_tenant_isolation`;
  }
}
