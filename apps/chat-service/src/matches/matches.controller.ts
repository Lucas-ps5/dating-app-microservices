import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { MatchesService } from "./matches.service";

@ApiTags("chat/matches")
@Controller("chat/matches")
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @ApiOperation({ summary: "Create a match between two users" })
  async createMatch(@Body() body: { user1Id: string; user2Id: string }) {
    return this.matchesService.createMatch(body.user1Id, body.user2Id);
  }

  @Get()
  @ApiOperation({ summary: "List matches for a user" })
  async listMatches(@Query("userId") userId: string) {
    return this.matchesService.findMatchesForUser(userId);
  }

  @Get(":matchId")
  @ApiOperation({ summary: "Get match by ID" })
  async getMatch(@Param("matchId") matchId: string) {
    return this.matchesService.findMatchById(matchId);
  }
}
