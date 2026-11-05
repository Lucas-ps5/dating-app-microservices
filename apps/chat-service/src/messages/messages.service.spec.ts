import { BadRequestException } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { Message, MessageType } from "./message.entity";
import { Conversation } from "./conversation.entity";
import { MessagesService } from "./messages.service";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import { MatchesService } from "../matches/matches.service";

describe("MessagesService image messages", () => {
  const service = new MessagesService(
    {} as Repository<Conversation>,
    {} as Repository<Message>,
    {} as DataSource,
    {} as KafkaProducerService,
    {} as MatchesService,
  );

  it("requires content for image messages", async () => {
    await expect(
      service.sendMessage(
        "sender-1",
        "receiver-1",
        "",
        MessageType.IMAGE,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

});
