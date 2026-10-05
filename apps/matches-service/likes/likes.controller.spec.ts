import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { LikesController } from "./likes.controller";
import { LikesService } from "./likes.service";
import { SwipeType } from "./enums/swipe-type.enum";
import type { AuthenticatedUser } from "@app/common";

const SENDER_ID = "22222222-2222-4222-8222-222222222222";
const RECEIVER_ID = "11111111-1111-4111-8111-111111111111";

const plainUser: AuthenticatedUser = {
  id: SENDER_ID,
  username: "user",
  email: "user@example.com",
  roles: ["user"],
  realmRoles: ["user"],
  clientRoles: [],
};
const adminUser: AuthenticatedUser = {
  id: "admin-id",
  username: "admin",
  email: "admin@example.com",
  roles: ["admin"],
  realmRoles: ["admin"],
  clientRoles: [],
};

describe("LikesController", () => {
  let controller: LikesController;
  let likesService: {
    create: jest.Mock;
    dislike: jest.Mock;
    findOne: jest.Mock;
    findAll: jest.Mock;
    findAllMyReceivedLikes: jest.Mock;
    findAllMySentLikes: jest.Mock;
    countMyReceivedLikes: jest.Mock;
    countMySentLikes: jest.Mock;
  };

  beforeEach(async () => {
    likesService = {
      create: jest.fn(),
      dislike: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      findAllMyReceivedLikes: jest.fn(),
      findAllMySentLikes: jest.fn(),
      countMyReceivedLikes: jest.fn(),
      countMySentLikes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LikesController],
      providers: [{ provide: LikesService, useValue: likesService }],
    }).compile();

    controller = module.get<LikesController>(LikesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("scopes like creation to the caller's token id", () => {
    const dto = { receiverId: RECEIVER_ID, type: SwipeType.LIKE };
    likesService.create.mockReturnValue({ newId: "like-1" });

    const result = controller.create(dto, SENDER_ID);

    expect(likesService.create).toHaveBeenCalledWith(dto, SENDER_ID);
    expect(result).toEqual({ newId: "like-1" });
  });

  it("resolves the dislike target from the caller's token id", () => {
    controller.dislike({ receiverId: RECEIVER_ID }, SENDER_ID);

    expect(likesService.dislike).toHaveBeenCalledWith(SENDER_ID, RECEIVER_ID);
  });

  it("coerces pagination query strings", () => {
    controller.findAll("3", "50");
    expect(likesService.findAll).toHaveBeenCalledWith(3, 50);

    controller.findAllForUser(SENDER_ID, "2", "10");
    expect(likesService.findAllMyReceivedLikes).toHaveBeenCalledWith(
      SENDER_ID,
      2,
      10,
    );

    controller.findAllSentLikes(SENDER_ID, "1", "20");
    expect(likesService.findAllMySentLikes).toHaveBeenCalledWith(
      SENDER_ID,
      1,
      20,
    );
  });

  it("forwards counts using the caller's token id", () => {
    controller.countMyReceivedLikes(SENDER_ID);
    expect(likesService.countMyReceivedLikes).toHaveBeenCalledWith(SENDER_ID);

    controller.countMySentLikes(SENDER_ID);
    expect(likesService.countMySentLikes).toHaveBeenCalledWith(SENDER_ID);
  });

  describe("findOne", () => {
    const like = { id: "like-1", senderId: SENDER_ID, receiverId: RECEIVER_ID };

    it("allows the sender", async () => {
      likesService.findOne.mockResolvedValue(like);

      await expect(controller.findOne(plainUser, "like-1")).resolves.toEqual(
        like,
      );
    });

    it("allows the receiver", async () => {
      const receiverView = {
        id: "like-1",
        senderId: RECEIVER_ID,
        receiverId: SENDER_ID,
      };
      likesService.findOne.mockResolvedValue(receiverView);

      await expect(controller.findOne(plainUser, "like-1")).resolves.toEqual(
        receiverView,
      );
    });

    it("forbids unrelated users", async () => {
      likesService.findOne.mockResolvedValue({
        id: "like-9",
        senderId: "someone-else",
        receiverId: "another-person",
      });

      await expect(
        controller.findOne(plainUser, "like-9"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("allows admins", async () => {
      likesService.findOne.mockResolvedValue(like);

      await expect(controller.findOne(adminUser, "like-1")).resolves.toEqual(
        like,
      );
    });
  });
});
