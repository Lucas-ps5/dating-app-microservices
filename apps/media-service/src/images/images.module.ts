import { Module } from "@nestjs/common";
import { ImagesController } from "./images.controller";
import { ImagesService } from "./images.service";
import { MinioModule } from "../minio/minio.module";
import { KafkaModule } from "../kafka/kafka.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Image } from "./image.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Image]), MinioModule, KafkaModule],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
