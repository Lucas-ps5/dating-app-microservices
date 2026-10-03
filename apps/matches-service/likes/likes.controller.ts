import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Headers,
} from "@nestjs/common";
import { CreateLikeDto } from "./dto/create-like.dto";
import { LikesService } from "./likes.service";
import { UserHeaders } from "@app/common/types/types";

@Controller("likes")
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post("create")
  create(
    @Body() createLikeDto: CreateLikeDto,
    @Headers(UserHeaders.USER_ID) userId: string,
  ) {
    return this.likesService.create(createLikeDto, userId);
  }

  @Post("dislike")
  dislike(
    @Body() removeLikeDto: CreateLikeDto,
    @Headers(UserHeaders.USER_ID) userId: string,
  ) {
    return this.likesService.dislike(userId, removeLikeDto.receiverId);
  }

  @Get("all")
  findAll(@Query("page") page = "1", @Query("limit") limit = "20") {
    return this.likesService.findAll(+page, +limit);
  }

  @Get("my/received")
  async findAllForUser(
    @Headers(UserHeaders.USER_ID) userId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.likesService.findAllMyReceivedLikes(userId, +page, +limit);
  }

  @Get("my/sent")
  async findAllSentLikes(
    @Headers(UserHeaders.USER_ID) userId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.likesService.findAllMySentLikes(userId, +page, +limit);
  }

  @Get("my/received/count")
  async countMyReceivedLikes(@Headers(UserHeaders.USER_ID) userId: string) {
    return this.likesService.countMyReceivedLikes(userId);
  }

  @Get("my/sent/count")
  async countMySentLikes(@Headers(UserHeaders.USER_ID) userId: string) {
    return this.likesService.countMySentLikes(userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.likesService.findOne(id);
  }
}
