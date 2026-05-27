import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRlsForConversations1779235200003 implements MigrationInterface {
  name = 'AddRlsForConversations1779235200003';

  private readonly table = 'conversations';
  private readonly policyName = `POL_${this.table}_tenant_isolation`;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    if (!(await queryRunner.hasTable(this.table))) return;

    await queryRunner.query(`ALTER TABLE "${this.table}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`DROP POLICY IF EXISTS "${this.policyName}" ON "${this.table}"`);
    await queryRunner.query(`
      CREATE POLICY "${this.policyName}"
      ON "${this.table}"
      FOR ALL
      USING ("tenantId"::text = openwa_current_tenant_id())
      WITH CHECK ("tenantId"::text = openwa_current_tenant_id())
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return;

    if (!(await queryRunner.hasTable(this.table))) return;

    await queryRunner.query(`DROP POLICY IF EXISTS "${this.policyName}" ON "${this.table}"`);
    await queryRunner.query(`ALTER TABLE "${this.table}" DISABLE ROW LEVEL SECURITY`);
  }
}
