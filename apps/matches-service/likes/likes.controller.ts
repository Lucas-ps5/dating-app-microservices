import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateLikeDto } from "./dto/create-like.dto";
import { RemoveLikeDto } from "./dto/remove-like.dto";
import { LikesService } from "./likes.service";
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from "@app/common";

const ADMIN_ROLE = "admin";

@ApiTags("likes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("likes")
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post("create")
  create(
    @Body() createLikeDto: CreateLikeDto,
    @CurrentUser("id") userId: string,
  ) {
    return this.likesService.create(createLikeDto, userId);
  }

  @Post("dislike")
  dislike(
    @Body() removeLikeDto: RemoveLikeDto,
    @CurrentUser("id") userId: string,
  ) {
    return this.likesService.dislike(userId, removeLikeDto.receiverId);
  }

  @Get("all")
  findAll(@Query("page") page = "1", @Query("limit") limit = "20") {
    return this.likesService.findAll(+page, +limit);
  }

  @Get("my/received")
  findAllForUser(
    @CurrentUser("id") userId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.likesService.findAllMyReceivedLikes(userId, +page, +limit);
  }

  @Get("my/sent")
  findAllSentLikes(
    @CurrentUser("id") userId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.likesService.findAllMySentLikes(userId, +page, +limit);
  }

  @Get("my/received/count")
  countMyReceivedLikes(@CurrentUser("id") userId: string) {
    return this.likesService.countMyReceivedLikes(userId);
  }

  @Get("my/sent/count")
  countMySentLikes(@CurrentUser("id") userId: string) {
    return this.likesService.countMySentLikes(userId);
  }

  @Get(":id")
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const like = await this.likesService.findOne(id);
    const involved = like.senderId === user.id || like.receiverId === user.id;
    if (!involved && !user.roles?.includes(ADMIN_ROLE)) {
      throw new ForbiddenException("This like does not involve you");
    }
    return like;
  }
}
