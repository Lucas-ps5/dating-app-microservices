import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Conversation } from "./conversation.entity";

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
  ) {}

  /**
   * Creates the conversation row for a pair of matched users if it does not
   * exist yet. Used by the `match.created` consumer so a chat thread is ready
   * before either side sends their first message.
   *
   * User ids are sorted so (A,B) and (B,A) resolve to the same row.
   */
  async ensureConversationExists(
    userA: string,
    userB: string,
  ): Promise<Conversation> {
    const [user1Id, user2Id] = [userA, userB].sort();

    const existing = await this.conversationRepo.findOne({
      where: { user1Id, user2Id },
    });

    if (existing) {
      return existing;
    }

    try {
      return await this.conversationRepo.save(
        this.conversationRepo.create({ user1Id, user2Id }),
      );
    } catch (err) {
      // A concurrent match.created for the same pair won the race; the unique
      // index on (user1Id, user2Id) guarantees exactly one row exists.
      const raced = await this.conversationRepo.findOne({
        where: { user1Id, user2Id },
      });
      if (raced) return raced;
      throw err;
    }
  }
}
