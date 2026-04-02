import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  GIF = "gif",
}

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  @Index()
  matchId: string;

  @Column()
  senderId: string;

  @Column({ type: "text" })
  content: string;

  @Column({
    type: "enum",
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @CreateDateColumn()
  sentAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  readAt: Date | null;
}
