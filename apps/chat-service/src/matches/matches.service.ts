import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Match } from "./match.entity";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import { KAFKA_TOPICS } from "@app/common";

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectRepository(Match)
    private readonly matchesRepo: Repository<Match>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async createMatch(user1Id: string, user2Id: string): Promise<Match> {
    // Normalise order so (A,B) and (B,A) collapse to the same row
    const [uid1, uid2] = [user1Id, user2Id].sort();

    const existing = await this.matchesRepo.findOne({
      where: { user1Id: uid1, user2Id: uid2 },
    });
    if (existing) {
      throw new ConflictException("Match already exists");
    }

    const match = this.matchesRepo.create({ user1Id: uid1, user2Id: uid2 });
    const saved = await this.matchesRepo.save(match);

    await this.kafkaProducer.emit(KAFKA_TOPICS.MATCH_CREATED, {
      matchId: saved.id,
      user1Id: uid1,
      user2Id: uid2,
      matchedAt: saved.matchedAt.toISOString(),
    });

    this.logger.log(`Created match ${saved.id} between ${uid1} and ${uid2}`);
    return saved;
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

  async validateParticipant(matchId: string, userId: string): Promise<Match> {
    const match = await this.findMatchById(matchId);
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new NotFoundException("You are not a participant of this match");
    }
    return match;
  }
}
