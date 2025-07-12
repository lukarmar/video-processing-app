import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SendNotificationUseCase, SendNotificationRequest } from '../../application/use-cases/send-notification.use-case';
import { GetNotificationsUseCase, GetNotificationsRequest } from '../../application/use-cases/get-notifications.use-case';
import { NotificationType, NotificationStatus } from '../../domain/entities/notification.entity';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly sendNotificationUseCase: SendNotificationUseCase,
    private readonly getNotificationsUseCase: GetNotificationsUseCase,
  ) {}

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async sendNotification(@Body() request: SendNotificationRequest) {
    const result = await this.sendNotificationUseCase.execute(request);
    return {
      success: true,
      data: result,
      message: 'Notification sent successfully',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  async getNotifications(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: NotificationStatus,
  ) {
    const request: GetNotificationsRequest = {
      userId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      status,
    };

    const result = await this.getNotificationsUseCase.execute(request);
    return {
      success: true,
      data: result,
      message: 'Notifications retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiResponse({ status: 200, description: 'Notification found' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getNotificationById(@Param('id') id: string) {
    return {
      success: true,
      data: { id },
      message: 'Notification found',
    };
  }

  @Post('test-video-complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Test video completion notification' })
  async testVideoComplete(@Body() body: { userId: string; videoId: string; downloadUrl: string }) {
    const request: SendNotificationRequest = {
      userId: body.userId,
      type: NotificationType.EMAIL,
      title: 'Vídeo Processado com Sucesso!',
      message: 'Seu vídeo foi processado e está pronto para download.',
      email: {
        subject: '🎉 Seu vídeo foi processado com sucesso!',
        template: 'video-processing-complete',
        templateData: {
          videoId: body.videoId,
          downloadUrl: body.downloadUrl,
          processedAt: new Date().toISOString(),
        },
      },
    };

    const result = await this.sendNotificationUseCase.execute(request);
    return {
      success: true,
      data: result,
      message: 'Test notification sent successfully',
    };
  }

  @Post('test-video-failed')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Test video failure notification' })
  async testVideoFailed(@Body() body: { userId: string; videoId: string; error: string }) {
    const request: SendNotificationRequest = {
      userId: body.userId,
      type: NotificationType.EMAIL,
      title: 'Falha no Processamento do Vídeo',
      message: 'Houve um problema ao processar seu vídeo.',
      email: {
        subject: '❌ Falha no processamento do seu vídeo',
        template: 'video-processing-failed',
        templateData: {
          videoId: body.videoId,
          error: body.error,
          failedAt: new Date().toISOString(),
          supportUrl: 'mailto:support@videoplat.com',
        },
      },
    };

    const result = await this.sendNotificationUseCase.execute(request);
    return {
      success: true,
      data: result,
      message: 'Test failure notification sent successfully',
    };
  }
}
