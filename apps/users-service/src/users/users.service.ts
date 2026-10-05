import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { User } from "./user.entity";
import { CreateUserDto, UpdateUserDto, DiscoverQueryDto } from "./dto/user.dto";
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
  data: Partial<UserWithDistance>[];
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
    "isActive",
    "preferences",
    "latitude",
    "longitude",
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

function withDistance(
  user: User,
  currentUserLat?: number,
  currentUserLon?: number,
): UserWithDistance {
  const userLat = toCoordinate(user.latitude);
  const userLon = toCoordinate(user.longitude);
  const viewerLat = toCoordinate(currentUserLat);
  const viewerLon = toCoordinate(currentUserLon);

  if (userLat === undefined || userLon === undefined) {
    return { ...user };
  }
  if (viewerLat === undefined || viewerLon === undefined) {
    return { ...user };
  }

  const distanceKm = calculateDistance(viewerLat, viewerLon, userLat, userLon);

  return {
    ...user,
    latitude: undefined,
    longitude: undefined,
    distance: Math.round(distanceKm * 10) / 10,
  };
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  private readonly kcAdminClient: KcAdminClient;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
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
        firstName: dto.firstName ?? dto.username,
        lastName: dto.lastName ?? "User",
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

  async updateProfile(dto: UpdateUserDto, id: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`No profile found for keycloakId=${id}`);
    }

    // Only update fields if they are provided in the DTO
    if (dto.username !== undefined) user.username = dto.username;
    if (dto.title !== undefined) user.title = dto.title;
    if (dto.bio !== undefined) user.bio = dto.bio;
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.birthdate !== undefined) user.birthdate = dto.birthdate;
    if (dto.latitude !== undefined) user.latitude = dto.latitude;
    if (dto.longitude !== undefined) user.longitude = dto.longitude;
    if (dto.city !== undefined) user.city = dto.city;
    if (dto.country !== undefined) user.country = dto.country;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.preferences !== undefined) user.preferences = dto.preferences;
    if (dto.photos !== undefined) user.photos = dto.photos;

    const updatedUser = await this.usersRepo.save(user);
    this.logger.log(`Updated profile for user ${id}`);
    return updatedUser;
  }

  async findById(
    id: string,
    fieldToExtractCodes?: FieldToExtractCodes,
    currentUserLat?: number,
    currentUserLon?: number,
  ): Promise<UserWithDistance> {
    const user = await this.usersRepo.findOne({
      where: { id },
      select: resolveFields(fieldToExtractCodes),
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return withDistance(user, currentUserLat, currentUserLon);
  }

  async findByUsername(
    username: string,
    fieldToExtractCodes?: FieldToExtractCodes,
    currentUserLat?: number,
    currentUserLon?: number,
  ): Promise<Partial<UserWithDistance>> {
    const user = await this.usersRepo.findOne({
      where: { username },
      select: resolveFields(fieldToExtractCodes),
    });

    if (!user) {
      throw new NotFoundException(`User ${username} not found`);
    }

    return withDistance(user, currentUserLat, currentUserLon);
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

  async addPhoto(id: string, filename: string): Promise<User> {
    const user = await this.findFullById(id);
    user.photos = [...(user.photos ?? []), filename];
    return this.usersRepo.save(user);
  }

  async discover(
    query: DiscoverQueryDto,
    excludeUserId?: string,
  ): Promise<PaginatedUsers> {
    const { gender, ageMin, ageMax, page = 1, limit = 20 } = query;
    const sanitizedPage = Math.max(1, Math.floor(page));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const qb = this.usersRepo
      .createQueryBuilder("user")
      .where("user.isActive = :isActive", { isActive: true });

    if (excludeUserId) {
      qb.andWhere("user.id != :excludeUserId", { excludeUserId });
    }
    if (gender) {
      qb.andWhere("user.gender = :gender", { gender });
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
        "user.latitude",
        "user.longitude",
      ])
      .skip((sanitizedPage - 1) * sanitizedLimit)
      .take(sanitizedLimit)
      .getMany();

    const totalPages = Math.ceil(total / sanitizedLimit);

    return {
      data: data.map((user) =>
        withDistance(user, query.currentUserLat, query.currentUserLon),
      ),
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages,
    };
  }

  async softDelete(id: string): Promise<void> {
    const user = await this.findFullById(id);
    user.isActive = false;
    await this.usersRepo.save(user);

    await this.kafkaProducer.emit<UserDeletedEvent>(KAFKA_TOPICS.USER_DELETED, {
      keycloakId: id,
    });
    this.logger.log(`Soft-deleted user keycloakId=${id}`);
  }
}
