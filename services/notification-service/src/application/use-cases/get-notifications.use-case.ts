import { Injectable } from '@nestjs/common';
import { TypeOrmNotificationRepository } from '../../infrastructure/repositories/typeorm-notification.repository';
import { Notification, NotificationStatus } from '../../domain/entities/notification.entity';

export interface GetNotificationsRequest {
  userId: string;
  limit?: number;
  offset?: number;
  status?: NotificationStatus;
}

export interface GetNotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable()
export class GetNotificationsUseCase {
  constructor(
    private readonly notificationRepository: TypeOrmNotificationRepository,
  ) {}

  async execute(request: GetNotificationsRequest): Promise<GetNotificationsResponse> {
    const { userId, limit = 10, offset = 0, status } = request;
    const page = limit > 0 ? Math.floor(offset / limit) + 1 : 1;

    const [notifications, total] = await Promise.all([
      this.notificationRepository.findByUserId(userId, { limit, offset, status }),
      this.notificationRepository.count({ userId, status }),
    ]);

    const hasMore = offset + limit < total;

    return {
      notifications,
      total,
      page,
      limit,
      hasMore,
    };
  }
}
