import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { LikesService } from "./likes.service";
import { Like } from "./entities/like.entity";
import { SwipeType } from "./enums/swipe-type.enum";
import { KafkaProducerService } from "../src/kafka/kafka-producer.service";
import { MatchesService } from "../matches/matches.service";
import { KAFKA_TOPICS } from "@app/common";

const SENDER_ID = "22222222-2222-4222-8222-222222222222";
const RECEIVER_ID = "11111111-1111-4111-8111-111111111111";

describe("LikesService", () => {
  let service: LikesService;
  let likeRepo: {
    findOneBy: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    remove: jest.Mock;
    countBy: jest.Mock;
  };
  let matchesService: {
    createMatch: jest.Mock;
    removeMatch: jest.Mock;
  };
  let kafkaProducer: { emit: jest.Mock };

  beforeEach(async () => {
    likeRepo = {
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
      countBy: jest.fn(),
    };
    matchesService = {
      createMatch: jest.fn(),
      removeMatch: jest.fn(),
    };
    kafkaProducer = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        { provide: getRepositoryToken(Like), useValue: likeRepo },
        { provide: MatchesService, useValue: matchesService },
        { provide: KafkaProducerService, useValue: kafkaProducer },
      ],
    }).compile();

    service = module.get<LikesService>(LikesService);
  });

  describe("create", () => {
    const payload = { receiverId: RECEIVER_ID, type: SwipeType.LIKE };

    it("creates a like, emits like.created and returns the new id", async () => {
      const savedLike: Partial<Like> = {
        id: "like-1",
        senderId: SENDER_ID,
        receiverId: RECEIVER_ID,
        type: SwipeType.LIKE,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };

      likeRepo.findOneBy.mockResolvedValue(null);
      likeRepo.create.mockReturnValue(savedLike);
      likeRepo.save.mockResolvedValue(savedLike);
      // No reciprocal like, so no match is attempted.
      likeRepo.findOne.mockResolvedValue(null);

      const result = await service.create(payload, SENDER_ID);

      expect(likeRepo.findOneBy).toHaveBeenCalledWith({
        senderId: SENDER_ID,
        receiverId: RECEIVER_ID,
      });
      expect(kafkaProducer.emit).toHaveBeenCalledWith(
        KAFKA_TOPICS.LIKE_CREATED,
        expect.objectContaining({
          id: "like-1",
          senderId: SENDER_ID,
          receiverId: RECEIVER_ID,
        }),
      );
      expect(result).toEqual({ newId: "like-1" });
    });

    it("rejects a duplicate like without writing", async () => {
      likeRepo.findOneBy.mockResolvedValue({ id: "like-1" });

      await expect(service.create(payload, SENDER_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(likeRepo.save).not.toHaveBeenCalled();
    });

    it("rejects liking yourself", async () => {
      await expect(
        service.create({ ...payload, receiverId: SENDER_ID }, SENDER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a missing authenticated user", async () => {
      await expect(service.create(payload, undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("creates a match when a reciprocal like already exists", async () => {
      const savedLike: Partial<Like> = {
        id: "like-2",
        senderId: SENDER_ID,
        receiverId: RECEIVER_ID,
        type: SwipeType.LIKE,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };

      likeRepo.findOneBy.mockResolvedValue(null);
      likeRepo.create.mockReturnValue(savedLike);
      likeRepo.save.mockResolvedValue(savedLike);
      likeRepo.findOne.mockResolvedValue({ id: "reciprocal-like" });
      matchesService.createMatch.mockResolvedValue({ newId: "match-1" });

      await service.create(payload, SENDER_ID);

      expect(matchesService.createMatch).toHaveBeenCalledWith(
        SENDER_ID,
        RECEIVER_ID,
      );
    });

    it("treats an already-existing match as success, not an error", async () => {
      const savedLike: Partial<Like> = {
        id: "like-3",
        senderId: SENDER_ID,
        receiverId: RECEIVER_ID,
        type: SwipeType.LIKE,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };

      likeRepo.findOneBy.mockResolvedValue(null);
      likeRepo.create.mockReturnValue(savedLike);
      likeRepo.save.mockResolvedValue(savedLike);
      likeRepo.findOne.mockResolvedValue({ id: "reciprocal-like" });
      // Nest reports the class name as "HttpException", not "ConflictException",
      // so a naive `error.name` check would re-throw here and fail the request.
      matchesService.createMatch.mockRejectedValue(
        new ConflictException("Match already exists"),
      );

      await expect(service.create(payload, SENDER_ID)).resolves.toEqual({
        newId: "like-3",
      });
    });

    it("propagates non-conflict errors from match creation", async () => {
      const savedLike: Partial<Like> = {
        id: "like-4",
        senderId: SENDER_ID,
        receiverId: RECEIVER_ID,
        type: SwipeType.LIKE,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };

      likeRepo.findOneBy.mockResolvedValue(null);
      likeRepo.create.mockReturnValue(savedLike);
      likeRepo.save.mockResolvedValue(savedLike);
      likeRepo.findOne.mockResolvedValue({ id: "reciprocal-like" });
      matchesService.createMatch.mockRejectedValue(
        new Error("database unreachable"),
      );

      await expect(service.create(payload, SENDER_ID)).rejects.toThrow(
        "database unreachable",
      );
    });
  });

  describe("dislike", () => {
    it("removes the like and the match when a reciprocal like remains", async () => {
      likeRepo.findOneBy.mockResolvedValue({
        id: "like-1",
        senderId: SENDER_ID,
        receiverId: RECEIVER_ID,
      });
      likeRepo.remove.mockResolvedValue(undefined);
      likeRepo.findOne.mockResolvedValue({ id: "reciprocal-like" });

      await service.dislike(SENDER_ID, RECEIVER_ID);

      expect(likeRepo.remove).toHaveBeenCalled();
      expect(matchesService.removeMatch).toHaveBeenCalledWith(
        SENDER_ID,
        RECEIVER_ID,
      );
    });

    it("leaves the match alone when no reciprocal like exists", async () => {
      likeRepo.findOneBy.mockResolvedValue({
        id: "like-1",
        senderId: SENDER_ID,
        receiverId: RECEIVER_ID,
      });
      likeRepo.remove.mockResolvedValue(undefined);
      likeRepo.findOne.mockResolvedValue(null);

      await service.dislike(SENDER_ID, RECEIVER_ID);

      expect(matchesService.removeMatch).not.toHaveBeenCalled();
    });

    it("throws when the like does not exist", async () => {
      likeRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.dislike(SENDER_ID, RECEIVER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("counts", () => {
    it("counts sent and received likes", async () => {
      likeRepo.countBy.mockResolvedValue(7);

      await expect(service.countMySentLikes(SENDER_ID)).resolves.toEqual({
        count: 7,
      });
      await expect(service.countMyReceivedLikes(SENDER_ID)).resolves.toEqual({
        count: 7,
      });
    });
  });
});
