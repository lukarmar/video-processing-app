import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueService } from '../../application/ports/services';

@Injectable()
export class BullQueueService implements QueueService {
  constructor(
    @InjectQueue('video-processing')
    private readonly videoProcessingQueue: Queue,
  ) {}

  async addJob(
    jobType: string,
    data: Record<string, unknown>,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
    },
  ): Promise<string> {
    const job = await this.videoProcessingQueue.add(
      jobType,
      data,
      {
        priority: options?.priority || 0,
        delay: options?.delay || 0,
        attempts: options?.attempts || 3,
        removeOnComplete: 10,
        removeOnFail: 10,
      }
    );
    
    return job.id.toString();
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    const job = await this.videoProcessingQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job with id ${jobId} not found`);
    }

    const state = await job.getState();
    
    return {
      status: state,
      progress: job.progress(),
      data: job.data,
      error: job.failedReason,
    };
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.videoProcessingQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}
