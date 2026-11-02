import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddNotificationSource1762120001000
  implements MigrationInterface
{
  name = "AddNotificationSource1762120001000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn("notifications", "sourceId"))) {
      await queryRunner.addColumn(
        "notifications",
        new TableColumn({
          name: "sourceId",
          type: "varchar",
          isNullable: true,
        }),
      );
    }

    const table = await queryRunner.getTable("notifications");
    if (
      table &&
      !table.indices.some(
        (index) =>
          index.name === "IDX_notifications_recipientId_type_sourceId_unique",
      )
    ) {
      await queryRunner.createIndex(
        "notifications",
        new TableIndex({
          name: "IDX_notifications_recipientId_type_sourceId_unique",
          columnNames: ["recipientId", "type", "sourceId"],
          isUnique: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("notifications");
    const index = table?.indices.find(
      (item) =>
        item.name === "IDX_notifications_recipientId_type_sourceId_unique",
    );
    if (index) {
      await queryRunner.dropIndex(
        "notifications",
        "IDX_notifications_recipientId_type_sourceId_unique",
      );
    }
    if (await queryRunner.hasColumn("notifications", "sourceId")) {
      await queryRunner.dropColumn("notifications", "sourceId");
    }
  }
}
