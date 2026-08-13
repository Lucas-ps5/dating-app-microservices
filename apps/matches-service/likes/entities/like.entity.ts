// entities/like.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from "typeorm";
import { SwipeType } from "../enums/swipe-type.enum";

@Entity("likes")
@Unique(["senderId", "receiverId"])
@Index(["receiverId"])
export class Like {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  senderId!: string;

  @Column({ type: "uuid" })
  receiverId!: string;

  @Column({ type: "enum", enum: SwipeType })
  type!: SwipeType;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: string;
}
