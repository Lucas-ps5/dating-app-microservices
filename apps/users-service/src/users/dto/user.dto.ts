import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
  Max,
  MinLength,
  IsEnum,
  ValidateNested,
  IsNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// 1. Define an Enum for strict gender validation
export enum Gender {
  MALE = "male",
  FEMALE = "female",
}

// 2. Create a separate DTO for Preferences to enable deep validation
export class UserPreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(18)
  ageMin?: number;

  @IsOptional()
  @IsNumber()
  @Max(100)
  ageMax?: number;

  @IsOptional()
  @IsString()
  genderPreference?: string;

  @IsOptional()
  @IsNumber()
  maxDistance?: number;
}

export class CreateUserDto {
  // keycloakId removed as requested

  @IsEmail()
  @ApiProperty({ example: "user@example.com" })
  email: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  username?: string;

  // Password added with basic validation
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  @ApiProperty({ example: "SecretPassword123" })
  password: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiPropertyOptional()
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional()
  bio?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional()
  birthdate?: string;

  // Using the Enum for strict validation
  @IsOptional()
  @IsEnum(Gender)
  @ApiPropertyOptional({ enum: Gender })
  gender?: Gender;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  @ApiPropertyOptional()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  @ApiPropertyOptional()
  longitude?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  city?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  country?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isActive?: boolean;

  // Using ValidateNested to validate the inner object
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  @ApiPropertyOptional({ type: UserPreferencesDto })
  preferences?: UserPreferencesDto;
}

export class DiscoverQueryDto {
  // currentUserId removed for security. You should get this from the JWT token in the controller.

  @IsOptional()
  @IsEnum(Gender)
  @ApiPropertyOptional({ enum: Gender })
  gender?: Gender;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiPropertyOptional()
  ageMin?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiPropertyOptional()
  ageMax?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiPropertyOptional({ default: 1 })
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiPropertyOptional({ default: 20 })
  limit?: number = 20;
}
