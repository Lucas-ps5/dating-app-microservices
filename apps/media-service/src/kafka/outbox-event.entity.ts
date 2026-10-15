import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("media_outbox_events")
@Index("IDX_media_outbox_pending", ["createdAt"], {
  where: '"publishedAt" IS NULL',
})
export class MediaOutboxEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  topic!: string;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  publishedAt!: Date | null;
}