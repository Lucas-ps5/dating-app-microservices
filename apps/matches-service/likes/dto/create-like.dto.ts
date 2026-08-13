import { IsUUID, IsEnum } from "class-validator";
import { SwipeType } from "../enums/swipe-type.enum";

export class CreateLikeDto {
  @IsUUID()
  receiverId!: string;

  @IsEnum(SwipeType)
  type!: SwipeType;
}
