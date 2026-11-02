import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum NotificationType {
  PROFILE_VISITED = "PROFILE_VISITED",
  NEW_MATCH = "NEW_MATCH",
}

@Entity("notifications")
@Index(["recipientId", "readAt"])
@Index(["recipientId", "type", "sourceId"], { unique: true })
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "varchar" })
  recipientId!: string;

  @Column({ type: "varchar" })
  actorId?: string;

  @Column({
    type: "enum",
    enum: NotificationType,
    enumName: "notification_type_enum",
  })
  type!: NotificationType;

  @Index()
  @Column({ type: "varchar", nullable: true })
  sourceId?: string | null;

  @Column({ type: "jsonb", default: () => "'{}'" })
  data!: Record<string, unknown>;

  @Column({ type: "timestamptz", nullable: true })
  readAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt?: Date;
}
