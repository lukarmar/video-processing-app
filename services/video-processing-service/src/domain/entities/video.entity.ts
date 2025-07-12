import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum VideoStatus {
  PENDING = "pending",
  QUEUED = "queued",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("videos")
export class Video {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({ type: "bigint" })
  size: number;

  @Column({ type: "float", nullable: true })
  duration?: number;

  @Column({
    type: "varchar",
    default: VideoStatus.PENDING,
  })
  status: VideoStatus;

  @Column({ nullable: true })
  processedAt?: Date;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  downloadUrl?: string;

  @Column({ nullable: true })
  s3Key?: string;

  @Column({ type: "int", default: 0 })
  processingAttempts: number;

  @Column({ type: "json", nullable: true })
  metadata?: {
    width?: number;
    height?: number;
    frameRate?: number;
    bitrate?: number;
    codec?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public canBeProcessed(): boolean {
    return (
      this.status === VideoStatus.PENDING || this.status === VideoStatus.FAILED
    );
  }

  public startProcessing(): void {
    this.status = VideoStatus.PROCESSING;
    this.processingAttempts += 1;
    this.errorMessage = undefined;
  }

  public completeProcessing(downloadUrl: string, duration?: number): void {
    this.status = VideoStatus.COMPLETED;
    this.downloadUrl = downloadUrl;
    this.processedAt = new Date();
    if (duration) {
      this.duration = duration;
    }
  }

  public failProcessing(errorMessage: string): void {
    this.status = VideoStatus.FAILED;
    this.errorMessage = errorMessage;
  }

  public queueForProcessing(): void {
    this.status = VideoStatus.QUEUED;
  }

  public hasExceededMaxAttempts(maxAttempts: number = 3): boolean {
    return this.processingAttempts >= maxAttempts;
  }
}
