import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import { TypeOrmVideoRepository } from "../../infrastructure/repositories/typeorm-video.repository";
import { TypeOrmProcessingJobRepository } from "../../infrastructure/repositories/typeorm-processing-job.repository";
import { VideoProcessingDomainService } from "../../domain/services/video-processing-domain.service";
import { QueueService } from "../ports/services";
import { ProcessVideoDto } from "../dtos/upload-video.dto";
import { VideoResponseDto } from "../dtos/video-response.dto";

@Injectable()
export class ProcessVideoUseCase {
  constructor(
    private readonly videoRepository: TypeOrmVideoRepository,
    private readonly jobRepository: TypeOrmProcessingJobRepository,
    private readonly videoProcessingDomainService: VideoProcessingDomainService,
    @Inject("QueueService") private readonly queueService: QueueService,
  ) {}

  async execute(
    processVideoDto: ProcessVideoDto,
    userId: string,
    user?: { email: string; name?: string },
  ): Promise<VideoResponseDto> {
    try {
  
      const video = await this.videoRepository.findById(
        processVideoDto.videoId,
      );

      if (!video) {
        throw new NotFoundException("Video not found");
      }

      if (video.userId !== userId) {
        throw new BadRequestException("Unauthorized to process this video");
      }

      if (!this.videoProcessingDomainService.canVideoBeProcessed(video)) {
        throw new BadRequestException(
          `Video cannot be processed. Status: ${video.status}, Attempts: ${video.processingAttempts}`,
        );
      }

      const inputPath = this.getVideoPath(video.filename, userId);
      const jobData = this.videoProcessingDomainService.createProcessingJob(
        video.id,
        userId,
        inputPath,
        {
          priority: processVideoDto.priority,
          framesPerSecond: processVideoDto.framesPerSecond,
          outputFormat: processVideoDto.outputFormat,
          compressionQuality: processVideoDto.compressionQuality,
        },
      );

      const job = await this.jobRepository.create(jobData);

      const priority =
        this.videoProcessingDomainService.calculateProcessingPriority(video);

      await this.queueService.addJob(
        "video-processing",
        {
          jobId: job.id,
          videoId: video.id,
          userId,
          user,
          inputPath,
          processingOptions: jobData.processingOptions,
        },
        {
          priority,
          attempts: 3,
        },
      );

      video.queueForProcessing();
      const updatedVideo = await this.videoRepository.update(video.id, {
        status: video.status,
      });

      return new VideoResponseDto(updatedVideo || video);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to process video: ${error.message}`,
      );
    }
  }

  private getVideoPath(filename: string, userId: string): string {
    return `/app/uploads/${userId}/${filename}`;
  }
}
