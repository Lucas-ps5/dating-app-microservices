import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1760490000000 implements MigrationInterface {
  name = "CreateUsersTable1760490000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_gender_enum" AS ENUM ('male', 'female');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY,
        "email" varchar NOT NULL,
        "username" varchar NOT NULL,
        "title" varchar(255),
        "bio" varchar(500),
        "birthdate" date,
        "gender" "users_gender_enum" NOT NULL,
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "city" varchar,
        "country" varchar,
        "photos" text[] NOT NULL DEFAULT '{}',
        "preferences" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_discover"
      ON "users" ("isActive", "gender", "birthdate")
    `);
  }

  down(_queryRunner: QueryRunner): Promise<void> {
    void _queryRunner;
    return Promise.resolve();
  }
}
