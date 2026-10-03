import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Conversation } from "./conversation.entity";

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  GIF = "gif",
}

export enum MessageStatus {
  UNREAD = "UNREAD",
  READ = "READ",
}

@Entity("messages")
@Index(["conversationId", "createdAt"]) // Crucial for loading chat history fast
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // --- NEW RELATION ---
  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: "CASCADE", // If conversation deletes, delete messages too
  })
  @JoinColumn({ name: "conversationId" })
  conversation: Conversation;

  @Column("uuid")
  conversationId: string; // The actual foreign key column in the DB
  // ---------------------

  @Column("uuid")
  @Index()
  senderId: string;

  @Column("uuid")
  @Index()
  receiverId: string; // Still useful for fast unread count queries

  @Column({ type: "text" })
  content: string;

  @Column({
    type: "enum",
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({
    type: "enum",
    enum: MessageStatus,
    default: MessageStatus.UNREAD,
  })
  status: MessageStatus;

  @CreateDateColumn()
  sentAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  readAt: Date | null;
}
