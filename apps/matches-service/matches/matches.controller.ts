import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { MatchesService } from "./matches.service";
import { UserHeaders } from "@app/common";

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

  @Get("my")
  findMatchesForUser(
    @Headers(UserHeaders.USER_ID) userId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.matchesService.findMatchesForUser(+page, +limit, userId);
  }

  @Get("count-my-matches")
  countMyMatches(@Headers(UserHeaders.USER_ID) userId: string) {
    return this.matchesService.countMatchesForUser(userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.matchesService.findOne(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.matchesService.remove(id);
  }
}
