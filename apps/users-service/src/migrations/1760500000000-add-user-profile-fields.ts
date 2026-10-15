import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfileFields1760500000000 implements MigrationInterface {
  name = "AddUserProfileFields1760500000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "users_relationship_type_enum" AS ENUM (
        'DISCREET_RELATIONSHIP', 'ENHANCED_FRIENDSHIP', 'ONE_ON_ONE_SEX',
        'ONE_NIGHT_STAND', 'EXPERIMENTING', 'EROTIC_FANTASIES'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "users_sexual_interest_enum" AS ENUM (
        'ROLEPLAY', 'BDSM', 'SENSORY_PLAY', 'VOYEURISM_EXHIBITIONISM',
        'SWINGING', 'GROUP_EXPERIENCES', 'TANTRA', 'POWER_EXCHANGE', 'OTHER'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "users_has_children_enum" AS ENUM (
        'NO', 'YES_LIVING_WITH_ME', 'YES_NOT_LIVING_WITH_ME', 'PREFER_NOT_TO_SAY'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "users_wants_children_enum" AS ENUM (
        'YES', 'NO', 'MAYBE', 'PREFER_NOT_TO_SAY'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "users_profile_visibility_enum" AS ENUM (
        'PUBLIC', 'MATCHES_ONLY', 'HIDDEN'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "heightCm" integer,
        ADD COLUMN IF NOT EXISTS "languagesSpoken" text[] NOT NULL DEFAULT '{}',
        ADD CONSTRAINT "CHK_users_height_cm"
          CHECK ("heightCm" IS NULL OR "heightCm" BETWEEN 120 AND 250),
        ADD CONSTRAINT "CHK_users_languages_spoken"
          CHECK (array_position("languagesSpoken", NULL) IS NULL
            AND array_to_string("languagesSpoken", ',') ~ '^([a-z]{2})(,[a-z]{2})*$|^$')
    `);
    await queryRunner.query(`
      CREATE TABLE "user_sensitive_profiles" (
        "userId" uuid PRIMARY KEY,
        "relationshipTypesSought" "users_relationship_type_enum"[],
        "sexualInterests" "users_sexual_interest_enum"[],
        "fantasiesText" text,
        "hasChildren" "users_has_children_enum",
        "wantsChildren" "users_wants_children_enum",
        "relationshipTypesSoughtVisibility" "users_profile_visibility_enum" NOT NULL DEFAULT 'HIDDEN',
        "sexualInterestsVisibility" "users_profile_visibility_enum" NOT NULL DEFAULT 'HIDDEN',
        "fantasiesTextVisibility" "users_profile_visibility_enum" NOT NULL DEFAULT 'HIDDEN',
        "hasChildrenVisibility" "users_profile_visibility_enum" NOT NULL DEFAULT 'HIDDEN',
        "wantsChildrenVisibility" "users_profile_visibility_enum" NOT NULL DEFAULT 'HIDDEN',
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_user_sensitive_profiles_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_user_sensitive_relationship_types"
          CHECK ("relationshipTypesSought" IS NULL OR cardinality("relationshipTypesSought") > 0),
        CONSTRAINT "CHK_user_sensitive_fantasies_ciphertext_length"
          CHECK ("fantasiesText" IS NULL OR char_length("fantasiesText") <= 2000)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_languages_spoken_gin"
      ON "users" USING GIN ("languagesSpoken")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_height_cm"
      ON "users" ("heightCm") WHERE "heightCm" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sensitive_relationship_types_gin"
      ON "user_sensitive_profiles" USING GIN ("relationshipTypesSought")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sensitive_sexual_interests_gin"
      ON "user_sensitive_profiles" USING GIN ("sexualInterests")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sensitive_profiles"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_languages_spoken_gin"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_height_cm"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_users_languages_spoken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "CHK_users_height_cm"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "languagesSpoken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "heightCm"`,
    );
    await queryRunner.query(`DROP TYPE "users_profile_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "users_wants_children_enum"`);
    await queryRunner.query(`DROP TYPE "users_has_children_enum"`);
    await queryRunner.query(`DROP TYPE "users_sexual_interest_enum"`);
    await queryRunner.query(`DROP TYPE "users_relationship_type_enum"`);
  }
}
