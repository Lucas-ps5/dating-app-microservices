import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Message } from "./message.entity";

@Entity("conversations")
// THE GOLDEN RULE: This unique compound index prevents duplicate 1-on-1 chats!
@Index(["user1Id", "user2Id"], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // We don't use @ManyToOne to User here to keep the chat-service
  // decoupled from the user-service in a microservice architecture.
  @Index()
  @Column("uuid")
  user1Id: string;

  @Index()
  @Column("uuid")
  user2Id: string;

  // Optional but HIGHLY recommended for performance.
  // When fetching the user's "inbox" list, you don't want to join the messages
  // table just to find out what the last message was.
  @Column({ type: "text", nullable: true })
  lastMessagePreview: string;

  // Same here: sort the inbox by this column instead of joining messages.
  @Column({ type: "timestamptz", nullable: true })
  lastMessageSentAt: Date;

  // The One-to-Many relation
  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @Column({ type: "int", default: 0 })
  unreadCountUser1: number;

  @Column({ type: "int", default: 0 })
  unreadCountUser2: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
