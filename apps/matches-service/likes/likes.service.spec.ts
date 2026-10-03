import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { LikesService } from "./likes.service";
import { Like } from "./entities/like.entity";
import { SwipeType } from "./enums/swipe-type.enum";
import { KafkaProducerService } from "../src/kafka/kafka-producer.service";

describe("LikesService", () => {
  let service: LikesService;
  let likeRepo: {
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    likeRepo = {
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        {
          provide: getRepositoryToken(Like),
          useValue: likeRepo,
        },
        {
          provide: KafkaProducerService,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LikesService>(LikesService);
  });

  it("should create a new like when no duplicate exists", async () => {
    const payload = {
      receiverId: "11111111-1111-4111-8111-111111111111",
      type: SwipeType.LIKE,
    };
    const createdLike = {
      id: "like-1",
      senderId: "22222222-2222-4222-8222-222222222222",
      ...payload,
    };

    likeRepo.findOneBy.mockResolvedValue(null);
    likeRepo.create.mockReturnValue(createdLike);
    likeRepo.save.mockResolvedValue(createdLike);

    const result = await service.create(payload, "22222222-2222-4222-8222-222222222222");

    expect(likeRepo.findOneBy).toHaveBeenCalledWith({
      senderId: "22222222-2222-4222-8222-222222222222",
      receiverId: payload.receiverId,
    });
    expect(likeRepo.save).toHaveBeenCalledWith(createdLike);
    expect(result).toEqual(createdLike);
  });

  it("should not create a duplicate like for the same sender and receiver", async () => {
    const payload = {
      receiverId: "11111111-1111-4111-8111-111111111111",
      type: SwipeType.LIKE,
    };
    const existingLike = {
      id: "like-1",
      senderId: "22222222-2222-4222-8222-222222222222",
      ...payload,
    };

    likeRepo.findOneBy.mockResolvedValue(existingLike);

    const result = await service.create(payload, "22222222-2222-4222-8222-222222222222");

    expect(result).toBeNull();
    expect(likeRepo.save).not.toHaveBeenCalled();
  });
});
