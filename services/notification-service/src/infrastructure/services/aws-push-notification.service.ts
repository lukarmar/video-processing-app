import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

interface AWSPushNotificationOptions {
  userId: string;
  title: string;
  message: string;
  icon?: string;
  clickAction?: string;
  data?: Record<string, unknown>;
}

interface MockPushResponse {
  MessageId: string;
  success: boolean;
  timestamp: string;
}

@Injectable()
export class AWSPushNotificationService {
  private readonly logger = new Logger(AWSPushNotificationService.name);
  private readonly snsClient: SNSClient | null = null;
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = this.configService.get('NODE_ENV') === 'development';
    
    if (!this.isDevelopment) {
      this.snsClient = new SNSClient({
        region: this.configService.get('AWS_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
        },
        endpoint: this.configService.get('AWS_SNS_ENDPOINT'), // Para LocalStack em staging
      });
    }
  }

  async sendPushNotification(options: AWSPushNotificationOptions): Promise<void> {
    try {
      this.logger.log(`Sending push notification via AWS SNS to user ${options.userId}: ${options.title}`);
      
      if (this.isDevelopment) {
        await this.sendMockPushNotification(options);
      } else {
        await this.sendRealPushNotification(options);
      }
      
      this.logger.log(`Push notification sent successfully to user ${options.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${options.userId}:`, error);
      throw error;
    }
  }

  private async sendMockPushNotification(options: AWSPushNotificationOptions): Promise<MockPushResponse> {
    const payload = {
      targetArn: `arn:aws:sns:us-east-1:123456789012:app/GCM/VideoProcessingApp/user-${options.userId}`,
      message: JSON.stringify({
        GCM: JSON.stringify({
          notification: {
            title: options.title,
            body: options.message,
            icon: options.icon || '/assets/icons/default-notification.png',
            click_action: options.clickAction,
          },
          data: {
            ...options.data,
            userId: options.userId,
            timestamp: new Date().toISOString(),
          },
        }),
      }),
      messageStructure: 'json',
    };

    await new Promise(resolve => setTimeout(resolve, 150));
    
    const mockResponse: MockPushResponse = {
      MessageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      success: true,
      timestamp: new Date().toISOString(),
    };

    this.logger.debug('📱 MOCK Push Notification Sent:', {
      title: options.title,
      message: options.message,
      userId: options.userId,
      payload: JSON.stringify(payload, null, 2),
      response: mockResponse,
    });

    return mockResponse;
  }

  private async sendRealPushNotification(options: AWSPushNotificationOptions): Promise<void> {
    if (!this.snsClient) {
      throw new Error('SNS Client not initialized for production environment');
    }

    const targetArn = await this.getUserPushEndpointArn(options.userId);
    
    if (!targetArn) {
      this.logger.warn(`No push endpoint found for user ${options.userId}`);
      return;
    }

    const message = {
      GCM: JSON.stringify({
        notification: {
          title: options.title,
          body: options.message,
          icon: options.icon || '/assets/icons/default-notification.png',
          click_action: options.clickAction,
        },
        data: {
          ...options.data,
          userId: options.userId,
          timestamp: new Date().toISOString(),
        },
      }),
      APNS: JSON.stringify({
        aps: {
          alert: {
            title: options.title,
            body: options.message,
          },
          sound: 'default',
          badge: 1,
        },
        data: options.data,
      }),
    };

    const command = new PublishCommand({
      TargetArn: targetArn,
      Message: JSON.stringify(message),
      MessageStructure: 'json',
    });

    const response = await this.snsClient.send(command);
    this.logger.log(`SNS Push sent with MessageId: ${response.MessageId}`);
  }

  private async getUserPushEndpointArn(userId: string): Promise<string | null> {
    return `arn:aws:sns:us-east-1:123456789012:app/GCM/VideoProcessingApp/user-${userId}`;
  }

  async createPlatformEndpoint(userId: string, deviceToken: string, platform: 'ios' | 'android'): Promise<string> {
    if (this.isDevelopment) {
      const mockArn = `arn:aws:sns:us-east-1:123456789012:app/${platform.toUpperCase() === 'IOS' ? 'APNS' : 'GCM'}/VideoProcessingApp/user-${userId}`;
      this.logger.debug(`Mock endpoint created for user ${userId}: ${mockArn}`);
      return mockArn;
    }

    const platformApplicationArn = this.configService.get(
      platform === 'ios' ? 'AWS_SNS_IOS_APP_ARN' : 'AWS_SNS_ANDROID_APP_ARN'
    );

    if (!this.snsClient || !platformApplicationArn) {
      throw new BadGatewayException('SNS Client or Platform Application ARN not configured');
    }

    throw new BadGatewayException('Real endpoint creation not implemented yet');
  }
}
