import { ApiProperty } from "@nestjs/swagger";
import { JobStatus } from "../../domain/entities/processing-job.entity";

export class ProcessingStatsDto {
  @ApiProperty()
  pending: number;

  @ApiProperty()
  processing: number;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  delayed: number;

  @ApiProperty()
  total: number;

  constructor(stats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    delayed: number;
  }) {
    this.pending = stats.pending;
    this.processing = stats.processing;
    this.completed = stats.completed;
    this.failed = stats.failed;
    this.delayed = stats.delayed;
    this.total =
      stats.pending +
      stats.processing +
      stats.completed +
      stats.failed +
      stats.delayed;
  }
}

export class ProcessingJobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  videoId: string;

  @ApiProperty()
  status: JobStatus;

  @ApiProperty()
  priority: number;

  @ApiProperty()
  attempts: number;

  @ApiProperty()
  maxAttempts: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  startedAt?: Date;

  @ApiProperty()
  completedAt?: Date;

  @ApiProperty()
  errorMessage?: string;

  @ApiProperty()
  result?: any;

  constructor(job: any) {
    this.id = job.id;
    this.videoId = job.videoId;
    this.status = job.status;
    this.priority = job.priority;
    this.attempts = job.attempts;
    this.maxAttempts = job.maxAttempts;
    this.createdAt = job.createdAt;
    this.startedAt = job.startedAt;
    this.completedAt = job.completedAt;
    this.errorMessage = job.errorMessage;
    this.result = job.result;
  }
}
