import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";
import type { AuthenticatedUser } from "@app/common";

const USER_A = "aaaaaaaa-1111-4111-8111-111111111111";
const USER_B = "bbbbbbbb-2222-4222-8222-222222222222";

const plainUser: AuthenticatedUser = {
  id: USER_A,
  username: "user-a",
  email: "a@example.com",
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

describe("MatchesController", () => {
  let controller: MatchesController;
  let matchesService: {
    createMatch: jest.Mock;
    remove: jest.Mock;
    findOne: jest.Mock;
    findAll: jest.Mock;
    findMatchesForUser: jest.Mock;
    countMatchesForUser: jest.Mock;
  };

  beforeEach(async () => {
    matchesService = {
      createMatch: jest.fn(),
      remove: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      findMatchesForUser: jest.fn(),
      countMatchesForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [{ provide: MatchesService, useValue: matchesService }],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("delegates admin match creation", () => {
    controller.create({ user1Id: USER_A, user2Id: USER_B });

    expect(matchesService.createMatch).toHaveBeenCalledWith(USER_A, USER_B);
  });

  it("delegates admin match removal", () => {
    controller.remove("match-1");

    expect(matchesService.remove).toHaveBeenCalledWith("match-1");
  });

  it("coerces pagination query strings", () => {
    controller.findAll("2", "25");
    expect(matchesService.findAll).toHaveBeenCalledWith(2, 25);
  });

  it("scopes match listing to the caller's token id", () => {
    controller.findMatchesForUser(USER_A, "1", "20");
    expect(matchesService.findMatchesForUser).toHaveBeenCalledWith(
      1,
      20,
      USER_A,
    );

    controller.countMyMatches(USER_A);
    expect(matchesService.countMatchesForUser).toHaveBeenCalledWith(USER_A);
  });

  describe("findOne", () => {
    it("allows a participant stored as user1Id", async () => {
      const match = { id: "match-1", user1Id: USER_A, user2Id: USER_B };
      matchesService.findOne.mockResolvedValue(match);

      await expect(controller.findOne(plainUser, "match-1")).resolves.toEqual(
        match,
      );
    });

    it("allows a participant stored as user2Id", async () => {
      const match = { id: "match-1", user1Id: USER_B, user2Id: USER_A };
      matchesService.findOne.mockResolvedValue(match);

      await expect(controller.findOne(plainUser, "match-1")).resolves.toEqual(
        match,
      );
    });

    it("forbids non-participants", async () => {
      matchesService.findOne.mockResolvedValue({
        id: "match-9",
        user1Id: USER_B,
        user2Id: "cccccccc-3333-4333-8333-333333333333",
      });

      await expect(
        controller.findOne(plainUser, "match-9"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("allows admins to inspect any match", async () => {
      const match = { id: "match-9", user1Id: USER_B, user2Id: USER_A };
      matchesService.findOne.mockResolvedValue(match);

      await expect(controller.findOne(adminUser, "match-9")).resolves.toEqual(
        match,
      );
    });
  });
});
