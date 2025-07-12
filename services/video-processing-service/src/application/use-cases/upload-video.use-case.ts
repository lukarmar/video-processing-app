import { Injectable, BadRequestException, Inject } from "@nestjs/common";
import { TypeOrmVideoRepository } from "../../infrastructure/repositories/typeorm-video.repository";
import { VideoProcessingDomainService } from "../../domain/services/video-processing-domain.service";
import { FileStorageService, VideoProcessingService } from "../ports/services";
import { VideoResponseDto } from "../dtos/video-response.dto";
import { Video } from "../../domain/entities/video.entity";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class UploadVideoUseCase {
  constructor(
    private readonly videoRepository: TypeOrmVideoRepository,
    private readonly videoProcessingDomainService: VideoProcessingDomainService,
    @Inject("FileStorageService")
    private readonly fileStorageService: FileStorageService,
    @Inject("VideoProcessingService")
    private readonly videoProcessingService: VideoProcessingService,
  ) {}

  async execute(file: any, userId: string): Promise<VideoResponseDto> {
    try {
      const validation =
        this.videoProcessingDomainService.validateVideoForUpload(
          file.originalname,
          file.mimetype,
          file.size,
        );

      if (!validation.isValid) {
        throw new BadRequestException(validation.error);
      }

      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;

      const savedFile = {
        ...file,
        filename: uniqueFilename,
      };

      const savedFilename = await this.fileStorageService.saveFile(
        savedFile,
        userId,
      );

      let metadata;
      try {
        metadata = await this.videoProcessingService.getVideoMetadata(
          this.fileStorageService.getFilePath(savedFilename, userId)
        );
      } catch {
        metadata = null;
      }

      const videoData: Partial<Video> = {
        userId,
        filename: savedFilename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        duration: metadata?.duration,
        metadata: metadata
          ? {
              width: metadata.width,
              height: metadata.height,
              frameRate: metadata.frameRate,
              bitrate: metadata.bitrate,
              codec: metadata.codec,
            }
          : undefined,
      };

      const video = await this.videoRepository.create(videoData);

      return new VideoResponseDto(video);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to upload video: ${error.message}`);
    }
  }
}
