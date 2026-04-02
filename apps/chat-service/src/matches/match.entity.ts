import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from "typeorm";

@Entity("matches")
@Unique(["user1Id", "user2Id"])
export class Match {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  @Index()
  user1Id: string;

  @Column()
  @Index()
  user2Id: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  matchedAt: Date;
}
