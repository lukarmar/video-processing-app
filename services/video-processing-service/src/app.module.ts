import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { BullModule } from "@nestjs/bull";
import { Video } from "./domain/entities/video.entity";
import { ProcessingJob } from "./domain/entities/processing-job.entity";
import { HealthController } from "./presentation/controllers/health.controller";
import { VideoProcessingController } from "./presentation/controllers/video-processing.controller";
import { JwtAuthGuard } from "./presentation/guards/jwt-auth.guard";

import { UploadVideoUseCase } from "./application/use-cases/upload-video.use-case";
import { ProcessVideoUseCase } from "./application/use-cases/process-video.use-case";
import { GetVideoStatusUseCase } from "./application/use-cases/get-video-status.use-case";

import { TypeOrmVideoRepository } from "./infrastructure/repositories/typeorm-video.repository";
import { TypeOrmProcessingJobRepository } from "./infrastructure/repositories/typeorm-processing-job.repository";

import { VideoProcessingDomainService } from "./domain/services/video-processing-domain.service";
import { LocalFileStorageService } from "./infrastructure/services/local-file-storage.service";
import { FfmpegVideoProcessingService } from "./infrastructure/services/ffmpeg-video-processing.service";
import { BullQueueService } from "./infrastructure/services/bull-queue.service";
import { S3Service } from "./infrastructure/services/s3.service";
import { VideoStorageService } from "./infrastructure/services/video-storage.service";
import { HttpNotificationService } from "./infrastructure/services/notification.service";
import { VideoProcessingProcessor } from "./infrastructure/processors/video-processing.processor";
import { VideoRepository } from "./domain/repositories/video.repository";
import { ProcessingJobRepository } from "./domain/repositories/processing-job.repository";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET") || "default-secret",
      }),
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
      name: 'video-processing',
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>("DATABASE_URL");

        if (dbUrl?.startsWith("sqlite:")) {
          return {
            type: "sqlite",
            database: dbUrl.replace("sqlite:", ""),
            entities: [Video, ProcessingJob],
            synchronize: true,
            logging: configService.get<string>("NODE_ENV") === "development",
          };
        }

        return {
          type: "postgres",
          host: configService.get<string>("DB_HOST") || "localhost",
          port: parseInt(configService.get<string>("DB_PORT") || "5432"),
          username: configService.get<string>("DB_USERNAME") || "postgres",
          password: configService.get<string>("DB_PASSWORD") || "postgres",
          database: configService.get<string>("DB_NAME") || "video_processing",
          entities: [Video, ProcessingJob],
          synchronize: configService.get<string>("NODE_ENV") !== "production",
          logging: configService.get<string>("NODE_ENV") === "development",
        };
      },
    }),
    TypeOrmModule.forFeature([Video, ProcessingJob]),
  ],
  controllers: [HealthController, VideoProcessingController],
  providers: [
    JwtAuthGuard,
    VideoProcessingDomainService,
    LocalFileStorageService,
    FfmpegVideoProcessingService,
    BullQueueService,
    S3Service,
    VideoStorageService,
    HttpNotificationService,
    VideoProcessingProcessor,
    TypeOrmVideoRepository,
    TypeOrmProcessingJobRepository,
    {
      provide: "FileStorageService",
      useClass: LocalFileStorageService,
    },
    {
    provide: "VideoProcessingService",
      useClass: FfmpegVideoProcessingService,
    },
    {
      provide: "QueueService",
      useClass: BullQueueService,
    },
    {
      provide: VideoRepository,
      useClass: TypeOrmVideoRepository,
    },
    {
      provide: ProcessingJobRepository,
      useClass: TypeOrmProcessingJobRepository,
    },
    {
      provide: "NotificationService",
      useClass: HttpNotificationService,
    },
    UploadVideoUseCase,
    ProcessVideoUseCase,
    GetVideoStatusUseCase,
  ],
})
export class AppModule {}
