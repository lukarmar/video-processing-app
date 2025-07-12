import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  DELAYED = "delayed",
}

@Entity("processing_jobs")
export class ProcessingJob {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  videoId: string;

  @Column()
  userId: string;

  @Column()
  inputPath: string;

  @Column({ nullable: true })
  outputPath?: string;

  @Column({ type: "int", default: 0 })
  priority: number;

  @Column({ type: "int", default: 0 })
  attempts: number;

  @Column({ type: "int", default: 3 })
  maxAttempts: number;

  @Column({
    type: "varchar",
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  failedAt?: Date;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ type: "json", nullable: true })
  processingOptions?: {
    framesPerSecond?: number;
    outputFormat?: string;
    compressionQuality?: number;
    maxWidth?: number;
    maxHeight?: number;
  };

  @Column({ type: "json", nullable: true })
  result?: {
    totalFrames?: number;
    processedFrames?: number;
    outputSize?: number;
    duration?: number;
    zipPath?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  scheduledFor?: Date;

  public canBeProcessed(): boolean {
    return (
      this.status === JobStatus.PENDING ||
      (this.status === JobStatus.FAILED && this.attempts < this.maxAttempts)
    );
  }

  public startProcessing(): void {
    this.status = JobStatus.PROCESSING;
    this.attempts += 1;
    this.startedAt = new Date();
    this.errorMessage = undefined;
  }

  public completeProcessing(result: any): void {
    this.status = JobStatus.COMPLETED;
    this.completedAt = new Date();
    this.result = result;
  }

  public failProcessing(errorMessage: string): void {
    this.status = JobStatus.FAILED;
    this.failedAt = new Date();
    this.errorMessage = errorMessage;
  }

  public delay(delayUntil: Date): void {
    this.status = JobStatus.DELAYED;
    this.scheduledFor = delayUntil;
  }

  public hasExceededMaxAttempts(): boolean {
    return this.attempts >= this.maxAttempts;
  }

  public calculateNextRetryDelay(): number {
    return Math.pow(2, this.attempts) * 1000;
  }
}
