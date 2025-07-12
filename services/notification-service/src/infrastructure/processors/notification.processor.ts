import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AWSEmailService } from '../services/aws-email.service';
import { AWSPushNotificationService } from '../services/aws-push-notification.service';
import { TypeOrmNotificationRepository } from '../repositories/typeorm-notification.repository';
import { AuthServiceClient } from '../clients/auth-service.client';
import { NotificationStatus, NotificationType } from '../../domain/entities/notification.entity';

interface EmailJobData {
  userId: string;
  user?: {
    email: string;
    name?: string;
  };
  type: string;
  data: {
    subject: string;
    template: string;
    templateData: Record<string, unknown>;
    videoId: string;
    downloadUrl?: string;
    error?: string;
  };
}

interface PushJobData {
  userId: string;
  user?: {
    email: string;
    name?: string;
  };
  type: string;
  data: {
    title: string;
    message: string;
    icon?: string;
    clickAction?: string;
    data: Record<string, unknown>;
  };
}

@Processor('notifications')
@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly emailService: AWSEmailService,
    private readonly pushNotificationService: AWSPushNotificationService,
    private readonly notificationRepository: TypeOrmNotificationRepository,
    private readonly authServiceClient: AuthServiceClient,
  ) {}

  @Process('send-email')
  async handleEmailNotification(job: Job<EmailJobData>) {
    this.logger.log(`Processing email notification job ${job.id} for user ${job.data.userId}`);
    
    let notificationId: string | null = null;
    
    try {
      const { userId, user: jobUser, data } = job.data;
      
      let user;
      
      if (jobUser && jobUser.email) {
        user = {
          email: jobUser.email,
          name: jobUser.name,
          isActive: true,
          preferences: { emailNotifications: true }, // Assumir que quer receber por padrão
        };
        this.logger.log(`Using user data from job payload for ${userId}`);
      } else {
        user = await this.authServiceClient.getUserById(userId);
        if (!user) {
          this.logger.error(`User not found: ${userId}`);
          throw new Error(`User not found: ${userId}`);
        }
        this.logger.log(`Fetched user data from auth service for ${userId}`);
      }
      
      if (!user.isActive) {
        this.logger.log(`User ${userId} is inactive, skipping notification`);
        return;
      }

      if (user.preferences && !user.preferences.emailNotifications) {
        this.logger.log(`User ${userId} has email notifications disabled`);
        return;
      }

      const notification = await this.notificationRepository.create({
        userId,
        type: NotificationType.EMAIL,
        title: data.subject,
        message: `Email enviado: ${data.subject}`,
        data: data,
        status: NotificationStatus.PENDING,
      });
      notificationId = notification.id;

      await this.emailService.sendEmail({
        to: user.email,
        subject: data.subject,
        template: data.template,
        templateData: data.templateData,
      });

      await this.notificationRepository.update(notificationId, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });

      this.logger.log(`Email notification sent successfully to ${user.email}`);
      
    } catch (error) {
      this.logger.error(`Failed to send email notification:`, error);
      
      if (notificationId) {
        const currentNotification = await this.notificationRepository.findById(notificationId);
        await this.notificationRepository.update(notificationId, {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage: error.message,
          retryCount: (currentNotification?.retryCount || 0) + 1,
        });
      }
      
      throw error;
    }
  }

  @Process('send-push')
  async handlePushNotification(job: Job<PushJobData>) {
    this.logger.log(`Processing push notification job ${job.id} for user ${job.data.userId}`);
    
    let notificationId: string | null = null;
    
    try {
      const { userId, user: jobUser, data } = job.data;
      
      let user;
      
      if (jobUser && jobUser.email) {
        user = {
          email: jobUser.email,
          name: jobUser.name,
          isActive: true,
          preferences: { pushNotifications: true }, // Assumir que quer receber por padrão
        };
        this.logger.log(`Using user data from job payload for ${userId}`);
      } else {
        user = await this.authServiceClient.getUserById(userId);
        if (!user) {
          this.logger.error(`User not found: ${userId}`);
          throw new Error(`User not found: ${userId}`);
        }
        this.logger.log(`Fetched user data from auth service for ${userId}`);
      }
      
      if (!user.isActive) {
        this.logger.log(`User ${userId} is inactive, skipping notification`);
        return;
      }

      if (user.preferences && !user.preferences.pushNotifications) {
        this.logger.log(`User ${userId} has push notifications disabled`);
        return;
      }

      const notification = await this.notificationRepository.create({
        userId,
        type: NotificationType.PUSH,
        title: data.title,
        message: data.message,
        data: data,
        status: NotificationStatus.PENDING,
      });
      notificationId = notification.id;

      await this.pushNotificationService.sendPushNotification({
        userId,
        title: data.title,
        message: data.message,
        icon: data.icon,
        clickAction: data.clickAction,
        data: data.data,
      });

      await this.notificationRepository.update(notificationId, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });

      this.logger.log(`Push notification sent successfully to user ${userId}`);
      
    } catch (error) {
      this.logger.error(`Failed to send push notification:`, error);
      
      if (notificationId) {
        const currentNotification = await this.notificationRepository.findById(notificationId);
        await this.notificationRepository.update(notificationId, {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          errorMessage: error.message,
          retryCount: (currentNotification?.retryCount || 0) + 1,
        });
      }
      
      throw error;
    }
  }
}
