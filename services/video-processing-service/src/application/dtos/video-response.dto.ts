import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Video, VideoStatus } from "../../domain/entities/video.entity";

export class VideoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiPropertyOptional()
  duration?: number;

  @ApiProperty({ enum: VideoStatus })
  status: VideoStatus;

  @ApiPropertyOptional()
  processedAt?: Date;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  downloadUrl?: string;

  @ApiPropertyOptional()
  s3Key?: string;

  @ApiProperty()
  processingAttempts: number;

  @ApiPropertyOptional()
  metadata?: {
    width?: number;
    height?: number;
    frameRate?: number;
    bitrate?: number;
    codec?: string;
  };

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(video: Video) {
    this.id = video.id;
    this.filename = video.filename;
    this.originalName = video.originalName;
    this.mimeType = video.mimeType;
    this.size = video.size;
    this.duration = video.duration;
    this.status = video.status;
    this.processedAt = video.processedAt;
    this.errorMessage = video.errorMessage;
    this.downloadUrl = video.downloadUrl;
    this.s3Key = video.s3Key;
    this.processingAttempts = video.processingAttempts;
    this.metadata = video.metadata;
    this.createdAt = video.createdAt;
    this.updatedAt = video.updatedAt;
  }
}

export class VideoListResponseDto {
  @ApiProperty({ type: [VideoResponseDto] })
  videos: VideoResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  constructor(videos: Video[], total: number, page: number, limit: number) {
    this.videos = videos.map((video) => new VideoResponseDto(video));
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }

  static fromVideoDtos(videoDtos: VideoResponseDto[], total: number, page: number, limit: number): VideoListResponseDto {
    const response = new VideoListResponseDto([], total, page, limit);
    response.videos = videoDtos;
    return response;
  }
}
