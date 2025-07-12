import { Injectable } from "@nestjs/common";
import { Video, VideoStatus } from "../entities/video.entity";
import { ProcessingJob } from "../entities/processing-job.entity";
import { VideoMetadata } from "../value-objects/video-metadata.vo";
import { ProcessingResult } from "../value-objects/processing-result.vo";

@Injectable()
export class VideoProcessingDomainService {
  public canVideoBeProcessed(video: Video): boolean {
    return video.canBeProcessed() && !video.hasExceededMaxAttempts();
  }

  public shouldRetryProcessing(video: Video, maxAttempts: number = 3): boolean {
    return (
      video.status === VideoStatus.FAILED &&
      video.processingAttempts < maxAttempts
    );
  }

  public validateVideoForUpload(
    filename: string,
    mimeType: string,
    size: number,
    maxSizeBytes: number = 100 * 1024 * 1024,
    allowedTypes: string[] = [
      "video/mp4",
      "video/avi", 
      "video/mov",
      "video/mkv",
      "application/octet-stream",
    ],
  ): { isValid: boolean; error?: string } {
    if (!allowedTypes.includes(mimeType)) {
      return {
        isValid: false,
        error: `Unsupported file type: ${mimeType}. Allowed types: ${allowedTypes.join(", ")}`,
      };
    }

    if (size > maxSizeBytes) {
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${maxSizeBytes / (1024 * 1024)}MB`,
      };
    }

    if (size === 0) {
      return {
        isValid: false,
        error: "File is empty",
      };
    }

    return { isValid: true };
  }

  public createProcessingJob(
    videoId: string,
    userId: string,
    inputPath: string,
    options?: {
      priority?: number;
      framesPerSecond?: number;
      outputFormat?: string;
      compressionQuality?: number;
    },
  ): Partial<ProcessingJob> {
    return {
      videoId,
      userId,
      inputPath,
      priority: options?.priority || 0,
      processingOptions: {
        framesPerSecond: options?.framesPerSecond || 1,
        outputFormat: options?.outputFormat || "png",
        compressionQuality: options?.compressionQuality || 95,
        maxWidth: 1920,
        maxHeight: 1080,
      },
    };
  }

  public calculateProcessingPriority(
    video: Video,
    userTier: "basic" | "premium" | "enterprise" = "basic",
  ): number {
    let priority = 0;

    switch (userTier) {
      case "enterprise":
        priority += 100;
        break;
      case "premium":
        priority += 50;
        break;
      case "basic":
      default:
        priority += 10;
        break;
    }

    if (video.size < 10 * 1024 * 1024) {
      priority += 20;
    } else if (video.size < 50 * 1024 * 1024) {
      priority += 10;
    }

    priority -= video.processingAttempts * 5;

    return Math.max(priority, 1);
  }

  public estimateProcessingTime(
    metadata: VideoMetadata,
    processingOptions: {
      framesPerSecond?: number;
      outputFormat?: string;
      compressionQuality?: number;
    },
  ): number {
    const fps = processingOptions.framesPerSecond || 1;
    const totalFrames = metadata.duration * fps;

    let timePerFrame = 100;

    if (metadata.isFullHD()) {
      timePerFrame *= 2;
    } else if (metadata.is4K()) {
      timePerFrame *= 4;
    }

    const quality = processingOptions.compressionQuality || 95;
    timePerFrame *= quality / 100;

    return totalFrames * timePerFrame;
  }

  public validateProcessingResult(result: ProcessingResult): {
    isValid: boolean;
    error?: string;
  } {
    if (!result.isSuccessful()) {
      return {
        isValid: false,
        error: result.error || "Processing failed",
      };
    }

    if (result.processedFrames === 0) {
      return {
        isValid: false,
        error: "No frames were processed",
      };
    }

    const efficiency = result.getProcessingEfficiency();
    if (efficiency < 50) {
      return {
        isValid: false,
        error: `Processing efficiency too low: ${efficiency.toFixed(1)}%`,
      };
    }

    if (result.outputSize === 0) {
      return {
        isValid: false,
        error: "Output file is empty",
      };
    }

    return { isValid: true };
  }
}
