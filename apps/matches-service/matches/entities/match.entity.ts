import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity("matches")
@Unique(["user1Id", "user2Id"])
export class Match {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  @Index()
  user1Id!: string;

  @Column({ type: "uuid" })
  @Index()
  user2Id!: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  matchedAt!: Date;
}
