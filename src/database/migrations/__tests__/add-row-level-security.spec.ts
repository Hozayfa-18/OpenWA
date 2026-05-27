import { QueryRunner } from 'typeorm';
import { AddRowLevelSecurity1779235200001 } from '../1779235200001-AddRowLevelSecurity';

const createQueryRunner = (type: 'postgres' | 'sqlite'): jest.Mocked<Pick<QueryRunner, 'query' | 'hasTable' | 'hasColumn'>> & {
  connection: { options: { type: 'postgres' | 'sqlite' } };
} => ({
  connection: { options: { type } },
  query: jest.fn(),
  hasTable: jest.fn().mockResolvedValue(true),
  hasColumn: jest.fn().mockResolvedValue(true),
});

describe('AddRowLevelSecurity1779235200001', () => {
  it('is a no-op for non-Postgres databases', async () => {
    const migration = new AddRowLevelSecurity1779235200001();
    const queryRunner = createQueryRunner('sqlite');

    await migration.up(queryRunner as unknown as QueryRunner);
    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).not.toHaveBeenCalled();
    expect(queryRunner.hasTable).not.toHaveBeenCalled();
    expect(queryRunner.hasColumn).not.toHaveBeenCalled();
  });

  it('enables RLS and creates tenant policies for tenant-owned tables', async () => {
    const migration = new AddRowLevelSecurity1779235200001();
    const queryRunner = createQueryRunner('postgres');

    await migration.up(queryRunner as unknown as QueryRunner);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION openwa_current_tenant_id()');
    expect(sql).toContain('ALTER TABLE "users" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE POLICY "POL_users_tenant_isolation"');
    expect(sql).toContain('"tenantId"::text = openwa_current_tenant_id()');
    expect(sql).toContain('CREATE POLICY "POL_tenants_tenant_isolation"');
    expect(sql).toContain('id::text = openwa_current_tenant_id()');
    expect(sql).toContain('CREATE POLICY "POL_message_batches_tenant_isolation"');
    expect(sql).toMatch(/EXISTS\s*\(\s*SELECT 1\s*FROM "sessions" s/);
  });

  it('drops policies before disabling RLS', async () => {
    const migration = new AddRowLevelSecurity1779235200001();
    const queryRunner = createQueryRunner('postgres');

    await migration.down(queryRunner as unknown as QueryRunner);

    const statements = queryRunner.query.mock.calls.map(([statement]) => statement);
    const dropPolicyIndex = statements.findIndex(statement =>
      statement.includes('DROP POLICY IF EXISTS "POL_users_tenant_isolation"'),
    );
    const disableRlsIndex = statements.findIndex(statement =>
      statement.includes('ALTER TABLE "users" DISABLE ROW LEVEL SECURITY'),
    );

    expect(dropPolicyIndex).toBeGreaterThanOrEqual(0);
    expect(disableRlsIndex).toBeGreaterThan(dropPolicyIndex);
    expect(statements.at(-1)).toContain('DROP FUNCTION IF EXISTS openwa_current_tenant_id()');
  });
});
