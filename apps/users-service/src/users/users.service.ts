import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./user.entity";
import { CreateUserDto, UpdateUserDto, DiscoverQueryDto } from "./dto/user.dto";
import { KafkaProducerService } from "../kafka/kafka-producer.service";
import { KAFKA_TOPICS } from "@app/common";
import KeycloakAdminClient from "keycloak-admin"; // 1. Import Keycloak Admin Client

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  private readonly kcAdminClient: KeycloakAdminClient;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {
    // 2. Initialize Keycloak Admin Client
    // Ideally, move these URLs to a .env file or ConfigService
    this.kcAdminClient = new KeycloakAdminClient({
      baseUrl: process.env.KEYCLOAK_URL || "http://localhost:8080",
      realmName: process.env.KEYCLOAK_REALM || "master",
    });
  }

  // 3. Authenticate with Keycloak when the service starts
  async onModuleInit() {
    try {
      await this.kcAdminClient.auth({
        username: process.env.KEYCLOAK_ADMIN_USERNAME || "admin",
        password: process.env.KEYCLOAK_ADMIN_PASSWORD || "admin",
        grantType: "client_credentials",
        clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || "admin-cli",
      });
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
  async register(dto: CreateUserDto): Promise<User> {
    // 1. Create User in Keycloak
    let keycloakId: string;
    try {
      await this.kcAdminClient.users.create({
        username: dto.username || dto.email,
        email: dto.email,
        enabled: true,
        credentials: [
          {
            type: "password",
            value: dto.password,
            temporary: false,
          },
        ],
        emailVerified: false, // Set to true if you want to skip email verification
      });

      // 2. Retrieve the Keycloak ID
      // The create method doesn't return the ID directly, so we search for the user by email
      const users = await this.kcAdminClient.users.find({ email: dto.email });
      const createdUser = users.find((u) => u.email === dto.email);

      if (!createdUser?.id) {
        throw new Error("Failed to retrieve Keycloak User ID after creation");
      }
      keycloakId = createdUser.id;
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

    // 3. Create local DB entry
    const existingLocalUser = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existingLocalUser) {
      throw new ConflictException(`Email ${dto.email} is already in use.`);
    }

    const user = this.usersRepo.create({
      keycloakId: keycloakId,
      email: dto.email,
      username: dto.username,
    });

    try {
      const savedUser = await this.usersRepo.save(user);
      this.logger.log(
        `Registered new user: keycloakId=${keycloakId}, email=${dto.email}`,
      );
      return savedUser;
    } catch (error) {
      // 4. Rollback: If DB save fails, delete from Keycloak to stay consistent
      this.logger.error(
        `DB save failed. Rolling back Keycloak user ${keycloakId}`,
      );
      try {
        await this.kcAdminClient.users.del({ id: keycloakId });
      } catch (rollbackError) {
        this.logger.error(
          "Rollback failed. Keycloak user is orphaned.",
          rollbackError,
        );
      }
      throw error;
    }
  }

  async createOrUpdate(dto: CreateUserDto): Promise<User> {
    const emailTaken = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (emailTaken) {
      throw new ConflictException(
        `Email ${dto.email} is already in use by another profile`,
      );
    }

    const user = this.usersRepo.create(dto);
    const saved = await this.usersRepo.save(user);
    this.logger.log(`Created profile for username=${dto.username}`);
    return saved;
  }

  async findByKeycloakId(keycloakId: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { keycloakId } });
    if (!user) {
      throw new NotFoundException(
        `No profile found for keycloakId=${keycloakId}`,
      );
    }
    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async updateByKeycloakId(
    keycloakId: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.findByKeycloakId(keycloakId);
    Object.assign(user, dto);
    const saved = await this.usersRepo.save(user);

    await this.kafkaProducer.emit(KAFKA_TOPICS.USER_UPDATED, {
      keycloakId,
      email: saved.email,
      name: saved.username,
    });

    return saved;
  }

  async addPhoto(keycloakId: string, filename: string): Promise<User> {
    const user = await this.findByKeycloakId(keycloakId);
    user.photos = [...(user.photos ?? []), filename];
    return this.usersRepo.save(user);
  }

  async discover(
    query: DiscoverQueryDto,
  ): Promise<{ data: User[]; total: number }> {
    const { gender, ageMin, ageMax, page = 1, limit = 20 } = query;

    const qb = this.usersRepo
      .createQueryBuilder("user")
      .where("user.isActive = :isActive", { isActive: true });

    if (gender) {
      qb.andWhere("user.gender = :gender", { gender });
    }
    if (ageMin) {
      const maxBirthdate = new Date();
      maxBirthdate.setFullYear(maxBirthdate.getFullYear() - ageMin);
      qb.andWhere("user.birthdate <= :maxBirthdate", { maxBirthdate });
    }
    if (ageMax) {
      const minBirthdate = new Date();
      minBirthdate.setFullYear(minBirthdate.getFullYear() - ageMax);
      qb.andWhere("user.birthdate >= :minBirthdate", { minBirthdate });
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }

  async softDelete(keycloakId: string): Promise<void> {
    const user = await this.findByKeycloakId(keycloakId);
    user.isActive = false;
    await this.usersRepo.save(user);

    await this.kafkaProducer.emit(KAFKA_TOPICS.USER_DELETED, { keycloakId });
    this.logger.log(`Soft-deleted user keycloakId=${keycloakId}`);
  }
}
