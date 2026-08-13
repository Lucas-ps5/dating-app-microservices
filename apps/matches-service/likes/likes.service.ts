import { Injectable, Logger } from "@nestjs/common";
import { CreateLikeDto } from "./dto/create-like.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Like } from "./entities/like.entity";
import { Repository } from "typeorm";
import { KafkaProducerService } from "../src/kafka/kafka-producer.service";

@Injectable()
export class LikesService {
  private readonly logger = new Logger(LikesService.name);

  constructor(
    @InjectRepository(Like)
    private readonly likeRepo: Repository<Like>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async create(payload: CreateLikeDto, userId: string) {
    try {
      const like = await this.likeRepo.findOneBy({
        senderId: userId,
        receiverId: payload.receiverId,
        type: payload.type,
      });

      if (like) return;

      const newLike = this.likeRepo.create({
        senderId: userId,
        receiverId: payload.receiverId,
        type: payload.type,
      });

      const savedLike = await this.likeRepo.save(newLike);

    } catch (error) {
      this.logger.error(
        `Failed to save like for receiver ${payload.receiverId}`,
        error,
      );
      throw error;
    }
  }

  findAllMyReceivedLikes() {
    return `This action returns all my likes`;
  }

  findAllMySentLikes() {
    return;
  }

  findOne(id: number) {
    return `This action returns a #${id} like`;
  }

  remove(id: string) {
    return `This action removes a #${id} like`;
  }
}
