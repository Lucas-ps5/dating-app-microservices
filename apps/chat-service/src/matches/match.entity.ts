import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
} from "typeorm";

@Entity("matches")
@Unique(["user1Id", "user2Id"])
export class Match {
  /**
   * Local projection of a match owned by matches-service. The id is the
   * match id minted upstream so both services agree on match identity; rows
   * created through this service's own endpoints mint one in the app layer.
   */
  @PrimaryColumn("uuid")
  id: string;

  @Column("uuid")
  @Index()
  user1Id: string;

  @Column("uuid")
  @Index()
  user2Id: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  matchedAt: Date;
}
