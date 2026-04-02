import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto, DiscoverQueryDto } from "./dto/user.dto";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: diskStorage({
        destination: "./uploads/photos",
        filename: (_req, file, cb) => {
          cb(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
          cb(null, true);
        } else {
          cb(new Error("Only image files are allowed"), false);
        }
      },
    }),
  )
  @ApiOperation({ summary: "Upload profile photo" })
  async uploadPhoto(
    @Param("keycloakId") keycloakId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // When forwarded from gateway without actual file, use body filename
    const filename = file?.filename ?? "placeholder.jpg";
    return this.usersService.addPhoto(keycloakId, filename);
  }

  @Delete(":keycloakId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft delete a user" })
  async deleteUser(@Param("keycloakId") keycloakId: string) {
    await this.usersService.softDelete(keycloakId);
  }
}
