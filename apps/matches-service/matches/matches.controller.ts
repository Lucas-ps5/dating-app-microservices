import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { MatchesService } from "./matches.service";
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from "@app/common";

const ADMIN_ROLE = "admin";

@ApiTags("matches")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("matches")
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  /**
   * Matches are normally created by LikesService when two users like each
   * other. This endpoint exists for admin corrections, so it is role-gated
   * rather than open to any authenticated caller.
   */
  @Roles(ADMIN_ROLE)
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
    @CurrentUser("id") userId: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.matchesService.findMatchesForUser(+page, +limit, userId);
  }

  @Get("count-my-matches")
  countMyMatches(@CurrentUser("id") userId: string) {
    return this.matchesService.countMatchesForUser(userId);
  }

  @Get(":id")
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    const match = await this.matchesService.findOne(id);
    if (match.user1Id !== user.id && match.user2Id !== user.id) {
      if (!user.roles?.includes(ADMIN_ROLE)) {
        throw new ForbiddenException("You are not a participant of this match");
      }
    }
    return match;
  }

  @Roles(ADMIN_ROLE)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.matchesService.remove(id);
  }
}
