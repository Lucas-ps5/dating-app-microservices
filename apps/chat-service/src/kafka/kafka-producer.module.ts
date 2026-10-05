import { Module } from "@nestjs/common";
import { KafkaProducerService } from "./kafka-producer.service";

/**
 * Transport-only module for producing events. Kept separate from
 * KafkaModule so consumers can depend on domain modules that themselves
 * publish events, without creating a circular import.
 */
@Module({
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaProducerModule {}
