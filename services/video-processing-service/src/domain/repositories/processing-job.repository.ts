import { ProcessingJob } from "../entities/processing-job.entity";
import { JobStatus } from "../entities/processing-job.entity";

export abstract class ProcessingJobRepository {
  abstract findById(id: string): Promise<ProcessingJob | null>;
  abstract findByVideoId(videoId: string): Promise<ProcessingJob[]>;
  abstract create(job: Partial<ProcessingJob>): Promise<ProcessingJob>;
  abstract update(
    id: string,
    job: Partial<ProcessingJob>,
  ): Promise<ProcessingJob | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract findByStatus(
    status: JobStatus,
    limit?: number,
  ): Promise<ProcessingJob[]>;
  abstract findPendingJobs(limit?: number): Promise<ProcessingJob[]>;
  abstract findDelayedJobs(before?: Date): Promise<ProcessingJob[]>;
  abstract getJobStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
  abstract cleanupOldJobs(olderThan: Date): Promise<number>;
}
