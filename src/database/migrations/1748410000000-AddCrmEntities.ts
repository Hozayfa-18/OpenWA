import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmEntities1748410000000 implements MigrationInterface {
  name = 'AddCrmEntities1748410000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE crm_contacts (
        id varchar(36) NOT NULL,
        "tenantId" varchar(36) NOT NULL,
        name varchar(255) NOT NULL,
        "responsibleUserId" varchar(36),
        "contactData" jsonb NOT NULL DEFAULT '[]',
        uri varchar(2048),
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_crm_contacts" PRIMARY KEY ("tenantId", id)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_contacts_tenantId" ON crm_contacts ("tenantId")`);

    await queryRunner.query(`
      CREATE TABLE crm_deals (
        id varchar(36) NOT NULL,
        "tenantId" varchar(36) NOT NULL,
        name varchar(255) NOT NULL,
        "responsibleUserId" varchar(36),
        "contactIds" jsonb NOT NULL DEFAULT '[]',
        closed boolean NOT NULL DEFAULT false,
        uri varchar(2048),
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_crm_deals" PRIMARY KEY ("tenantId", id)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_deals_tenantId" ON crm_deals ("tenantId")`);

    await queryRunner.query(`
      CREATE TABLE crm_users (
        id varchar(36) NOT NULL,
        "tenantId" varchar(36) NOT NULL,
        name varchar(100) NOT NULL,
        email varchar(255),
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_crm_users" PRIMARY KEY ("tenantId", id)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_users_tenantId" ON crm_users ("tenantId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_crm_users_tenantId"`);
    await queryRunner.query(`DROP TABLE crm_users`);
    await queryRunner.query(`DROP INDEX "IDX_crm_deals_tenantId"`);
    await queryRunner.query(`DROP TABLE crm_deals`);
    await queryRunner.query(`DROP INDEX "IDX_crm_contacts_tenantId"`);
    await queryRunner.query(`DROP TABLE crm_contacts`);
  }
}
