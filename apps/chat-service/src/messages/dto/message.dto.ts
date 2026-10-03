import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString } from "class-validator";
import { MessageType } from "../message.entity";

export class SendMessageDto {
  @ApiProperty({ type: "string", required: true })
  @IsString()
  receiverId!: string;

  @ApiProperty({ type: "string", required: true })
  @IsString()
  content!: string;

  @ApiProperty({
    enum: MessageType,
    enumName: "MessageType",
    required: false,
    default: MessageType.TEXT,
  })
  @IsEnum(MessageType)
  type!: MessageType;
}
