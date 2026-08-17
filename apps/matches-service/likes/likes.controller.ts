import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CreateLikeDto } from "./dto/create-like.dto";
import { LikesService } from "./likes.service";

@Controller("likes")
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post("create")
  create(
    @Body() createLikeDto: CreateLikeDto,
    @Query("userId") userId?: string,
  ) {
    return this.likesService.create(createLikeDto, userId);
  }

  @Post("dislike")
  dislike(
    @Body() removeLikeDto: CreateLikeDto,
    @Query("userId") userId?: string,
  ) {
    return this.likesService.dislike(userId, removeLikeDto.receiverId);
  }

  @Get("all")
  findAll(@Query("page") page = "1", @Query("limit") limit = "20") {
    return this.likesService.findAll(+page, +limit);
  }

  @Get(":userId/received")
  async findAllForUser(
    @Param("userId") userId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.likesService.findAllMyReceivedLikes(userId, +page, +limit);
  }

  @Get(":userId/sent")
  async findAllSentLikes(
    @Param("userId") userId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.likesService.findAllMySentLikes(userId, +page, +limit);
  }

  @Get(":userId/received/count")
  async countMyReceivedLikes(@Param("userId") userId: string) {
    return this.likesService.countMyReceivedLikes(userId);
  }

  @Get(":userId/sent/count")
  async countMySentLikes(@Param("userId") userId: string) {
    return this.likesService.countMySentLikes(userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.likesService.findOne(id);
  }
}
