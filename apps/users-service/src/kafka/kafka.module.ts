import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/user.entity";
import { KafkaConsumerService } from "./kafka-consumer.service";
import { KafkaProducerService } from "./kafka-producer.service";

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [KafkaProducerService, KafkaConsumerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
