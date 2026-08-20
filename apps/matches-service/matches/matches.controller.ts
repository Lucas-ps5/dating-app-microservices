import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { MatchesService } from "./matches.service";

@Controller("matches")
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  create(@Body() body: { user1Id: string; user2Id: string }) {
    return this.matchesService.createMatch(body.user1Id, body.user2Id);
  }

  @Get()
  findAll(@Query("page") page = "1", @Query("limit") limit = "20") {
    return this.matchesService.findAll(+page, +limit);
  }

  @Get("user/:userId")
  findMatchesForUser(
    @Param("userId") userId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.matchesService.findMatchesForUser(+page, +limit, userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.matchesService.findOne(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.matchesService.remove(id);
  }

  @Get("/count-my-matches")
  countMyMatches(@Query("userId") userId: string) {
    return this.matchesService.countMyMatches(userId);
  }
}
