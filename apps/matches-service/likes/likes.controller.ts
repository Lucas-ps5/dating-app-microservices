import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CreateLikeDto } from "./dto/create-like.dto";
import { UpdateLikeDto } from "./dto/update-like.dto";
import { LikesService } from "./likes.service";

@Controller("likes")
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  create(
    @Body() createLikeDto: CreateLikeDto,
    @Query("userId") userId?: string,
  ) {
    return this.likesService.create(createLikeDto, userId);
  }

  @Get()
  findAll(@Query("page") page = "1", @Query("limit") limit = "20") {
    return this.likesService.findAll(+page, +limit);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.likesService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateLikeDto: UpdateLikeDto) {
    return this.likesService.update(id, updateLikeDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.likesService.remove(id);
  }
}
