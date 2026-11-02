import { MigrationInterface, QueryRunner } from "typeorm";

export class TypeNotificationType1762120002000 implements MigrationInterface {
  name = "TypeNotificationType1762120002000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum'
        ) THEN
          CREATE TYPE "notification_type_enum" AS ENUM ('PROFILE_VISITED', 'NEW_MATCH');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ALTER COLUMN "type" TYPE "notification_type_enum"
      USING "type"::text::"notification_type_enum"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ALTER COLUMN "type" TYPE varchar
      USING "type"::text
    `);
  }
}
