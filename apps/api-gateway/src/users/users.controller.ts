import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Logger,
  Put,
  Request,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/user.interface";
import { UsersProxyService } from "./users-proxy.service";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("user")
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersProxy: UsersProxyService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  async register(@Body() body: Record<string, unknown>) {
    return this.usersProxy.forward("post", "/register", { body });
  }

  @Get("discover")
  @ApiOperation({ summary: "Discover potential matches" })
  async discover(@Query() query: Record<string, string>) {
    const res = await this.usersProxy.forward("get", "/discover", {
      params: { ...query },
    });
    return res.data;
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user profile by ID" })
  async getUserById(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.usersProxy.forward("get", `/${id}`, { user });
    return res.data;
  }

  @Put(":id/update")
  @ApiOperation({
    summary: "Update profile (called by api-gateway on first login)",
  })
  async updateProfile(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const res = await this.usersProxy.forward("put", `/${id}/update`, { body });
    return res.data;
  }

  @Post("me/photos")
  @UseInterceptors(FileInterceptor("photo"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { photo: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({ summary: "Upload a profile photo" })
  async uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const res = await this.usersProxy.forward(
      "post",
      `/by-keycloak/${user.id}/photos`,
      {
        body: {
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
        },
        user,
      },
    );
    return res.data;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a user (admin)" })
  async deleteUser(@Param("id") id: string) {
    const res = await this.usersProxy.forward("delete", `/${id}`);
    return res.data;
  }
}
