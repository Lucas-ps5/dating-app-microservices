import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto, DiscoverQueryDto, UpdateUserDto } from "./dto/user.dto";
import {
  AuthenticatedUser,
  CurrentUser,
  FieldToExtractCodes,
  JwtAuthGuard,
  Public,
} from "@app/common";

const ADMIN_ROLE = "admin";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("user")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Guards routes that act on a specific user: the caller must be that user,
   * or an admin. Stops one account from editing or deleting another.
   */
  private assertSelfOrAdmin(user: AuthenticatedUser, targetId: string): void {
    if (user.id === targetId) return;
    if (user.roles?.includes(ADMIN_ROLE)) return;
    throw new ForbiddenException("You can only modify your own profile");
  }

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  async register(@Body() dto: CreateUserDto) {
    return this.usersService.register(dto);
  }

  @Get("me")
  @ApiOperation({ summary: "Get profile of the current user" })
  async getCurrentUserProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Query("fieldToExtractCodes") fieldToExtractCodes: FieldToExtractCodes,
  ) {
    return this.usersService.findById(user.id, fieldToExtractCodes);
  }

  @Get("discover")
  @ApiOperation({ summary: "Discover potential matches" })
  async discover(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DiscoverQueryDto,
  ) {
    return this.usersService.discover(query, user.id);
  }

  @Get("by-username/:username")
  @ApiOperation({ summary: "Get user profile by username" })
  async getUserByUsername(
    @Param("username") username: string,
    @Query("fieldToExtractCodes") fieldToExtractCodes: FieldToExtractCodes,
    @Query("currentUserLat") currentUserLat?: number,
    @Query("currentUserLon") currentUserLon?: number,
  ) {
    return this.usersService.findByUsername(
      username,
      fieldToExtractCodes,
      currentUserLat,
      currentUserLon,
    );
  }

  @Post("me/photos")
  @ApiOperation({
    summary: "Link a photo URL to your profile (URL from media-service)",
  })
  async addPhotoUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { imageUrl: string },
  ) {
    if (!body.imageUrl) {
      throw new BadRequestException("imageUrl is required");
    }
    return this.usersService.addPhoto(user.id, body.imageUrl);
  }

  @Put("me")
  @ApiOperation({ summary: "Update your own profile" })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(dto, user.id);
  }

  @Put(":id/update")
  @ApiOperation({ summary: "Update a profile (self or admin only)" })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
    @Param("id") id: string,
  ) {
    this.assertSelfOrAdmin(user, id);
    return this.usersService.updateProfile(dto, id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get profile by internal UUID" })
  async getById(
    @Param("id") id: string,
    @Query("fieldToExtractCodes") fieldToExtractCodes: FieldToExtractCodes,
    @Query("currentUserLat") currentUserLat?: number,
    @Query("currentUserLon") currentUserLon?: number,
  ) {
    return this.usersService.findById(
      id,
      fieldToExtractCodes,
      currentUserLat,
      currentUserLon,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft delete a user (self or admin only)" })
  async softDeleteUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    this.assertSelfOrAdmin(user, id);
    await this.usersService.softDelete(id);
  }
}
