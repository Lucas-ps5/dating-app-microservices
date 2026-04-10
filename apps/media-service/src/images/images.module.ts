import { Module } from "@nestjs/common";
import { ImagesController } from "./images.controller";
import { ImagesService } from "./images.service";
import { MinioModule } from "../minio/minio.module";
import { KafkaModule } from "../kafka/kafka.module";

@Module({
  imports: [MinioModule, KafkaModule],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
