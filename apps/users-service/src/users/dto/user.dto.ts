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
  Matches,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsIn,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from "class-validator";
import { Exclude, Expose, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Gender } from "../user.entity";
import {
  HasChildren,
  ProfileVisibility,
  RelationshipType,
  SexualInterest,
  WantsChildren,
} from "../user-profile.enums";

const ISO_639_1_CODES =
  "aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu".split(
    " ",
  );

function isAdultDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const birthdate = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(birthdate.getTime())) return false;

  const now = new Date();
  let age = now.getUTCFullYear() - birthdate.getUTCFullYear();
  const birthdayHasPassed =
    now.getUTCMonth() > birthdate.getUTCMonth() ||
    (now.getUTCMonth() === birthdate.getUTCMonth() &&
      now.getUTCDate() >= birthdate.getUTCDate());
  if (!birthdayHasPassed) age -= 1;
  return age >= 18;
}

function IsAdult(validationOptions?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: "isAdult",
      target: target.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isAdultDate,
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} must be a date for a person aged 18 or older`,
      },
    });
  };
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

  @IsOptional()
  @IsNumber()
  @Min(120)
  @Max(250)
  heightMinCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(120)
  @Max(250)
  heightMaxCm?: number;
}

export class CreateUserDto {
  // keycloakId removed as requested

  @IsEmail()
  @ApiProperty({ example: "user@example.com" })
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "Username can only contain letters, numbers, underscores, and dashes.",
  })
  @ApiProperty({ example: "johndoe" })
  username!: string;

  // Password added with basic validation
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  @ApiProperty({ example: "SecretPassword123" })
  password!: string;

  @IsEnum(Gender)
  @ApiProperty({ enum: Gender })
  gender!: Gender;

  @IsDateString({ strict: true })
  @IsAdult()
  @ApiProperty({ example: "1995-06-15", format: "date" })
  birthdate!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  @ApiProperty({ example: 51.5074, minimum: -90, maximum: 90 })
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  @ApiProperty({ example: -0.1278, minimum: -180, maximum: 180 })
  longitude!: number;

  // Keycloak 26 requires a name on the account, otherwise it flags
  // UPDATE_PROFILE and the user's first login fails with invalid_grant.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional()
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional()
  lastName?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "Username can only contain letters, numbers, underscores, and dashes.",
  })
  @ApiProperty({ example: "johndoe" })
  username!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional()
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional()
  bio?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @IsAdult()
  @ApiPropertyOptional()
  birthdate?: string;

  @IsOptional()
  @IsNumber()
  @Min(120)
  @Max(250)
  @Type(() => Number)
  @ApiPropertyOptional({ minimum: 120, maximum: 250 })
  heightCm?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsIn(ISO_639_1_CODES, { each: true })
  @ApiPropertyOptional({ type: [String], example: ["en", "fr"] })
  languagesSpoken?: string[];

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

  @IsOptional()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: [String] })
  photos?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsEnum(RelationshipType, { each: true })
  @ApiPropertyOptional({ enum: RelationshipType, isArray: true })
  relationshipTypesSought?: RelationshipType[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsEnum(SexualInterest, { each: true })
  @ApiPropertyOptional({ enum: SexualInterest, isArray: true })
  sexualInterests?: SexualInterest[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @ApiPropertyOptional({ maxLength: 300 })
  fantasiesText?: string;

  @IsOptional()
  @IsEnum(HasChildren)
  @ApiPropertyOptional({ enum: HasChildren })
  hasChildren?: HasChildren;

  @IsOptional()
  @IsEnum(WantsChildren)
  @ApiPropertyOptional({ enum: WantsChildren })
  wantsChildren?: WantsChildren;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  @ApiPropertyOptional({ enum: ProfileVisibility })
  relationshipTypesSoughtVisibility?: ProfileVisibility;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  @ApiPropertyOptional({ enum: ProfileVisibility })
  sexualInterestsVisibility?: ProfileVisibility;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  @ApiPropertyOptional({ enum: ProfileVisibility })
  fantasiesTextVisibility?: ProfileVisibility;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  @ApiPropertyOptional({ enum: ProfileVisibility })
  hasChildrenVisibility?: ProfileVisibility;

  @IsOptional()
  @IsEnum(ProfileVisibility)
  @ApiPropertyOptional({ enum: ProfileVisibility })
  wantsChildrenVisibility?: ProfileVisibility;
}

export class UpdateUserDto extends UpdateProfileDto {}

@Exclude()
export class PublicUserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  username!: string;

  @Expose()
  title?: string;

  @Expose()
  bio?: string;

  @Expose()
  age?: number;

  @Expose()
  birthdate?: string;

  @Expose()
  gender?: Gender;

  @Expose()
  heightCm?: number;

  @Expose()
  languagesSpoken?: string[];

  @Expose()
  preferences?: {
    ageMin?: number;
    ageMax?: number;
    genderPreference?: string;
    maxDistance?: number;
    heightMinCm?: number;
    heightMaxCm?: number;
  };

  @Expose()
  relationshipTypesSought?: string[];

  @Expose()
  sexualInterests?: string[];

  @Expose()
  hasChildren?: string;

  @Expose()
  wantsChildren?: string;

  @Expose()
  photos?: string[];

  @Expose()
  city?: string;

  @Expose()
  country?: string;

  @Expose()
  distance?: number;
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

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiPropertyOptional()
  currentUserLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @ApiPropertyOptional()
  currentUserLon?: number;
}
