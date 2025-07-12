import { Video } from "../entities/video.entity";
import { VideoStatus } from "../entities/video.entity";

export abstract class VideoRepository {
  abstract findById(id: string): Promise<Video | null>;
  abstract findByUserId(
    userId: string,
    options?: {
      status?: VideoStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<Video[]>;
  abstract create(video: Partial<Video>): Promise<Video>;
  abstract update(id: string, video: Partial<Video>): Promise<Video | null>;
  abstract delete(id: string): Promise<boolean>;
  abstract findByStatus(status: VideoStatus, limit?: number): Promise<Video[]>;
  abstract count(options?: {
    userId?: string;
    status?: VideoStatus;
  }): Promise<number>;
  abstract findPendingForProcessing(limit?: number): Promise<Video[]>;
}
