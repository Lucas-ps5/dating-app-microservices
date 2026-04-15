import {
  Controller,
  Get,
  Post,
  Patch,
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

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  async register(@Body() dto: CreateUserDto) {
    return this.usersService.register(dto);
  }

  @Post("profile")
  @ApiOperation({
    summary: "Create profile (called by api-gateway on first login)",
  })
  async createProfile(@Body() dto: CreateUserDto) {
    return this.usersService.createOrUpdate(dto);
  }

  @Get("by-keycloak/:keycloakId")
  @ApiOperation({ summary: "Get profile by Keycloak ID" })
  async getByKeycloakId(@Param("keycloakId") keycloakId: string) {
    return this.usersService.findByKeycloakId(keycloakId);
  }

  @Get("discover")
  @ApiOperation({ summary: "Discover potential matches" })
  async discover(@Query() query: DiscoverQueryDto) {
    return this.usersService.discover(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get profile by internal UUID" })
  async getById(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Patch("by-keycloak/:keycloakId")
  @ApiOperation({ summary: "Update profile by Keycloak ID" })
  async updateByKeycloakId(
    @Param("keycloakId") keycloakId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateByKeycloakId(keycloakId, dto);
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
