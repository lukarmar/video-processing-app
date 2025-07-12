import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { VideoRepository } from '../../domain/repositories/video.repository';
import { ProcessingJobRepository } from '../../domain/repositories/processing-job.repository';
import { VideoProcessingService, NotificationService } from '../../application/ports/services';
import { VideoStatus } from '../../domain/entities/video.entity';
import { JobStatus } from '../../domain/entities/processing-job.entity';
import { VideoStorageService } from '../services/video-storage.service';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

interface VideoProcessingJobData {
  jobId: string;
  videoId: string;
  userId: string;
  inputPath: string;
  user?: {
    email: string;
    name?: string;
  };
  processingOptions: {
    framesPerSecond?: number;
    outputFormat?: string;
    compressionQuality?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
}

@Processor('video-processing')
@Injectable()
export class VideoProcessingProcessor {
  private readonly logger = new Logger(VideoProcessingProcessor.name);

  constructor(
    @Inject('VideoRepository')
    private readonly videoRepository: VideoRepository,
    @Inject('ProcessingJobRepository')
    private readonly processingJobRepository: ProcessingJobRepository,
    @Inject('VideoProcessingService')
    private readonly videoProcessingService: VideoProcessingService,
    @Inject('NotificationService')
    private readonly notificationService: NotificationService,
    private readonly videoStorageService: VideoStorageService,
  ) {}

  @Process('video-processing')
  async handleVideoProcessing(job: Job<VideoProcessingJobData>) {
    this.logger.log(`Processing video job ${job.id} for video ${job.data.videoId}`);
    
    try {
      const { videoId, userId, inputPath, processingOptions } = job.data;
      await this.updateVideoStatus(videoId, VideoStatus.PROCESSING);
      await this.updateProcessingJobStatus(job.data.jobId, JobStatus.PROCESSING);
      
      const outputDir = path.join('/app/storage', userId, 'frames', videoId);
      await this.ensureDirectoryExists(outputDir);
      
      this.logger.log(`Extracting frames from ${inputPath} to ${outputDir}`);
      const framesResult = await this.videoProcessingService.extractFrames(
        inputPath,
        outputDir,
        {
          framesPerSecond: processingOptions.framesPerSecond || 1,
          outputFormat: processingOptions.outputFormat || 'png',
        }
      );
      
      this.logger.log(`Extracted ${framesResult.totalFrames} frames`);
      
      const s3Key = await this.videoStorageService.uploadProcessedVideo(
        outputDir,
        videoId,
        userId,
      );
      
      this.logger.log(`Uploaded processed video to S3: ${s3Key}`);
      
      await this.videoRepository.update(videoId, {
        status: VideoStatus.COMPLETED,
        processedAt: new Date(),
        s3Key: s3Key,
      });
      
      await this.processingJobRepository.update(job.data.jobId, {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        result: {
          totalFrames: framesResult.totalFrames,
          processedFrames: framesResult.totalFrames,
          zipPath: s3Key,
        },
      });
      
      try {
        const downloadUrl = await this.videoStorageService.generateDownloadUrl(s3Key);
        await this.notificationService.sendVideoProcessingComplete(
          userId, 
          videoId, 
          downloadUrl, 
          job.data.user
        );
        this.logger.log(`Success notification sent for video ${videoId}`);
      } catch (notificationError) {
        this.logger.error(`Failed to send success notification for video ${videoId}:`, notificationError);
      }
      
      this.logger.log(`Video processing completed for ${videoId}`);
      
    } catch (error) {
      this.logger.error(`Error processing video job ${job.id}:`, error);
      
      await this.updateVideoStatus(job.data.videoId, VideoStatus.FAILED, error.message);
      await this.updateProcessingJobStatus(job.data.jobId, JobStatus.FAILED, error.message);
      
      try {
        await this.notificationService.sendVideoProcessingFailed(
          job.data.userId, 
          job.data.videoId, 
          error.message,
          job.data.user
        );
        this.logger.log(`Failure notification sent for video ${job.data.videoId}`);
      } catch (notificationError) {
        this.logger.error(`Failed to send failure notification for video ${job.data.videoId}:`, notificationError);
      }
      
      throw error;
    }
  }
  
  private async updateVideoStatus(videoId: string, status: VideoStatus, errorMessage?: string) {
    try {
      const updateData: Partial<{ status: VideoStatus; errorMessage: string }> = { status };
      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }
      await this.videoRepository.update(videoId, updateData);
    } catch (error) {
      this.logger.error(`Failed to update video status for ${videoId}:`, error);
    }
  }
  
  private async updateProcessingJobStatus(jobId: string, status: JobStatus, errorMessage?: string) {
    try {
      const updateData: Partial<{
        status: JobStatus;
        startedAt: Date;
        completedAt: Date;
        failedAt: Date;
        errorMessage: string;
      }> = { status };
      if (status === JobStatus.PROCESSING) {
        updateData.startedAt = new Date();
      } else if (status === JobStatus.COMPLETED) {
        updateData.completedAt = new Date();
      } else if (status === JobStatus.FAILED) {
        updateData.failedAt = new Date();
        if (errorMessage) {
          updateData.errorMessage = errorMessage;
        }
      }
      await this.processingJobRepository.update(jobId, updateData);
    } catch (error) {
      this.logger.error(`Failed to update processing job status for ${jobId}:`, error);
    }
  }
  
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await access(dirPath);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }
}
