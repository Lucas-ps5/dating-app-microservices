import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";
import { Match } from "./match.entity";

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectRepository(Match)
    private readonly matchesRepo: Repository<Match>,
  ) {}

  /**
   * Upserts the local match projection from a `match.created` event.
   * matches-service is the single source of truth for matching; this table is
   * only used to answer "may these two users talk to each other?".
   */
  async recordMatchFromEvent(
    user1Id: string,
    user2Id: string,
    matchId: string,
  ): Promise<void> {
    const [uid1, uid2] = [user1Id, user2Id].sort();

    const existing = await this.matchesRepo.findOne({
      where: { user1Id: uid1, user2Id: uid2 },
    });

    if (existing) {
      return;
    }

    await this.matchesRepo.save(
      this.matchesRepo.create({
        id: matchId,
        user1Id: uid1,
        user2Id: uid2,
        isActive: true,
      }),
    );

    this.logger.log(`Recorded match ${matchId} between ${uid1} and ${uid2}`);
  }

  async deactivateMatchesForUser(userId: string): Promise<number> {
    const result = await this.matchesRepo.update(
      { user1Id: Not(userId), user2Id: Not(userId) },
      { isActive: false },
    );
    return result.affected ?? 0;
  }

  async areMatched(userA: string, userB: string): Promise<boolean> {
    const [uid1, uid2] = [userA, userB].sort();
    const match = await this.matchesRepo.findOne({
      where: { user1Id: uid1, user2Id: uid2, isActive: true },
    });
    return match !== null;
  }

  async findMatchesForUser(userId: string): Promise<Match[]> {
    return this.matchesRepo
      .createQueryBuilder("match")
      .where("(match.user1Id = :userId OR match.user2Id = :userId)", { userId })
      .andWhere("match.isActive = true")
      .orderBy("match.matchedAt", "DESC")
      .getMany();
  }

  async findMatchById(matchId: string): Promise<Match> {
    const match = await this.matchesRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException(`Match ${matchId} not found`);
    return match;
  }
}
