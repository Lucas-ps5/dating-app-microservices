import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMediaOutboxEvents1710000000000 implements MigrationInterface {
  name = "CreateMediaOutboxEvents1710000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "media_outbox_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "topic" character varying(255) NOT NULL,
        "payload" jsonb NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "publishedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_media_outbox_pending"
      ON "media_outbox_events" ("createdAt")
      WHERE "publishedAt" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "media_outbox_events"`);
  }
}