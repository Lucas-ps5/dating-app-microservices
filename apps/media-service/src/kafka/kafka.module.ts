import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MediaOutboxEvent } from "./outbox-event.entity";
import { KafkaOutboxPublisher } from "./kafka-outbox.publisher";
import { KafkaProducerService } from "./kafka-producer.service";

@Module({
  imports: [TypeOrmModule.forFeature([MediaOutboxEvent])],
  providers: [KafkaProducerService, KafkaOutboxPublisher],
})
export class KafkaModule {}
