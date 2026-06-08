import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-002 / ADR-006 — add reversible (AES-256-GCM) storage + rotation fields to
 * api_keys so a tenant key can be re-displayed and rotated. Existing rows keep
 * NULL ciphertext (hash-only) and must be rotated to become revealable.
 */
export class AddApiKeyEncryption1780000000000 implements MigrationInterface {
  name = 'AddApiKeyEncryption1780000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const isSQLite = queryRunner.connection.options.type === 'sqlite';
    const ts = isSQLite ? 'DATETIME' : 'TIMESTAMP';
    const uuid = isSQLite ? 'VARCHAR' : 'UUID';
    // Postgres supports ADD COLUMN IF NOT EXISTS — keeps this idempotent in case
    // DATABASE_SYNCHRONIZE already added the entity columns. SQLite does not, so
    // fall back to a plain ADD COLUMN there.
    const ine = isSQLite ? '' : 'IF NOT EXISTS ';

    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN ${ine}"keyCiphertext" TEXT`);
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN ${ine}"keyIv" VARCHAR(32)`);
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN ${ine}"keyAuthTag" VARCHAR(32)`);
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN ${ine}"keyEncVersion" INTEGER`);
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN ${ine}"rotatedFrom" ${uuid}`);
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN ${ine}"rotatedAt" ${ts}`);
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN ${ine}"gracePeriodEndsAt" ${ts}`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite (older) cannot DROP COLUMN; guard for Postgres which is the prod target.
    const isSQLite = queryRunner.connection.options.type === 'sqlite';
    if (isSQLite) return;
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "gracePeriodEndsAt"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "rotatedAt"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "rotatedFrom"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "keyEncVersion"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "keyAuthTag"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "keyIv"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "keyCiphertext"`);
  }
}
