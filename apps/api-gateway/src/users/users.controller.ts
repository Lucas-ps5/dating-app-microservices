import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/user.interface';
import { UsersProxyService } from './users-proxy.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersProxy: UsersProxyService) {}

  @Post('profile')
  @ApiOperation({ summary: 'Create or update my profile' })
  async createProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    const res = await this.usersProxy.forward('post', '/profile', {
      body: { ...body, keycloakId: user.userId, email: user.email },
      user,
    });
    return res.data;
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get my profile' })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    const res = await this.usersProxy.forward(
      'get',
      `/by-keycloak/${user.userId}`,
      { user },
    );
    return res.data;
  }

  @Get('discover')
  @ApiOperation({ summary: 'Discover potential matches' })
  async discover(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    const res = await this.usersProxy.forward('get', '/discover', {
      user,
      params: { ...query, currentUserId: user.userId },
    });
    return res.data;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by ID' })
  async getUserById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.usersProxy.forward('get', `/${id}`, { user });
    return res.data;
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update my profile' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    const res = await this.usersProxy.forward(
      'patch',
      `/by-keycloak/${user.userId}`,
      { body, user },
    );
    return res.data;
  }

  @Post('me/photos')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload a profile photo' })
  async uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const res = await this.usersProxy.forward(
      'post',
      `/by-keycloak/${user.userId}/photos`,
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user (admin)' })
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.usersProxy.forward('delete', `/${id}`, { user });
    return res.data;
  }
}
