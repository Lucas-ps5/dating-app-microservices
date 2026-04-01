import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto, DiscoverQueryDto } from './dto/user.dto';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { KAFKA_TOPICS } from '@app/common';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async createOrUpdate(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { keycloakId: dto.keycloakId },
    });

    if (existing) {
      return existing;
    }

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
    this.logger.log(`Created profile for keycloakId=${dto.keycloakId}`);
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
      name: saved.name,
    });

    return saved;
  }

  async addPhoto(keycloakId: string, filename: string): Promise<User> {
    const user = await this.findByKeycloakId(keycloakId);
    user.photos = [...(user.photos ?? []), filename];
    return this.usersRepo.save(user);
  }

  async discover(query: DiscoverQueryDto): Promise<{ data: User[]; total: number }> {
    const { currentUserId, gender, ageMin, ageMax, page = 1, limit = 20 } = query;

    const qb = this.usersRepo
      .createQueryBuilder('user')
      .where('user.isActive = :isActive', { isActive: true });

    if (currentUserId) {
      qb.andWhere('user.keycloakId != :currentUserId', { currentUserId });
    }
    if (gender) {
      qb.andWhere('user.gender = :gender', { gender });
    }
    if (ageMin) {
      const maxBirthdate = new Date();
      maxBirthdate.setFullYear(maxBirthdate.getFullYear() - ageMin);
      qb.andWhere('user.birthdate <= :maxBirthdate', { maxBirthdate });
    }
    if (ageMax) {
      const minBirthdate = new Date();
      minBirthdate.setFullYear(minBirthdate.getFullYear() - ageMax);
      qb.andWhere('user.birthdate >= :minBirthdate', { minBirthdate });
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
