import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { HealthController } from "./presentation/controllers/health.controller";
import { NotificationController } from "./presentation/controllers/notification.controller";
import { Notification } from "./domain/entities/notification.entity";
import { AWSEmailService } from "./infrastructure/services/aws-email.service";
import { AWSPushNotificationService } from "./infrastructure/services/aws-push-notification.service";
import { NotificationProcessor } from "./infrastructure/processors/notification.processor";
import { AuthServiceClient } from "./infrastructure/clients/auth-service.client";
import { TypeOrmNotificationRepository } from "./infrastructure/repositories/typeorm-notification.repository";
import { SendNotificationUseCase } from "./application/use-cases/send-notification.use-case";
import { GetNotificationsUseCase } from "./application/use-cases/get-notifications.use-case";
import { EmailService } from "./infrastructure/services/email.service";
import { PushNotificationService } from "./infrastructure/services/push-notification.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>("REDIS_HOST") || "redis",
          port: parseInt(configService.get<string>("REDIS_PORT") || "6379"),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get<string>("DATABASE_HOST") || "localhost",
        port: parseInt(configService.get<string>("DATABASE_PORT") || "5432"),
        username: configService.get<string>("DATABASE_USERNAME") || "notification_user",
        password: configService.get<string>("DATABASE_PASSWORD") || "notification_password",
        database: configService.get<string>("DATABASE_NAME") || "notification_service",
        entities: [Notification],
        synchronize: configService.get<string>("NODE_ENV") !== "production",
        logging: configService.get<string>("NODE_ENV") === "development",
      }),
    }),
    TypeOrmModule.forFeature([Notification]),
  ],
  controllers: [HealthController, NotificationController],
  providers: [
    AWSEmailService,
    AWSPushNotificationService,
    NotificationProcessor,
    AuthServiceClient,
    TypeOrmNotificationRepository,
    SendNotificationUseCase,
    GetNotificationsUseCase,
    EmailService,
    PushNotificationService
  ],
})
export class AppModule {}
