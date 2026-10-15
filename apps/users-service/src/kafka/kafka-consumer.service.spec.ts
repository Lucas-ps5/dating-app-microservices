import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { ImageUploadedEvent } from "@app/common";
import { User } from "../users/user.entity";
import { KafkaConsumerService } from "./kafka-consumer.service";

describe("KafkaConsumerService.handleImageUploaded", () => {
  let service: KafkaConsumerService;
  let usersRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    usersRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    service = new KafkaConsumerService(
      { get: jest.fn() } as unknown as ConfigService,
      usersRepo as unknown as Repository<User>,
    );
  });

  it("adds an avatar URL to the owning user's photos", async () => {
    const user = { id: "user-1", photos: ["existing.jpg"] } as User;
    usersRepo.findOne.mockResolvedValue(user);
    const event: ImageUploadedEvent = {
      objectName: "avatar/avatar.jpg",
      ownerId: "user-1",
      url: "http://localhost/avatar.jpg",
      context: "avatar",
    };

    await service.handleImageUploaded(event);

    expect(user.photos).toEqual([
      "existing.jpg",
      "http://localhost/avatar.jpg",
    ]);
    expect(usersRepo.save).toHaveBeenCalledWith(user);
  });

  it("ignores non-avatar uploads", async () => {
    await service.handleImageUploaded({
      objectName: "chat/image.jpg",
      ownerId: "user-1",
      url: "http://localhost/image.jpg",
      context: "chat",
    });

    expect(usersRepo.findOne).not.toHaveBeenCalled();
    expect(usersRepo.save).not.toHaveBeenCalled();
  });

  it("does not duplicate a URL when Kafka redelivers an event", async () => {
    const url = "http://localhost/avatar.jpg";
    const user = { id: "user-1", photos: [url] } as User;
    usersRepo.findOne.mockResolvedValue(user);

    await service.handleImageUploaded({
      objectName: "avatar/avatar.jpg",
      ownerId: "user-1",
      url,
      context: "avatar",
    });

    expect(usersRepo.save).not.toHaveBeenCalled();
  });
});