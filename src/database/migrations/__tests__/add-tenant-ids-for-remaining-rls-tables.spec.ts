import { QueryRunner } from 'typeorm';
import { AddTenantIdsForRemainingRlsTables1779235200002 } from '../1779235200002-AddTenantIdsForRemainingRlsTables';

const createQueryRunner = (type: 'postgres' | 'sqlite'): jest.Mocked<Pick<QueryRunner, 'query' | 'hasTable' | 'hasColumn'>> & {
  connection: { options: { type: 'postgres' | 'sqlite' } };
} => ({
  connection: { options: { type } },
  query: jest.fn(),
  hasTable: jest.fn().mockResolvedValue(true),
  hasColumn: jest.fn().mockResolvedValue(false),
});

describe('AddTenantIdsForRemainingRlsTables1779235200002', () => {
  it('is a no-op for non-Postgres databases', async () => {
    const migration = new AddTenantIdsForRemainingRlsTables1779235200002();
    const queryRunner = createQueryRunner('sqlite');

    await migration.up(queryRunner as unknown as QueryRunner);
    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('adds tenantId and RLS policies to remaining tenant tables', async () => {
    const migration = new AddTenantIdsForRemainingRlsTables1779235200002();
    const queryRunner = createQueryRunner('postgres');
    const tenantColumns = new Set<string>();

    queryRunner.hasColumn.mockImplementation(async (table, column) => tenantColumns.has(`${table}.${column}`));
    queryRunner.query.mockImplementation(async statement => {
      const addColumnMatch = String(statement).match(/ALTER TABLE "([^"]+)" ADD COLUMN "tenantId"/);
      if (addColumnMatch) tenantColumns.add(`${addColumnMatch[1]}.tenantId`);
      return undefined;
    });

    await migration.up(queryRunner as unknown as QueryRunner);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    for (const table of ['sessions', 'webhooks', 'messages', 'api_keys', 'message_batches', 'audit_logs']) {
      expect(sql).toContain(`ALTER TABLE "${table}" ADD COLUMN "tenantId" varchar(36)`);
      expect(sql).toContain(`ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`);
      expect(sql).toContain(`CREATE POLICY "POL_${table}_tenant_isolation"`);
    }
    expect(sql).toContain('FROM "sessions" s');
    expect(sql).toContain('FROM "api_keys" ak');
  });
});
