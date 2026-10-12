import { Module } from "@nestjs/common";
import { ImagesController } from "./images.controller";
import { ImagesService } from "./images.service";
import { ObjectStorageModule } from "../object-storage/object-storage.module";
import { KafkaModule } from "../kafka/kafka.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Image } from "./image.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Image]), ObjectStorageModule, KafkaModule],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
