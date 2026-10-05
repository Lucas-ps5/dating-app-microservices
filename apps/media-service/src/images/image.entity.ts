import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("images")
@Index("IDX_images_imageName", ["imageName"])
export class Image {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * The MinIO object key, e.g. "profile-photo/<uuid>.jpg". This is a path,
   * not a uuid, so it must not be typed as one — Postgres rejects the insert
   * otherwise.
   */
  @Column({ type: "varchar", length: 512 })
  imageName: string;

  @Column({ type: "varchar", length: 255 })
  originalName: string;

  @Column({ type: "varchar", length: 100 })
  imageType: string;

  @Column({ type: "bigint" })
  imageSize: number;

  @Column({ type: "text" })
  imageUrl: string;

  /** Owner of the object, used to authorise delete and presign requests. */
  @Index("IDX_images_ownerId")
  @Column({ type: "uuid" })
  ownerId: string;

  /** Usage context, e.g. "profile-photo" or "message-image". */
  @Column({ type: "varchar", length: 64, default: "general" })
  context: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
