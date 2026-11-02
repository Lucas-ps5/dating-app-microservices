import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export interface PresenceState {
  isOnline: boolean;
  lastOnlineAt?: string;
}

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis: Redis;
  private readonly ttlSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.ttlSeconds = this.configService.get<number>("redis.presenceTtlSeconds") ?? 600;
    this.redis = new Redis({
      host: this.configService.get<string>("redis.host") ?? "localhost",
      port: this.configService.get<number>("redis.port") ?? 6379,
      password: this.configService.get<string>("redis.password") || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

    this.redis.on("error", (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async heartbeat(userId: string): Promise<PresenceState> {
    const timestamp = new Date().toISOString();
    await this.redis.multi()
      .set(this.presenceKey(userId), timestamp, "EX", this.ttlSeconds)
      .set(this.lastOnlineKey(userId), timestamp, "EX", 60 * 60 * 24 * 30)
      .exec();

    return { isOnline: true, lastOnlineAt: timestamp };
  }

  async markOffline(userId: string): Promise<PresenceState> {
    const timestamp = new Date().toISOString();
    await this.redis.multi()
      .del(this.presenceKey(userId))
      .set(this.lastOnlineKey(userId), timestamp, "EX", 60 * 60 * 24 * 30)
      .exec();

    return { isOnline: false, lastOnlineAt: timestamp };
  }

  async getMany(userIds: string[]): Promise<Map<string, PresenceState>> {
    const uniqueIds = [...new Set(userIds)].filter(Boolean);
    const result = new Map<string, PresenceState>();
    if (uniqueIds.length === 0) return result;

    const keys = uniqueIds.flatMap((id) => [
      this.presenceKey(id),
      this.lastOnlineKey(id),
    ]);
    const values = await this.redis.mget(...keys);

    uniqueIds.forEach((id, index) => {
      const lastOnlineAt = values[index * 2 + 1] ?? undefined;
      result.set(id, {
        isOnline: values[index * 2] !== null,
        lastOnlineAt,
      });
    });

    return result;
  }

  async get(userId: string): Promise<PresenceState> {
    return (await this.getMany([userId])).get(userId) ?? {
      isOnline: false,
      lastOnlineAt: undefined,
    };
  }

  private presenceKey(userId: string): string {
    return `presence:${userId}`;
  }

  private lastOnlineKey(userId: string): string {
    return `last-online:${userId}`;
  }
}
