import { Test, TestingModule } from '@nestjs/testing';
import { SendNotificationUseCase, SendNotificationRequest } from './send-notification.use-case';
import { TypeOrmNotificationRepository } from '../../infrastructure/repositories/typeorm-notification.repository';
import { AuthServiceClient } from '../../infrastructure/clients/auth-service.client';
import { EmailService } from '../../infrastructure/services/email.service';
import { PushNotificationService } from '../../infrastructure/services/push-notification.service';
import { NotificationType, NotificationStatus } from '../../domain/entities/notification.entity';

describe('SendNotificationUseCase', () => {
  let useCase: SendNotificationUseCase;
  let notificationRepository: jest.Mocked<TypeOrmNotificationRepository>;
  let authServiceClient: jest.Mocked<AuthServiceClient>;
  let emailService: jest.Mocked<EmailService>;
  let pushNotificationService: jest.Mocked<PushNotificationService>;

  beforeEach(async () => {
    const mockNotificationRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findByUserId: jest.fn(),
      count: jest.fn(),
    };

    const mockAuthServiceClient = {
      getUserById: jest.fn(),
    };

    const mockEmailService = {
      sendEmail: jest.fn(),
    };

    const mockPushNotificationService = {
      sendPushNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendNotificationUseCase,
        { provide: TypeOrmNotificationRepository, useValue: mockNotificationRepository },
        { provide: AuthServiceClient, useValue: mockAuthServiceClient },
        { provide: EmailService, useValue: mockEmailService },
        { provide: PushNotificationService, useValue: mockPushNotificationService },
      ],
    }).compile();

    useCase = module.get<SendNotificationUseCase>(SendNotificationUseCase);
    notificationRepository = module.get(TypeOrmNotificationRepository);
    authServiceClient = module.get(AuthServiceClient);
    emailService = module.get(EmailService);
    pushNotificationService = module.get(PushNotificationService);
  });

  describe('execute', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      preferences: {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: true,
      },
    };

    const mockNotification = {
      id: 'notification-id',
      userId: 'user-id',
      type: NotificationType.EMAIL,
      title: 'Test Title',
      message: 'Test Message',
      data: null,
      status: NotificationStatus.PENDING,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      errorMessage: null,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully send an email notification', async () => {
      const request: SendNotificationRequest = {
        userId: 'user-id',
        type: NotificationType.EMAIL,
        title: 'Test Title',
        message: 'Test Message',
        email: {
          subject: 'Test Subject',
          template: 'test-template',
          templateData: { name: 'Test User' },
        },
      };

      authServiceClient.getUserById.mockResolvedValue(mockUser);
      notificationRepository.create.mockResolvedValue(mockNotification);
      notificationRepository.update.mockResolvedValue(undefined);
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await useCase.execute(request);

      expect(authServiceClient.getUserById).toHaveBeenCalledWith('user-id');
      expect(notificationRepository.create).toHaveBeenCalledWith({
        userId: 'user-id',
        type: NotificationType.EMAIL,
        title: 'Test Title',
        message: 'Test Message',
        data: undefined,
        status: NotificationStatus.PENDING,
      });
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        template: 'test-template',
        templateData: { name: 'Test User' },
      });
      expect(notificationRepository.update).toHaveBeenCalledWith('notification-id', {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
      });
      expect(result).toEqual({
        id: 'notification-id',
        status: 'sent',
      });
    });

    it('should successfully send a push notification', async () => {
      const request: SendNotificationRequest = {
        userId: 'user-id',
        type: NotificationType.PUSH,
        title: 'Push Title',
        message: 'Push Message',
        data: { action: 'view' },
        push: {
          icon: 'notification-icon',
          clickAction: 'OPEN_APP',
        },
      };

      const pushNotification = { ...mockNotification, type: NotificationType.PUSH };
      
      authServiceClient.getUserById.mockResolvedValue(mockUser);
      notificationRepository.create.mockResolvedValue(pushNotification);
      notificationRepository.update.mockResolvedValue(undefined);
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);

      const result = await useCase.execute(request);

      expect(authServiceClient.getUserById).toHaveBeenCalledWith('user-id');
      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith({
        userId: 'user-id',
        title: 'Push Title',
        message: 'Push Message',
        icon: 'notification-icon',
        clickAction: 'OPEN_APP',
        data: { action: 'view' },
      });
      expect(notificationRepository.update).toHaveBeenCalledWith('notification-id', {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
      });
      expect(result).toEqual({
        id: 'notification-id',
        status: 'sent',
      });
    });

    it('should throw error when user does not exist', async () => {
      const request: SendNotificationRequest = {
        userId: 'non-existent-user',
        type: NotificationType.EMAIL,
        title: 'Test Title',
        message: 'Test Message',
        email: { subject: 'Test Subject' },
      };

      authServiceClient.getUserById.mockResolvedValue(null);

      await expect(useCase.execute(request)).rejects.toThrow('User not found: non-existent-user');
      expect(authServiceClient.getUserById).toHaveBeenCalledWith('non-existent-user');
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when email configuration is missing for email notification', async () => {
      const request: SendNotificationRequest = {
        userId: 'user-id',
        type: NotificationType.EMAIL,
        title: 'Test Title',
        message: 'Test Message',
      };

      authServiceClient.getUserById.mockResolvedValue(mockUser);
      notificationRepository.create.mockResolvedValue(mockNotification);

      await expect(useCase.execute(request)).rejects.toThrow('Email configuration required for email notifications');
      expect(notificationRepository.create).toHaveBeenCalled();
    });

    it('should throw error when user has email notifications disabled', async () => {
      const userWithDisabledEmail = {
        ...mockUser,
        preferences: { 
          emailNotifications: false, 
          pushNotifications: true,
          smsNotifications: true,
        },
      };

      const request: SendNotificationRequest = {
        userId: 'user-id',
        type: NotificationType.EMAIL,
        title: 'Test Title',
        message: 'Test Message',
        email: { subject: 'Test Subject' },
      };

      authServiceClient.getUserById.mockResolvedValue(userWithDisabledEmail);
      notificationRepository.create.mockResolvedValue(mockNotification);

      await expect(useCase.execute(request)).rejects.toThrow('User has email notifications disabled');
    });

    it('should throw error when user has push notifications disabled', async () => {
      const userWithDisabledPush = {
        ...mockUser,
        preferences: { 
          emailNotifications: true, 
          pushNotifications: false,
          smsNotifications: true,
        },
      };

      const request: SendNotificationRequest = {
        userId: 'user-id',
        type: NotificationType.PUSH,
        title: 'Push Title',
        message: 'Push Message',
      };

      const pushNotification = { ...mockNotification, type: NotificationType.PUSH };

      authServiceClient.getUserById.mockResolvedValue(userWithDisabledPush);
      notificationRepository.create.mockResolvedValue(pushNotification);

      await expect(useCase.execute(request)).rejects.toThrow('User has push notifications disabled');
    });

    it('should update notification status to failed when sending fails', async () => {
      const request: SendNotificationRequest = {
        userId: 'user-id',
        type: NotificationType.EMAIL,
        title: 'Test Title',
        message: 'Test Message',
        email: { subject: 'Test Subject' },
      };

      const sendError = new Error('Email service error');

      authServiceClient.getUserById.mockResolvedValue(mockUser);
      notificationRepository.create.mockResolvedValue(mockNotification);
      emailService.sendEmail.mockRejectedValue(sendError);
      notificationRepository.update.mockResolvedValue(undefined);

      await expect(useCase.execute(request)).rejects.toThrow('Email service error');
      expect(notificationRepository.update).toHaveBeenCalledWith('notification-id', {
        status: NotificationStatus.FAILED,
        failedAt: expect.any(Date),
        errorMessage: 'Email service error',
      });
    });

    it('should throw error for unsupported notification type', async () => {
      const request: SendNotificationRequest = {
        userId: 'user-id',
        type: 'UNSUPPORTED' as NotificationType,
        title: 'Test Title',
        message: 'Test Message',
      };

      authServiceClient.getUserById.mockResolvedValue(mockUser);
      notificationRepository.create.mockResolvedValue(mockNotification);

      await expect(useCase.execute(request)).rejects.toThrow('Unsupported notification type: UNSUPPORTED');
    });
  });
});
