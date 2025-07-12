import { Injectable, NotFoundException } from "@nestjs/common";
import { TypeOrmVideoRepository } from "../../infrastructure/repositories/typeorm-video.repository";
import {
  VideoResponseDto,
  VideoListResponseDto,
} from "../dtos/video-response.dto";
import { VideoStatus } from "../../domain/entities/video.entity";
import { VideoStorageService } from "../../infrastructure/services/video-storage.service";

@Injectable()
export class GetVideoStatusUseCase {
  constructor(
    private readonly videoRepository: TypeOrmVideoRepository,
    private readonly videoStorageService: VideoStorageService,
  ) {}

  async getVideoById(
    videoId: string,
    userId: string,
  ): Promise<VideoResponseDto> {
    const video = await this.videoRepository.findById(videoId);

    if (!video) {
      throw new NotFoundException("Video not found");
    }

    if (video.userId !== userId) {
      throw new NotFoundException("Video not found");
    }

    const videoDto = new VideoResponseDto(video);
    
    if (video.s3Key && video.status === VideoStatus.COMPLETED) {
      try {
        videoDto.downloadUrl = await this.videoStorageService.generateDownloadUrl(video.s3Key);
      } catch (error) {
        console.error('Error generating download URL:', error);
      }
    }

    return videoDto;
  }

  async getUserVideos(
    userId: string,
    options: {
      status?: VideoStatus;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<VideoListResponseDto> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const [videos, total] = await Promise.all([
      this.videoRepository.findByUserId(userId, {
        status: options.status,
        limit,
        offset,
      }),
      this.videoRepository.count({
        userId,
        status: options.status,
      }),
    ]);

    const videosWithUrls = await Promise.all(
      videos.map(async (video) => {
        const videoDto = new VideoResponseDto(video);
        
        if (video.s3Key && video.status === VideoStatus.COMPLETED) {
          try {
            videoDto.downloadUrl = await this.videoStorageService.generateDownloadUrl(video.s3Key);
          } catch (error) {
            console.error(`Error generating download URL for video ${video.id}:`, error);
          }
        }
        
        return videoDto;
      })
    );

    return VideoListResponseDto.fromVideoDtos(videosWithUrls, total, page, limit);
  }

  async getVideosByStatus(
    status: VideoStatus,
    limit?: number,
  ): Promise<VideoResponseDto[]> {
    const videos = await this.videoRepository.findByStatus(status, limit);
    return videos.map((video) => new VideoResponseDto(video));
  }
}
