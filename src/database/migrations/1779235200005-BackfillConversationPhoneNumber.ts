import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillConversationPhoneNumber1779235200005 implements MigrationInterface {
  name = 'BackfillConversationPhoneNumber1779235200005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "conversations"
      SET "phoneNumber" = SPLIT_PART("chatId", '@', 1)
      WHERE "phoneNumber" IS NULL
        AND ("chatId" LIKE '%@c.us' OR "chatId" LIKE '%@lid')
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Backfill is non-destructive; no rollback needed
  }
}
