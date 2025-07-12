import { Injectable } from '@nestjs/common';
import { TypeOrmNotificationRepository } from '../../infrastructure/repositories/typeorm-notification.repository';
import { AuthServiceClient } from '../../infrastructure/clients/auth-service.client';
import { EmailService } from '../../infrastructure/services/email.service';
import { PushNotificationService } from '../../infrastructure/services/push-notification.service';
import { NotificationType, NotificationStatus } from '../../domain/entities/notification.entity';

export interface SendNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  email?: {
    subject: string;
    template?: string;
    templateData?: Record<string, unknown>;
  };
  push?: {
    icon?: string;
    clickAction?: string;
  };
}

@Injectable()
export class SendNotificationUseCase {
  constructor(
    private readonly notificationRepository: TypeOrmNotificationRepository,
    private readonly authServiceClient: AuthServiceClient,
    private readonly emailService: EmailService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async execute(request: SendNotificationRequest): Promise<{ id: string; status: string }> {
    const { userId, type, title, message, data, email, push } = request;

    // Verificar se o usuário existe via Auth Service
    const user = await this.authServiceClient.getUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Criar registro de notificação
    const notification = await this.notificationRepository.create({
      userId,
      type,
      title,
      message,
      data,
      status: NotificationStatus.PENDING,
    });

    try {
      // Enviar notificação baseada no tipo
      switch (type) {
        case NotificationType.EMAIL:
          if (!email) {
            throw new Error('Email configuration required for email notifications');
          }
          
          if (user.preferences?.emailNotifications !== false) {
            await this.emailService.sendEmail({
              to: user.email,
              subject: email.subject,
              template: email.template,
              templateData: email.templateData,
            });
          } else {
            throw new Error('User has email notifications disabled');
          }
          break;

        case NotificationType.PUSH:
          if (user.preferences?.pushNotifications !== false) {
            await this.pushNotificationService.sendPushNotification({
              userId,
              title,
              message,
              icon: push?.icon,
              clickAction: push?.clickAction,
              data: data || {},
            });
          } else {
            throw new Error('User has push notifications disabled');
          }
          break;

        default:
          throw new Error(`Unsupported notification type: ${type}`);
      }

      // Atualizar status como enviado
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });

      return {
        id: notification.id,
        status: 'sent',
      };

    } catch (error) {
      // Atualizar status como falha
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.FAILED,
        failedAt: new Date(),
        errorMessage: error.message,
      });

      throw error;
    }
  }
}
