import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { KAFKA_TOPICS } from "@app/common";
import { KafkaProducerService } from "../src/kafka/kafka-producer.service";
import { Match } from "./entities/match.entity";

export interface PaginatedMatches {
  data: Match[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async createMatch(user1Id: string, user2Id: string): Promise<Match> {
    const [uid1, uid2] = [user1Id, user2Id].sort();

    const existing = await this.matchRepo.findOne({
      where: { user1Id: uid1, user2Id: uid2 },
    });

    if (existing) {
      throw new ConflictException("Match already exists");
    }

    const match = this.matchRepo.create({ user1Id: uid1, user2Id: uid2 });
    const savedMatch = await this.matchRepo.save(match);

    await this.kafkaProducer.emit(KAFKA_TOPICS.MATCH_CREATED, {
      matchId: savedMatch.id,
      user1Id: uid1,
      user2Id: uid2,
      matchedAt: savedMatch.matchedAt.toISOString(),
    });

    this.logger.log(
      `Created match ${savedMatch.id} between ${uid1} and ${uid2}`,
    );
    return savedMatch;
  }

  async findAll(page = 1, limit = 20): Promise<PaginatedMatches> {
    const sanitizedPage = Math.max(1, Math.floor(page));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const [data, total] = await this.matchRepo.findAndCount({
      order: { matchedAt: "DESC" },
      skip: (sanitizedPage - 1) * sanitizedLimit,
      take: sanitizedLimit,
    });

    return {
      data,
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages: Math.ceil(total / sanitizedLimit),
    };
  }

  async findMatchesForUser(
    page = 1,
    limit = 20,
    userId: string,
  ): Promise<PaginatedMatches> {
    const sanitizedPage = Math.max(1, Math.floor(page));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const [data, total] = await this.matchRepo.findAndCount({
      where: [{ user1Id: userId }, { user2Id: userId }],
      order: { matchedAt: "DESC" },
      skip: (sanitizedPage - 1) * sanitizedLimit,
      take: sanitizedLimit,
    });

    return {
      data,
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages: Math.ceil(total / sanitizedLimit),
    };
  }

  async findOne(id: string): Promise<Match> {
    const match = await this.matchRepo.findOne({ where: { id } });

    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }

    return match;
  }

  async remove(id: string): Promise<void> {
    const match = await this.findOne(id);
    await this.matchRepo.remove(match);
  }
}
