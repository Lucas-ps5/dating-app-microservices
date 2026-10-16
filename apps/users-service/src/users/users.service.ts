import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError, In } from "typeorm";
import { plainToInstance } from "class-transformer";
import { ConfigService } from "@nestjs/config";
import { User } from "./user.entity";
import { UserSensitiveProfile } from "./user-sensitive-profile.entity";
import {
  CreateUserDto,
  DiscoverQueryDto,
  PublicUserResponseDto,
  UpdateLocationDto,
  UpdateProfileDto,
} from "./dto/user.dto";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import {
  CreationResponse,
  FieldToExtractCodes,
  KAFKA_TOPICS,
  UserDeletedEvent,
  calculateDistance,
} from "@app/common";
import KcAdminClient from "@keycloak/keycloak-admin-client";
import { UserWithDistance } from "./interfaces/user-with-distance.interface";

export interface PaginatedUsers {
  data: PublicUserResponseDto[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

const FIELD_MAP: Record<FieldToExtractCodes, readonly (keyof User)[]> = {
  "Code-1": [
    "id",
    "username",
    "photos",
    "title",
    "bio",
    "gender",
    "birthdate",
    "heightCm",
    "languagesSpoken",
    "preferences",
    "isActive",
    "latitude",
    "longitude",
    "city",
    "country",
    "createdAt",
    "updatedAt",
  ],
  "Code-2": [
    "id",
    "username",
    "photos",
    "title",
    "city",
    "latitude",
    "longitude",
  ],
} as const;

const DEFAULT_FIELD_CODE: FieldToExtractCodes = "Code-1";

/**
 * Resolves the column projection for a field code, rejecting unknown values
 * instead of spreading `undefined` into the TypeORM `select` array.
 */
function resolveFields(code?: FieldToExtractCodes): (keyof User)[] {
  if (!code) return [...FIELD_MAP[DEFAULT_FIELD_CODE]];

  const fields = FIELD_MAP[code];
  if (!fields) {
    throw new BadRequestException(
      `Unknown fieldToExtractCodes "${code}". Expected one of: ${Object.keys(FIELD_MAP).join(", ")}`,
    );
  }
  return [...fields];
}

/**
 * Postgres `numeric`/`decimal` columns come back from `pg` as strings, and a
 * legitimate coordinate of 0 is falsy — so normalise before doing maths.
 */
function toCoordinate(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

type PublicProfileData = Partial<User> & {
  relationshipTypesSought?: string[];
  sexualInterests?: string[];
  hasChildren?: string;
  wantsChildren?: string;
};

function withDistance(
  user: PublicProfileData,
  currentUserLat?: number,
  currentUserLon?: number,
): UserWithDistance & PublicProfileData {
  const userLat = toCoordinate(user.latitude);
  const userLon = toCoordinate(user.longitude);
  const viewerLat = toCoordinate(currentUserLat);
  const viewerLon = toCoordinate(currentUserLon);

  if (userLat === undefined || userLon === undefined) {
    return { ...user, latitude: undefined };
  }
  if (viewerLat === undefined || viewerLon === undefined) {
    return { ...user, longitude: undefined };
  }

  const distanceKm = calculateDistance(viewerLat, viewerLon, userLat, userLon);

  return {
    ...user,
    latitude: undefined,
    longitude: undefined,
    distance: Math.round(distanceKm * 10) / 10,
  };
}

function calculateAge(birthdate: string): number {
  const date = new Date(`${birthdate}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (
    now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() &&
      now.getUTCDate() < date.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

function toPublicUserResponse(
  user: Partial<UserWithDistance & PublicProfileData>,
): PublicUserResponseDto {
  const response = plainToInstance(PublicUserResponseDto, user, {
    excludeExtraneousValues: true,
  });
  if (user.birthdate) response.age = calculateAge(user.birthdate);
  return response;
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  private readonly kcAdminClient: KcAdminClient;
  private geocodingQueue: Promise<void> = Promise.resolve();
  private lastGeocodingRequestAt = 0;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserSensitiveProfile)
    private readonly sensitiveProfilesRepo: Repository<UserSensitiveProfile>,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly configService: ConfigService,
  ) {
    this.kcAdminClient = new KcAdminClient({
      baseUrl:
        this.configService.get<string>("KEYCLOAK_URL") ??
        "http://localhost:8080",
      realmName:
        this.configService.get<string>("KEYCLOAK_ADMIN_REALM") ?? "master",
    });
  }

  /**
   * Realm the admin API operates on. Passed per call rather than pushed into
   * the shared client config, because `auth()` must keep targeting `master`:
   * repointing the client at `hmeet` makes every later re-auth fail with
   * invalid_grant, as there is no admin user in the application realm.
   */
  private get appRealm(): string {
    return this.configService.get<string>("KEYCLOAK_REALM") ?? "hmeet";
  }

  /** Authenticate (or re-authenticate) the admin client against Keycloak. */
  private async authenticate(): Promise<void> {
    await this.kcAdminClient.auth({
      username:
        this.configService.get<string>("KEYCLOAK_ADMIN_USERNAME") ?? "admin",
      password:
        this.configService.get<string>("KEYCLOAK_ADMIN_PASSWORD") ?? "admin",
      grantType: "password",
      clientId:
        this.configService.get<string>("KEYCLOAK_ADMIN_CLIENT_ID") ??
        "admin-cli",
    });
  }

  async onModuleInit() {
    try {
      await this.authenticate();
      this.logger.log("Successfully connected to Keycloak Admin API");
    } catch (error) {
      this.logger.error("Failed to connect to Keycloak Admin API", error);
    }
  }

  /**
   * REGISTER USER
   * 1. Create user in Keycloak
   * 2. Get the ID back
   * 3. Save user locally with that ID
   */
  async register(dto: CreateUserDto): Promise<CreationResponse> {
    const location = await this.reverseGeocode(dto.latitude, dto.longitude);

    // 1. Create User in Keycloak
    let keycloakId: string;
    try {
      await this.authenticate();
      const response = await this.kcAdminClient.users.create({
        realm: this.appRealm,
        username: dto.username,
        email: dto.email,
        enabled: true,
        // Keycloak 26 attaches UPDATE_PROFILE to accounts with no name, which
        // makes their first password grant fail with invalid_grant.
        firstName: dto.firstName ?? "empty",
        lastName: dto.lastName ?? "empty",
        credentials: [
          {
            type: "password",
            value: dto.password,
            temporary: false,
          },
        ],
        emailVerified: false,
      });

      keycloakId = response.id;
    } catch (error) {
      this.logger.error("Keycloak registration failed", error);
      if (
        error instanceof Error &&
        (error as { response?: { status?: number } }).response?.status === 409
      ) {
        throw new ConflictException("User already exists in Keycloak");
      }
      throw error;
    }

    const user = this.usersRepo.create({
      id: keycloakId,
      email: dto.email,
      username: dto.username,
      gender: dto.gender,
      birthdate: dto.birthdate,
      latitude: dto.latitude,
      longitude: dto.longitude,
      city: location?.city,
      country: location?.country,
    });

    try {
      const savedUser = await this.usersRepo.save(user);
      this.logger.log(
        `Registered new user: keycloakId=${keycloakId}, email=${dto.email}`,
      );
      return { newId: savedUser.id };
    } catch (error) {
      // Rollback: If DB save fails, delete from Keycloak to stay consistent
      try {
        await this.authenticate();
        await this.kcAdminClient.users.del({
          realm: this.appRealm,
          id: keycloakId,
        });
      } catch (rollbackError) {
        this.logger.error(
          "Rollback failed. Keycloak user is orphaned.",
          rollbackError,
        );
      }
      this.logger.error(
        `DB save failed. Rolling back Keycloak user ${keycloakId}`,
      );
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === "23505"
      ) {
        // 23505 is the Postgres error code for unique constraint violation
        throw new ConflictException("Username is already taken.");
      }
      throw error;
    }
  }

  /**
   * Resolve a coordinate to a city/country with the free OpenStreetMap
   * Nominatim service. Its public endpoint allows at most one request per
   * second, so serialize and pace requests made by this service instance.
   * Geocoding is best-effort: the submitted coordinates are always saved.
   */
  private async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<{ city?: string; country?: string } | undefined> {
    let release!: () => void;
    const previousRequest = this.geocodingQueue;
    this.geocodingQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previousRequest;
    try {
      const waitMs = Math.max(
        0,
        1000 - (Date.now() - this.lastGeocodingRequestAt),
      );
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastGeocodingRequestAt = Date.now();

      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.search = new URLSearchParams({
        format: "jsonv2",
        addressdetails: "1",
        lat: String(latitude),
        lon: String(longitude),
      }).toString();

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            this.configService.get<string>("GEOCODING_USER_AGENT") ??
            "HMeet Dating App/1.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`Nominatim returned HTTP ${response.status}`);
      }

      const result = (await response.json()) as {
        address?: {
          city?: string;
          town?: string;
          village?: string;
          municipality?: string;
          city_district?: string;
          country?: string;
        };
      };
      const address = result.address;
      const city =
        address?.city ??
        address?.town ??
        address?.village ??
        address?.municipality ??
        address?.city_district;
      return city || address?.country
        ? { city, country: address?.country }
        : undefined;
    } catch (error) {
      this.logger.warn(
        `Reverse geocoding failed; saving coordinates without city/country: ${String(error)}`,
      );
      return undefined;
    } finally {
      release();
    }
  }

  async updateLocation(
    id: string,
    dto: UpdateLocationDto,
  ): Promise<{ city?: string; country?: string }> {
    const user = await this.findFullById(id);
    const location = await this.reverseGeocode(dto.latitude, dto.longitude);

    user.latitude = dto.latitude;
    user.longitude = dto.longitude;
    user.city = location?.city ?? null;
    user.country = location?.country ?? null;
    await this.usersRepo.save(user);

    return {
      city: location?.city,
      country: location?.country,
    };
  }

  async updateProfile(
    dto: UpdateProfileDto,
    id: string,
    actorId = id,
  ): Promise<void> {
    await this.usersRepo.manager.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const sensitiveProfilesRepo = manager.getRepository(UserSensitiveProfile);
      const user = await usersRepo.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(`No profile found for keycloakId=${id}`);
      }

      if (dto.username !== undefined) user.username = dto.username;
      if (dto.title !== undefined) user.title = dto.title;
      if (dto.bio !== undefined) user.bio = dto.bio;
      if (dto.gender !== undefined) user.gender = dto.gender;
      if (dto.birthdate !== undefined) user.birthdate = dto.birthdate;
      if (dto.heightCm !== undefined) user.heightCm = dto.heightCm;
      if (dto.languagesSpoken !== undefined)
        user.languagesSpoken = dto.languagesSpoken;
      if (dto.latitude !== undefined) user.latitude = dto.latitude;
      if (dto.longitude !== undefined) user.longitude = dto.longitude;
      if (dto.city !== undefined) user.city = dto.city;
      if (dto.country !== undefined) user.country = dto.country;
      if (dto.isActive !== undefined) user.isActive = dto.isActive;
      if (dto.preferences !== undefined) user.preferences = dto.preferences;

      const sensitiveProfile = await sensitiveProfilesRepo
        .createQueryBuilder("profile")
        .addSelect([
          "profile.relationshipTypesSought",
          "profile.sexualInterests",
          "profile.fantasiesText",
          "profile.hasChildren",
          "profile.wantsChildren",
          "profile.relationshipTypesSoughtVisibility",
          "profile.sexualInterestsVisibility",
          "profile.fantasiesTextVisibility",
          "profile.hasChildrenVisibility",
          "profile.wantsChildrenVisibility",
        ])
        .where("profile.userId = :id", { id })
        .getOne();

      const profile =
        sensitiveProfile ??
        sensitiveProfilesRepo.create({
          userId: id,
        });

      if (dto.relationshipTypesSought !== undefined)
        profile.relationshipTypesSought = dto.relationshipTypesSought;
      if (dto.sexualInterests !== undefined)
        profile.sexualInterests = dto.sexualInterests;
      if (dto.fantasiesText !== undefined)
        profile.fantasiesText = dto.fantasiesText;
      if (dto.hasChildren !== undefined) profile.hasChildren = dto.hasChildren;
      if (dto.wantsChildren !== undefined)
        profile.wantsChildren = dto.wantsChildren;
      if (dto.relationshipTypesSoughtVisibility !== undefined)
        profile.relationshipTypesSoughtVisibility =
          dto.relationshipTypesSoughtVisibility;
      if (dto.sexualInterestsVisibility !== undefined)
        profile.sexualInterestsVisibility = dto.sexualInterestsVisibility;
      if (dto.fantasiesTextVisibility !== undefined)
        profile.fantasiesTextVisibility = dto.fantasiesTextVisibility;
      if (dto.hasChildrenVisibility !== undefined)
        profile.hasChildrenVisibility = dto.hasChildrenVisibility;
      if (dto.wantsChildrenVisibility !== undefined)
        profile.wantsChildrenVisibility = dto.wantsChildrenVisibility;

      await sensitiveProfilesRepo.save(profile);

      await usersRepo.save(user);
    });

    if (
      dto.relationshipTypesSought !== undefined ||
      dto.sexualInterests !== undefined ||
      dto.fantasiesText !== undefined ||
      dto.hasChildren !== undefined ||
      dto.wantsChildren !== undefined ||
      dto.relationshipTypesSoughtVisibility !== undefined ||
      dto.sexualInterestsVisibility !== undefined ||
      dto.fantasiesTextVisibility !== undefined ||
      dto.hasChildrenVisibility !== undefined ||
      dto.wantsChildrenVisibility !== undefined
    ) {
      this.logger.log(
        JSON.stringify({
          event: "sensitive_profile_access",
          action: "profile_updated",
          actorId,
          subjectUserId: id,
          occurredAt: new Date().toISOString(),
        }),
      );
    }
    this.logger.log(`Updated profile for user ${id}`);
  }

  async findById(
    id: string,
    fieldToExtractCodes?: FieldToExtractCodes,
    currentUserLat?: number,
    currentUserLon?: number,
  ): Promise<PublicUserResponseDto> {
    const user = await this.usersRepo.findOne({
      where: { id },
      select: resolveFields(fieldToExtractCodes),
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const sensitiveProfile = await this.sensitiveProfilesRepo.findOne({
      where: { userId: id },
      select: [
        "relationshipTypesSought",
        "sexualInterests",
        "hasChildren",
        "wantsChildren",
      ],
    });

    return toPublicUserResponse(
      withDistance(
        {
          ...user,
          relationshipTypesSought: sensitiveProfile?.relationshipTypesSought,
          sexualInterests: sensitiveProfile?.sexualInterests,
          hasChildren: sensitiveProfile?.hasChildren,
          wantsChildren: sensitiveProfile?.wantsChildren,
        } as PublicProfileData,
        currentUserLat,
        currentUserLon,
      ),
    );
  }

  async findByIds(
    userIds: string[],
  ): Promise<Array<Pick<User, "id" | "username" | "photos">>> {
    if (userIds.length === 0) return [];

    const users = await this.usersRepo.find({
      where: { id: In(userIds) },
      select: ["id", "username", "photos"],
    });

    return users.map(({ id, username, photos }) => ({
      id,
      username,
      photos: photos?.slice(0, 1) ?? [],
    }));
  }

  async findByUsername(
    username: string,
    fieldToExtractCodes?: FieldToExtractCodes,
    currentUserLat?: number,
    currentUserLon?: number,
  ): Promise<PublicUserResponseDto> {
    const user = await this.usersRepo.findOne({
      where: { username },
      select: resolveFields(fieldToExtractCodes),
    });

    if (!user) {
      throw new NotFoundException(`User ${username} not found`);
    }

    const sensitiveProfile = await this.sensitiveProfilesRepo.findOne({
      where: { userId: user.id },
      select: [
        "relationshipTypesSought",
        "sexualInterests",
        "hasChildren",
        "wantsChildren",
      ],
    });

    return toPublicUserResponse(
      withDistance(
        {
          ...user,
          relationshipTypesSought: sensitiveProfile?.relationshipTypesSought,
          sexualInterests: sensitiveProfile?.sexualInterests,
          hasChildren: sensitiveProfile?.hasChildren,
          wantsChildren: sensitiveProfile?.wantsChildren,
        } as PublicProfileData,
        currentUserLat,
        currentUserLon,
      ),
    );
  }

  /**
   * Loads the full entity for mutation. Never pass a column-projected entity
   * to `save()` — TypeORM writes `undefined` back for unselected columns,
   * silently wiping them.
   */
  private async findFullById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`No profile found for keycloakId=${id}`);
    }
    return user;
  }

  async addPhoto(id: string, filename: string): Promise<PublicUserResponseDto> {
    const user = await this.findFullById(id);
    user.photos = [...(user.photos ?? []), filename];
    return toPublicUserResponse(await this.usersRepo.save(user));
  }

  async discover(
    query: DiscoverQueryDto,
    currentUserId: string,
  ): Promise<PaginatedUsers> {
    const { gender, ageMin, ageMax, page = 1, limit = 20 } = query;
    const sanitizedPage = Math.max(1, Math.floor(page));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const currentUser = await this.usersRepo.findOne({
      where: { id: currentUserId },
      select: ["id", "gender"],
    });
    if (!currentUser) {
      throw new NotFoundException(
        `No profile found for keycloakId=${currentUserId}`,
      );
    }

    const qb = this.usersRepo
      .createQueryBuilder("user")
      .where("user.isActive = :isActive", { isActive: true });

    qb.andWhere("user.id != :currentUserId", { currentUserId });
    if (gender !== undefined) {
      qb.andWhere("user.gender = :gender", { gender });
    } else {
      qb.andWhere("user.gender != :currentUserGender", {
        currentUserGender: currentUser.gender,
      });
    }
    if (ageMin) {
      const maxBirthdate = new Date();
      maxBirthdate.setFullYear(maxBirthdate.getFullYear() - ageMin);
      qb.andWhere("user.birthdate <= :maxBirthdate", {
        maxBirthdate: maxBirthdate.toISOString().slice(0, 10),
      });
    }
    if (ageMax) {
      const minBirthdate = new Date();
      minBirthdate.setFullYear(minBirthdate.getFullYear() - ageMax);
      qb.andWhere("user.birthdate >= :minBirthdate", {
        minBirthdate: minBirthdate.toISOString().slice(0, 10),
      });
    }

    const total = await qb.getCount();

    const data = await qb
      .select([
        "user.id",
        "user.username",
        "user.photos",
        "user.title",
        "user.birthdate",
        "user.gender",
        "user.birthdate",
        "user.heightCm",
        "user.languagesSpoken",
        "user.city",
        "user.country",
        "user.latitude",
        "user.longitude",
      ])
      .skip((sanitizedPage - 1) * sanitizedLimit)
      .take(sanitizedLimit)
      .getMany();

    const totalPages = Math.ceil(total / sanitizedLimit);

    return {
      data: data.map((user) =>
        toPublicUserResponse(
          withDistance(user, query.currentUserLat, query.currentUserLon),
        ),
      ),
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages,
    };
  }

  async softDelete(id: string, actorId = id): Promise<void> {
    await this.usersRepo.manager.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const user = await usersRepo.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(`No profile found for keycloakId=${id}`);
      }

      user.isActive = false;
      await usersRepo.save(user);
      await manager.getRepository(UserSensitiveProfile).delete({ userId: id });
    });

    this.logger.log(
      JSON.stringify({
        event: "sensitive_profile_access",
        action: "account_deactivated_and_sensitive_profile_erased",
        actorId,
        subjectUserId: id,
        occurredAt: new Date().toISOString(),
      }),
    );

    await this.kafkaProducer.emit<UserDeletedEvent>(KAFKA_TOPICS.USER_DELETED, {
      keycloakId: id,
    });
    this.logger.log(`Soft-deleted user keycloakId=${id}`);
  }
}
