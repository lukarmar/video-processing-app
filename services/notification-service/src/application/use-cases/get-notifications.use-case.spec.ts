import { Test, TestingModule } from '@nestjs/testing';
import { GetNotificationsUseCase, GetNotificationsRequest } from './get-notifications.use-case';
import { TypeOrmNotificationRepository } from '../../infrastructure/repositories/typeorm-notification.repository';
import { NotificationType, NotificationStatus } from '../../domain/entities/notification.entity';

describe('GetNotificationsUseCase', () => {
  let useCase: GetNotificationsUseCase;
  let notificationRepository: jest.Mocked<TypeOrmNotificationRepository>;

  beforeEach(async () => {
    const mockNotificationRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findByUserId: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetNotificationsUseCase,
        { provide: TypeOrmNotificationRepository, useValue: mockNotificationRepository },
      ],
    }).compile();

    useCase = module.get<GetNotificationsUseCase>(GetNotificationsUseCase);
    notificationRepository = module.get(TypeOrmNotificationRepository);
  });

  describe('execute', () => {
    const mockNotifications = [
      {
        id: 'notification-1',
        userId: 'user-id',
        type: NotificationType.EMAIL,
        title: 'Email Notification',
        message: 'Email message',
        data: null,
        status: NotificationStatus.SENT,
        sentAt: new Date('2023-01-01'),
        deliveredAt: null,
        failedAt: null,
        errorMessage: null,
        retryCount: 0,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      },
      {
        id: 'notification-2',
        userId: 'user-id',
        type: NotificationType.PUSH,
        title: 'Push Notification',
        message: 'Push message',
        data: null,
        status: NotificationStatus.DELIVERED,
        sentAt: new Date('2023-01-02'),
        deliveredAt: new Date('2023-01-02'),
        failedAt: null,
        errorMessage: null,
        retryCount: 0,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
      },
    ];

    it('should successfully get notifications with default pagination', async () => {
      const request: GetNotificationsRequest = {
        userId: 'user-id',
      };

      notificationRepository.findByUserId.mockResolvedValue(mockNotifications);
      notificationRepository.count.mockResolvedValue(2);

      const result = await useCase.execute(request);

      expect(notificationRepository.findByUserId).toHaveBeenCalledWith('user-id', {
        limit: 10,
        offset: 0,
        status: undefined,
      });
      expect(notificationRepository.count).toHaveBeenCalledWith({
        userId: 'user-id',
        status: undefined,
      });
      expect(result).toEqual({
        notifications: mockNotifications,
        total: 2,
        page: 1,
        limit: 10,
        hasMore: false,
      });
    });

    it('should successfully get notifications with custom pagination', async () => {
      const request: GetNotificationsRequest = {
        userId: 'user-id',
        limit: 5,
        offset: 10,
      };

      notificationRepository.findByUserId.mockResolvedValue(mockNotifications);
      notificationRepository.count.mockResolvedValue(20);

      const result = await useCase.execute(request);

      expect(notificationRepository.findByUserId).toHaveBeenCalledWith('user-id', {
        limit: 5,
        offset: 10,
        status: undefined,
      });
      expect(notificationRepository.count).toHaveBeenCalledWith({
        userId: 'user-id',
        status: undefined,
      });
      expect(result).toEqual({
        notifications: mockNotifications,
        total: 20,
        page: 3, 
        limit: 5,
        hasMore: true,
      });
    });

    it('should successfully get notifications filtered by status', async () => {
      const request: GetNotificationsRequest = {
        userId: 'user-id',
        status: NotificationStatus.SENT,
      };

      const sentNotifications = [mockNotifications[0]];
      notificationRepository.findByUserId.mockResolvedValue(sentNotifications);
      notificationRepository.count.mockResolvedValue(1);

      const result = await useCase.execute(request);

      expect(notificationRepository.findByUserId).toHaveBeenCalledWith('user-id', {
        limit: 10,
        offset: 0,
        status: NotificationStatus.SENT,
      });
      expect(notificationRepository.count).toHaveBeenCalledWith({
        userId: 'user-id',
        status: NotificationStatus.SENT,
      });
      expect(result).toEqual({
        notifications: sentNotifications,
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      });
    });

    it('should return empty result when no notifications found', async () => {
      const request: GetNotificationsRequest = {
        userId: 'user-with-no-notifications',
      };

      notificationRepository.findByUserId.mockResolvedValue([]);
      notificationRepository.count.mockResolvedValue(0);

      const result = await useCase.execute(request);

      expect(result).toEqual({
        notifications: [],
        total: 0,
        page: 1,
        limit: 10,
        hasMore: false,
      });
    });

    it('should calculate hasMore correctly when on last page', async () => {
      const request: GetNotificationsRequest = {
        userId: 'user-id',
        limit: 10,
        offset: 20,
      };

      notificationRepository.findByUserId.mockResolvedValue(mockNotifications);
      notificationRepository.count.mockResolvedValue(22);

      const result = await useCase.execute(request);

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 22,
        page: 3,
        limit: 10,
        hasMore: false,
      });
    });

    it('should handle edge case with zero limit', async () => {
      const request: GetNotificationsRequest = {
        userId: 'user-id',
        limit: 0,
        offset: 0,
      };

      notificationRepository.findByUserId.mockResolvedValue([]);
      notificationRepository.count.mockResolvedValue(5);

      const result = await useCase.execute(request);

      expect(result.page).toBe(1);
      expect(result.hasMore).toBe(true);
    });
  });
});
