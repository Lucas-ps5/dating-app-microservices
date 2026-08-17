import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Gender, User } from "./user.entity";
import { CreateUserDto, UpdateUserDto, DiscoverQueryDto } from "./dto/user.dto";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import {
  CreationResponse,
  FieldToExtractCodes,
  KAFKA_TOPICS,
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

const FIELD_MAP = {
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

    this.kcAdminClient.setConfig({
      realmName: this.configService.get<string>("KEYCLOAK_REALM") ?? "hmeet",
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
        username: dto.username,
        email: dto.email,
        enabled: true,
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
        await this.kcAdminClient.users.del({ id: keycloakId });
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
    fieldToExtractCodes: FieldToExtractCodes,
    currentUserLat?: number,
    currentUserLon?: number,
  ): Promise<UserWithDistance> {
    const fieldsToSelect = FIELD_MAP[fieldToExtractCodes];

    const user = await this.usersRepo.findOne({
      where: { id },
      select: [...fieldsToSelect],
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const userWithDistance: UserWithDistance = { ...user };
    if (user.latitude && user.longitude && currentUserLat && currentUserLon) {
      const distanceKm = calculateDistance(
        currentUserLat,
        currentUserLon,
        user.latitude,
        user.longitude,
      );
      userWithDistance.distance = Math.round(distanceKm * 10) / 10;
    }

    return userWithDistance;
  }

  async findByUsername(
    username: string,
    fieldToExtractCodes: FieldToExtractCodes,
    currentUserLat?: number,
    currentUserLon?: number,
  ): Promise<Partial<UserWithDistance>> {
    const fieldsToSelect = FIELD_MAP[fieldToExtractCodes];

    const user = await this.usersRepo.findOne({
      where: { username },
      select: [...fieldsToSelect],
    });

    if (!user) {
      throw new NotFoundException(`User ${username} not found`);
    }

    const userWithDistance: UserWithDistance = { ...user };
    if (user.latitude && user.longitude && currentUserLat && currentUserLon) {
      const distanceKm = calculateDistance(
        currentUserLat,
        currentUserLon,
        user.latitude,
        user.longitude,
      );
      userWithDistance.distance = Math.round(distanceKm * 10) / 10;
    }

    return userWithDistance;
  }

  async allUsers({
    currentUserLat,
    currentUserLon,
    page,
    limit,
    gender,
  }: {
    currentUserLat?: number;
    currentUserLon?: number;
    page: number;
    limit: number;
    gender?: Gender;
  }): Promise<PaginatedUsers> {
    const sanitizedPage = Math.max(1, Math.floor(page));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const [users, total] = await this.usersRepo.findAndCount({
      where: { gender },
      order: { createdAt: "DESC" },
      select: [
        "id",
        "username",
        "photos",
        "title",
        "gender",
        "birthdate",
        "isActive",
        "latitude",
        "longitude",
      ],
      skip: (sanitizedPage - 1) * sanitizedLimit,
      take: sanitizedLimit,
    });

    const usersWithDistance: UserWithDistance[] = this.usersToUsersWithDistance(
      users,
      currentUserLat,
      currentUserLon,
    );

    const totalPages = Math.ceil(total / sanitizedLimit);

    return {
      data: usersWithDistance,
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages,
    };
  }

  async addPhoto(id: string, filename: string): Promise<User> {
    const user = await this.findById(id, "Code-2");
    user.photos = [...(user.photos ?? []), filename];
    return this.usersRepo.save(user);
  }

  async discover(query: DiscoverQueryDto): Promise<PaginatedUsers> {
    const { gender, ageMin, ageMax, page = 1, limit = 20 } = query;
    const sanitizedPage = Math.max(1, Math.floor(page));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const qb = this.usersRepo
      .createQueryBuilder("user")
      .where("user.isActive = :isActive", { isActive: true });

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
      ])
      .skip((sanitizedPage - 1) * sanitizedLimit)
      .take(sanitizedLimit)
      .getMany();

    const totalPages = Math.ceil(total / sanitizedLimit);

    return {
      data: this.usersToUsersWithDistance(
        data,
        query.currentUserLat,
        query.currentUserLon,
      ),
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages,
    };
  }

  async softDelete(id: string): Promise<void> {
    const user = await this.findById(id, "Code-2");
    user.isActive = false;
    await this.usersRepo.save(user);

    await this.kafkaProducer.emit(KAFKA_TOPICS.USER_DELETED, { id });
    this.logger.log(`Soft-deleted user keycloakId=${id}`);
  }

  private usersToUsersWithDistance(
    users: User[],
    currentUserLat?: number,
    currentUserLon?: number,
  ): UserWithDistance[] {
    return users.map((user) => {
      if (
        !user.latitude ||
        !user.longitude ||
        !currentUserLat ||
        !currentUserLon
      ) {
        return user;
      }

      const distanceKm = calculateDistance(
        currentUserLat,
        currentUserLon,
        user.latitude,
        user.longitude,
      );

      user.latitude = undefined;
      user.longitude = undefined;

      return {
        ...user,
        distance: Math.round(distanceKm * 10) / 10,
      };
    });
  }
}
