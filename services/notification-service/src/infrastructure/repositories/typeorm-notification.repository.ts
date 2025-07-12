import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationStatus, NotificationType } from '../../domain/entities/notification.entity';

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  status?: NotificationStatus;
}

@Injectable()
export class TypeOrmNotificationRepository {
  constructor(
    @InjectRepository(Notification)
    private readonly repository: Repository<Notification>,
  ) {}

  async create(data: CreateNotificationData): Promise<Notification> {
    const notification = this.repository.create(data);
    return await this.repository.save(notification);
  }

  async findById(id: string): Promise<Notification | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async findByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: NotificationStatus;
    } = {}
  ): Promise<Notification[]> {
    const query = this.repository.createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    if (options.status) {
      query.andWhere('notification.status = :status', { status: options.status });
    }

    if (options.limit) {
      query.limit(options.limit);
    }

    if (options.offset) {
      query.offset(options.offset);
    }

    return await query.getMany();
  }

  async update(id: string, data: Partial<Notification>): Promise<void> {
    await this.repository.update(id, data);
  }

  async count(filters: { userId?: string; status?: NotificationStatus } = {}): Promise<number> {
    const query = this.repository.createQueryBuilder('notification');

    if (filters.userId) {
      query.where('notification.userId = :userId', { userId: filters.userId });
    }

    if (filters.status) {
      query.andWhere('notification.status = :status', { status: filters.status });
    }

    return await query.getCount();
  }

  async findPendingNotifications(limit: number = 100): Promise<Notification[]> {
    return await this.repository.find({
      where: { status: NotificationStatus.PENDING },
      take: limit,
      order: { createdAt: 'ASC' },
    });
  }
}
