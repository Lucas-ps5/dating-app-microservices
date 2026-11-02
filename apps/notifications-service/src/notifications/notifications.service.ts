import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { Notification, NotificationType } from "./notification.entity";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepo: Repository<Notification>,
  ) {}

  async createProfileVisit(
    recipientId: string,
    actorId: string,
    visitedAt: string,
  ): Promise<Notification> {
    const notification = this.notificationsRepo.create({
      recipientId,
      actorId,
      type: NotificationType.PROFILE_VISITED,
      sourceId: `profile-visit:${recipientId}:${actorId}:${visitedAt}`,
      data: { visitedAt },
      readAt: null,
    });
    return this.notificationsRepo.save(notification);
  }

  async createNewMatch(
    recipientId: string,
    actorId: string,
    matchId: string,
    matchedAt: string,
  ): Promise<Notification> {
    const existing = await this.notificationsRepo.findOne({
      where: {
        recipientId,
        type: NotificationType.NEW_MATCH,
        sourceId: matchId,
      },
    });
    if (existing) return existing;

    const notification = this.notificationsRepo.create({
      recipientId,
      actorId,
      type: NotificationType.NEW_MATCH,
      sourceId: matchId,
      data: { matchId, matchedAt },
      readAt: null,
    });
    return this.notificationsRepo.save(notification);
  }

  async listForUser(userId: string, limit = 50): Promise<Notification[]> {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 50;
    return this.notificationsRepo.find({
      where: { recipientId: userId },
      order: { createdAt: "DESC" },
      take: safeLimit,
    });
  }

  async countUnread(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepo.count({
      where: { recipientId: userId, readAt: IsNull() },
    });
    return { count };
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepo.findOne({
      where: { id, recipientId: userId },
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationsRepo.save(notification);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationsRepo.update(
      { recipientId: userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }

  async deleteNotificationsForUser(userId: string): Promise<number> {
    const result = await this.notificationsRepo.delete({
      recipientId: userId,
    });
    return result.affected ?? 0;
  }
}
