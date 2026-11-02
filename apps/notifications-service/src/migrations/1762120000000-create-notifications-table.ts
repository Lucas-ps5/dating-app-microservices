import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";
import { NotificationType } from "../notifications/notification.entity";

export class CreateNotificationsTable1762120000000
  implements MigrationInterface
{
  name = "CreateNotificationsTable1762120000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "notification_type_enum" AS ENUM ('${NotificationType.PROFILE_VISITED}', '${NotificationType.NEW_MATCH}')`,
    );
    await queryRunner.createTable(
      new Table({
        name: "notifications",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "gen_random_uuid()",
          },
          { name: "recipientId", type: "varchar", isNullable: false },
          { name: "actorId", type: "varchar", isNullable: false },
          {
            name: "type",
            type: '"notification_type_enum"',
            isNullable: false,
          },
          { name: "sourceId", type: "varchar", isNullable: true },
          {
            name: "data",
            type: "jsonb",
            isNullable: false,
            default: "'{}'",
          },
          { name: "readAt", type: "timestamptz", isNullable: true },
          {
            name: "createdAt",
            type: "timestamptz",
            default: "now()",
          },
          {
            name: "updatedAt",
            type: "timestamptz",
            default: "now()",
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      "notifications",
      new TableIndex({
        name: "IDX_notifications_recipientId",
        columnNames: ["recipientId"],
      }),
    );
    await queryRunner.createIndex(
      "notifications",
      new TableIndex({
        name: "IDX_notifications_recipientId_readAt",
        columnNames: ["recipientId", "readAt"],
      }),
    );
    await queryRunner.createIndex(
      "notifications",
      new TableIndex({
        name: "IDX_notifications_recipientId_type_sourceId_unique",
        columnNames: ["recipientId", "type", "sourceId"],
        isUnique: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("notifications", true);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
  }
}
