import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CountResponse, CreationResponse, KAFKA_TOPICS } from "@app/common";
import { MatchesService } from "../matches/matches.service";
import { CreateLikeDto } from "./dto/create-like.dto";
import { Like } from "./entities/like.entity";
import { KafkaProducerService } from "../src/kafka/kafka-producer.service";

export interface PaginatedLikes {
  data: Like[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class LikesService {
  private readonly logger = new Logger(LikesService.name);

  constructor(
    @InjectRepository(Like)
    private readonly likeRepo: Repository<Like>,
    private readonly matchesService: MatchesService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(
    payload: CreateLikeDto,
    userId?: string,
  ): Promise<CreationResponse> {
    if (!userId) {
      throw new BadRequestException("Authenticated user id is required");
    }

    if (userId === payload.receiverId) {
      throw new BadRequestException("You cannot like yourself");
    }

    try {
      const existingLike = await this.likeRepo.findOneBy({
        senderId: userId,
        receiverId: payload.receiverId,
      });

      if (existingLike) {
        this.logger.log(
          `Duplicate like ignored for sender ${userId} and receiver ${payload.receiverId}`,
        );
        throw new ConflictException("Like already exists");
      }

      const newLike = this.likeRepo.create({
        senderId: userId,
        receiverId: payload.receiverId,
        type: payload.type,
      });

      const savedLike = await this.likeRepo.save(newLike);

      await this.kafkaProducer.emit(KAFKA_TOPICS.LIKE_CREATED, {
        id: savedLike.id,
        senderId: savedLike.senderId,
        receiverId: savedLike.receiverId,
        type: savedLike.type,
        createdAt: savedLike.createdAt,
      });

      await this.maybeCreateMutualMatch(savedLike);

      return { newId: savedLike.id };
    } catch (error) {
      this.logger.error(
        `Failed to save like for receiver ${payload.receiverId}`,
        error,
      );
      throw error;
    }
  }

  async dislike(userId?: string, receiverId?: string): Promise<void> {
    if (!userId || !receiverId) {
      throw new BadRequestException("Both user and receiver ids are required");
    }

    const like = await this.likeRepo.findOneBy({
      senderId: userId,
      receiverId,
    });

    if (!like) {
      throw new NotFoundException("Like not found");
    }

    await this.likeRepo.remove(like);
    const reciprocalLike = await this.likeRepo.findOne({
      where: {
        senderId: like.receiverId,
        receiverId: like.senderId,
      },
    });

    if (reciprocalLike) {
      await this.matchesService.removeMatch(like.senderId, like.receiverId);
    }

    this.logger.log(
      `Like removed for user ${userId} and receiver ${receiverId}`,
    );
  }

  private async maybeCreateMutualMatch(like: Like): Promise<void> {
    const reciprocalLike = await this.likeRepo.findOne({
      where: {
        senderId: like.receiverId,
        receiverId: like.senderId,
      },
    });

    if (!reciprocalLike) {
      return;
    }

    try {
      const match = await this.matchesService.createMatch(
        like.senderId,
        like.receiverId,
      );

      this.logger.log(
        `Mutual like detected between ${like.senderId} and ${like.receiverId}; created match ${match.newId}`,
      );
    } catch (error) {
      // Nest's HttpException reports `name === "HttpException"`, so the match
      // status has to be inspected instead of the error name.
      if (error instanceof ConflictException) {
        this.logger.log(
          `Match already existed for ${like.senderId} and ${like.receiverId}`,
        );
        return;
      }
      throw error;
    }
  }

  async findAll(page = 1, limit = 20): Promise<PaginatedLikes> {
    const sanitizedPage = Math.max(1, Math.floor(page));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const [data, total] = await this.likeRepo.findAndCount({
      order: { createdAt: "DESC" },
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

  async findAllMyReceivedLikes(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedLikes> {
    const sanitizedPage = Math.max(1, Math.floor(page));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const [data, total] = await this.likeRepo.findAndCount({
      where: { receiverId: userId },
      order: { createdAt: "DESC" },
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

  async findAllMySentLikes(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedLikes> {
    const sanitizedPage = Math.max(1, Math.floor(page));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const [data, total] = await this.likeRepo.findAndCount({
      where: { senderId: userId },
      order: { createdAt: "DESC" },
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

  async findOne(id: string): Promise<Like> {
    const like = await this.likeRepo.findOneBy({ id });

    if (!like) {
      throw new NotFoundException(`Like with id ${id} not found`);
    }

    return like;
  }

  async countMySentLikes(userId: string): Promise<CountResponse> {
    const count = await this.likeRepo.countBy({ senderId: userId });
    return { count };
  }

  async countMyReceivedLikes(userId: string): Promise<CountResponse> {
    const count = await this.likeRepo.countBy({ receiverId: userId });
    return { count };
  }
}
