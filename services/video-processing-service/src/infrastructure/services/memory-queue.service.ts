import { Injectable, Inject } from "@nestjs/common";
import { QueueService, VideoProcessingService } from "../../application/ports/services";
import { VideoRepository } from "../../domain/repositories/video.repository";
import { ProcessingJobRepository } from "../../domain/repositories/processing-job.repository";
import { VideoStatus } from "../../domain/entities/video.entity";
import { JobStatus } from "../../domain/entities/processing-job.entity";

interface QueueJobData extends Record<string, unknown> {
  videoId: string;
  userId: string;
  inputPath: string;
  processingOptions: Record<string, unknown>;
}

interface QueueJobItem {
  id: string;
  type: string;
  data: QueueJobData;
  options: {
    priority?: number;
    delay?: number;
    attempts?: number;
  };
  createdAt: Date;
  status: string;
  progress: number;
  error?: string;
}

@Injectable()
export class MemoryQueueService implements QueueService {
  private jobs: Map<string, QueueJobItem> = new Map();

  constructor(
    @Inject("VideoProcessingService")
    private readonly videoProcessingService: VideoProcessingService,
    private readonly videoRepository: VideoRepository,
    private readonly processingJobRepository: ProcessingJobRepository,
  ) {}

  async addJob(
    jobType: string,
    data: QueueJobData,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
    },
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: QueueJobItem = {
      id: jobId,
      type: jobType,
      data,
      options: options || {},
      createdAt: new Date(),
      status: "pending",
      progress: 0,
    };

    this.jobs.set(jobId, job); 
    setTimeout(() => this.processJob(jobId), 1000);
    
    return jobId;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      job.status = "processing";
      console.log(`[MemoryQueueService] Processing job ${jobId} of type ${job.type}`);
      
      if (job.type === "video-processing") {
        await this.processVideoJob(job);
      }
    } catch (error) {
      console.error(`[MemoryQueueService] Error processing job ${jobId}:`, error);
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    }
  }

  private async processVideoJob(job: QueueJobItem): Promise<void> {
    const { videoId, inputPath } = job.data;
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }
    
    video.status = VideoStatus.PROCESSING;
    await this.videoRepository.update(videoId, { status: VideoStatus.PROCESSING });
    const processingJobs = await this.processingJobRepository.findByVideoId(videoId);
    const processingJob = processingJobs[0];
    if (processingJob) {
      processingJob.status = JobStatus.PROCESSING;
      processingJob.startedAt = new Date();
      await this.processingJobRepository.update(processingJob.id, {
        status: JobStatus.PROCESSING,
        startedAt: new Date()
      });
    }
    console.log(`[MemoryQueueService] Extracting frames for video ${videoId}`);
    const outputDir = `/tmp/frames_${videoId}`;
    
    await this.simulateFrameExtraction(inputPath, outputDir);
    await this.videoRepository.update(videoId, {
      status: VideoStatus.COMPLETED,
      processedAt: new Date(),
      downloadUrl: `http://localhost:3002/video/${videoId}/download`
    });
    
    if (processingJob) {
      await this.processingJobRepository.update(processingJob.id, {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        result: { totalFrames: 10, processedFrames: 10, zipPath: outputDir }
      });
    }
    
    job.status = "completed";
    job.progress = 100;
    console.log(`[MemoryQueueService] Video processing completed for ${videoId}`);
  }
  
  private async simulateFrameExtraction(inputPath: string, outputDir: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`[MemoryQueueService] Simulated frame extraction from ${inputPath} to ${outputDir}`);
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job with id ${jobId} not found`);
    }

    return {
      status: job.status,
      progress: job.progress,
      data: job.data,
      error: job.error,
    };
  }

  async removeJob(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }
}
