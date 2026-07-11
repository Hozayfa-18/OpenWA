import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add Clerk identity linkage: tenants.clerkOrgId, users.clerkUserId, and make
 * users.passwordHash nullable (Clerk owns credentials for dashboard users).
 * Idempotent for Postgres via IF NOT EXISTS in case DATABASE_SYNCHRONIZE already
 * added the entity columns.
 */
export class AddClerkIdentity1781000000000 implements MigrationInterface {
  name = 'AddClerkIdentity1781000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const isSQLite = queryRunner.connection.options.type === 'sqlite';
    const ine = isSQLite ? '' : 'IF NOT EXISTS ';

    await queryRunner.query(`ALTER TABLE "tenants" ADD COLUMN ${ine}"clerkOrgId" VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN ${ine}"clerkUserId" VARCHAR(255)`);

    if (!isSQLite) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenants_clerkOrgId" ON "tenants" ("clerkOrgId")`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_clerkUserId" ON "users" ("clerkUserId")`,
      );
      await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const isSQLite = queryRunner.connection.options.type === 'sqlite';
    if (isSQLite) return;
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_clerkUserId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenants_clerkOrgId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "clerkUserId"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "clerkOrgId"`);
    // passwordHash left nullable — not reverted, to avoid failing on existing null rows.
  }
}
