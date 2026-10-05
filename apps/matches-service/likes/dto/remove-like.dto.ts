import { IsUUID } from "class-validator";

/**
 * Payload for `POST /likes/dislike`. Unlike `CreateLikeDto` there is no
 * `type` field, because the endpoint is unambiguous and the value was never
 * read by the handler.
 */
export class RemoveLikeDto {
  @IsUUID()
  receiverId!: string;
}
