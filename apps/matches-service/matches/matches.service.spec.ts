import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { MatchesService } from "./matches.service";
import { Match } from "./entities/match.entity";
import { KafkaProducerService } from "../src/kafka/kafka-producer.service";
import { KAFKA_TOPICS } from "@app/common";

const USER_A = "aaaaaaaa-1111-4111-8111-111111111111";
const USER_B = "bbbbbbbb-2222-4222-8222-222222222222";

describe("MatchesService", () => {
  let service: MatchesService;
  let matchRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    findAndCount: jest.Mock;
    count: jest.Mock;
  };
  let kafkaProducer: { emit: jest.Mock };

  beforeEach(async () => {
    matchRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
    };
    kafkaProducer = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: getRepositoryToken(Match), useValue: matchRepo },
        { provide: KafkaProducerService, useValue: kafkaProducer },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  describe("createMatch", () => {
    it("normalises the pair, saves and emits match.created", async () => {
      const savedMatch = {
        id: "match-1",
        user1Id: USER_A,
        user2Id: USER_B,
        matchedAt: new Date("2026-01-01T00:00:00.000Z"),
      };

      matchRepo.findOne.mockResolvedValue(null);
      matchRepo.create.mockReturnValue(savedMatch);
      matchRepo.save.mockResolvedValue(savedMatch);

      // Deliberately pass the ids in reverse order.
      const result = await service.createMatch(USER_B, USER_A);

      expect(matchRepo.findOne).toHaveBeenCalledWith({
        where: { user1Id: USER_A, user2Id: USER_B },
      });
      expect(kafkaProducer.emit).toHaveBeenCalledWith(
        KAFKA_TOPICS.MATCH_CREATED,
        {
          matchId: "match-1",
          user1Id: USER_A,
          user2Id: USER_B,
          matchedAt: "2026-01-01T00:00:00.000Z",
        },
      );
      expect(result).toEqual({ newId: "match-1" });
    });

    it("rejects a duplicate match", async () => {
      matchRepo.findOne.mockResolvedValue({ id: "match-1" });

      await expect(service.createMatch(USER_A, USER_B)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(matchRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("removeMatch", () => {
    it("removes the match for the normalised pair", async () => {
      const match = { id: "match-1", user1Id: USER_A, user2Id: USER_B };
      matchRepo.findOne.mockResolvedValue(match);
      matchRepo.remove.mockResolvedValue(match);

      await service.removeMatch(USER_B, USER_A);

      expect(matchRepo.remove).toHaveBeenCalledWith(match);
    });

    it("throws when either id is missing", async () => {
      await expect(
        service.removeMatch(USER_A, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws when no match exists", async () => {
      matchRepo.findOne.mockResolvedValue(null);

      await expect(service.removeMatch(USER_A, USER_B)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("queries", () => {
    it("clamps pagination inputs", async () => {
      matchRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(-5, 5000);

      expect(matchRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
    });

    it("matches a user on either side of the pair", async () => {
      matchRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findMatchesForUser(1, 20, USER_A);

      expect(matchRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [{ user1Id: USER_A }, { user2Id: USER_A }],
        }),
      );
    });

    it("counts a user's matches on either side", async () => {
      matchRepo.count.mockResolvedValue(3);

      await expect(service.countMatchesForUser(USER_A)).resolves.toEqual({
        count: 3,
      });
    });

    it("throws a 404 for an unknown match id", async () => {
      matchRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne("nope")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
