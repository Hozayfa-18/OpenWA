import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationContactFields1779235200004
  implements MigrationInterface
{
  name = 'AddConversationContactFields1779235200004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations"
        ADD COLUMN IF NOT EXISTS "phoneNumber" VARCHAR,
        ADD COLUMN IF NOT EXISTS "contactName" VARCHAR
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "contactName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP COLUMN IF EXISTS "phoneNumber"`,
    );
  }
}
