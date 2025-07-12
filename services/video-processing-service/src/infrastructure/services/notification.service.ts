import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationService } from '../../application/ports/services';

@Injectable()
export class HttpNotificationService implements NotificationService {
  private readonly logger = new Logger(HttpNotificationService.name);

  constructor(
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  async sendVideoProcessingComplete(
    userId: string,
    videoId: string,
    downloadUrl: string,
    user?: { email: string; name?: string },
  ): Promise<void> {
    try {
      this.logger.log(`Sending completion notification for video ${videoId} to user ${userId}`);
      
      await this.notificationQueue.add('send-email', {
        userId,
        user,
        type: 'VIDEO_PROCESSING_COMPLETE',
        data: {
          videoId,
          downloadUrl,
          subject: '🎉 Seu vídeo foi processado com sucesso!',
          template: 'video-processing-complete',
          templateData: {
            videoId,
            downloadUrl,
            processedAt: new Date().toISOString(),
          },
        },
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      await this.notificationQueue.add('send-push', {
        userId,
        user,
        type: 'VIDEO_PROCESSING_COMPLETE',
        data: {
          videoId,
          downloadUrl,
          title: 'Vídeo Processado!',
          message: 'Seu vídeo foi processado com sucesso e está pronto para download.',
          icon: 'video-complete',
          clickAction: `/videos/${videoId}`,
          data: {
            videoId,
            downloadUrl,
          },
        },
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(`Notification jobs queued successfully for video ${videoId}`);
    } catch (error) {
      this.logger.error(`Failed to queue notifications for video ${videoId}:`, error);
      throw error;
    }
  }

  async sendVideoProcessingFailed(
    userId: string,
    videoId: string,
    error: string,
    user?: { email: string; name?: string },
  ): Promise<void> {
    try {
      this.logger.log(`Sending failure notification for video ${videoId} to user ${userId}`);
      await this.notificationQueue.add('send-email', {
        userId,
        user,
        type: 'VIDEO_PROCESSING_FAILED',
        data: {
          videoId,
          error,
          subject: '❌ Falha no processamento do seu vídeo',
          template: 'video-processing-failed',
          templateData: {
            videoId,
            error,
            failedAt: new Date().toISOString(),
            supportUrl: 'mailto:support@videoplat.com',
          },
        },
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
      
      await this.notificationQueue.add('send-push', {
        userId,
        user,
        type: 'VIDEO_PROCESSING_FAILED',
        data: {
          videoId,
          error,
          title: 'Falha no Processamento',
          message: 'Houve um problema ao processar seu vídeo. Tente novamente.',
          icon: 'video-error',
          clickAction: `/videos/${videoId}`,
          data: {
            videoId,
            error,
          },
        },
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(`Failure notification jobs queued successfully for video ${videoId}`);
    } catch (error) {
      this.logger.error(`Failed to queue failure notifications for video ${videoId}:`, error);
      throw error;
    }
  }
}
