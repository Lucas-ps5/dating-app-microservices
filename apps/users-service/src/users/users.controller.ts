import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto, DiscoverQueryDto } from "./dto/user.dto";
import { AuthenticatedUser, FieldToExtractCodes } from "@app/common";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  async register(@Body() dto: CreateUserDto) {
    return this.usersService.register(dto);
  }

  @Post("update")
  @ApiOperation({
    summary: "Update profile (called by api-gateway on first login)",
  })
  async updateProfile(
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateProfile(dto, user);
  }

  @Get("discover")
  @ApiOperation({ summary: "Discover potential matches" })
  async discover(@Query() query: DiscoverQueryDto) {
    return this.usersService.discover(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get profile by internal UUID" })
  async getById(
    @Param("id") id: string,
    @Query("fieldToExtractCodes")
    fieldToExtractCodes: FieldToExtractCodes,
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

  @Get("by-username/:username")
  @ApiOperation({ summary: "Get profile by username" })
  async getByUsername(
    @Param("username") username: string,
    @Query("fieldToExtractCodes")
    fieldToExtractCodes: FieldToExtractCodes,
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

  @Post("by-keycloak/:keycloakId/photos")
  @ApiOperation({
    summary:
      "Link a photo URL to a user profile (URL returned by media-service)",
  })
  async addPhotoUrl(
    @Param("keycloakId") keycloakId: string,
    @Body() body: { imageUrl: string },
  ) {
    if (!body.imageUrl) {
      throw new BadRequestException("imageUrl is required");
    }
    return this.usersService.addPhoto(keycloakId, body.imageUrl);
  }

  @Delete(":keycloakId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft delete a user" })
  async deleteUser(@Param("keycloakId") keycloakId: string) {
    await this.usersService.softDelete(keycloakId);
  }
}
