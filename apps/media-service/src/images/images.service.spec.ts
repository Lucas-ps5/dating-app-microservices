import { Readable } from "stream";
import { DataSource, Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { KAFKA_TOPICS } from "@app/common";
import { ObjectStorageService } from "../object-storage/object-storage.service";
import { Image } from "./image.entity";
import { ImagesService } from "./images.service";

jest.mock("uuid", () => ({ v4: () => "image-id" }));

describe("ImagesService.uploadImage", () => {
  let service: ImagesService;
  let imagesRepo: { create: jest.Mock; findOne: jest.Mock };
  let objectStorage: {
    upload: jest.Mock;
    delete: jest.Mock;
    objectSize: jest.Mock;
    getObjectStream: jest.Mock;
  };
  let manager: {
    save: jest.Mock;
    query: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    imagesRepo = {
      create: jest.fn((image) => image),
      findOne: jest.fn(),
    };
    objectStorage = {
      upload: jest.fn().mockResolvedValue({
        objectName: "avatar/avatar.jpg",
        url: "http://localhost:9000/hmeet-media/avatar/avatar.jpg",
      }),
      delete: jest.fn(),
      objectSize: jest.fn(),
      getObjectStream: jest.fn(),
    };
    manager = {
      save: jest.fn(),
      query: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((operation: (transactionManager: unknown) => unknown) =>
        operation(manager),
      ),
    };
    service = new ImagesService(
      imagesRepo as unknown as Repository<Image>,
      objectStorage as unknown as ObjectStorageService,
      dataSource as unknown as DataSource,
      {
        get: jest.fn().mockReturnValue("http://localhost:3000"),
      } as unknown as ConfigService,
    );
  });

  it("commits image metadata and the upload event in one transaction", async () => {
    const result = await service.uploadImage(
      Buffer.from("image"),
      "avatar.jpg",
      "image/jpeg",
      "user-1",
      "avatar",
    );

    expect(result.objectName).toBe("avatar/avatar.jpg");
    expect(result.url).toBe(
      "http://localhost:3000/api/media/images/avatar/avatar.jpg",
    );
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "user-1", context: "avatar" }),
    );
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "media_outbox_events"'),
      [
        KAFKA_TOPICS.IMAGE_UPLOADED,
        JSON.stringify({
          objectName: "avatar/avatar.jpg",
          ownerId: "user-1",
          url: "http://localhost:3000/api/media/images/avatar/avatar.jpg",
          context: "avatar",
        }),
      ],
    );
  });

  it("deletes the stored object if the database transaction fails", async () => {
    const error = new Error("outbox insert failed");
    manager.query.mockRejectedValue(error);

    await expect(
      service.uploadImage(
        Buffer.from("image"),
        "avatar.jpg",
        "image/jpeg",
        "user-1",
        "avatar",
      ),
    ).rejects.toBe(error);

    expect(objectStorage.delete).toHaveBeenCalledWith("avatar/avatar.jpg");
  });

  it("streams an image without requiring ownership", async () => {
    const image = {
      imageName: "avatar/avatar.jpg",
      imageType: "image/jpeg",
      originalName: "avatar.jpg",
    } as Image;
    const stream = Readable.from(Buffer.from("image"));
    imagesRepo.findOne.mockResolvedValue(image);
    objectStorage.objectSize.mockResolvedValue(5);
    objectStorage.getObjectStream.mockResolvedValue(stream);

    await expect(service.getImageStream("avatar/avatar.jpg")).resolves.toEqual(
      {
        stream,
        contentType: "image/jpeg",
        size: 5,
        fileName: "avatar.jpg",
      },
    );
    expect(imagesRepo.findOne).toHaveBeenCalledWith({
      where: { imageName: "avatar/avatar.jpg" },
    });
  });
});
