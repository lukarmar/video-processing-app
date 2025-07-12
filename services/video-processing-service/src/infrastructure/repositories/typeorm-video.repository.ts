import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Video, VideoStatus } from "../../domain/entities/video.entity";
import { VideoRepository } from "../../domain/repositories/video.repository";

@Injectable()
export class TypeOrmVideoRepository implements VideoRepository {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
  ) {}

  async findById(id: string): Promise<Video | null> {
    return this.videoRepository.findOne({ where: { id } });
  }

  async findByUserId(
    userId: string,
    options?: {
      status?: VideoStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<Video[]> {
    const query = this.videoRepository
      .createQueryBuilder("video")
      .where("video.userId = :userId", { userId });

    if (options?.status) {
      query.andWhere("video.status = :status", { status: options.status });
    }

    if (options?.limit) {
      query.take(options.limit);
    }

    if (options?.offset) {
      query.skip(options.offset);
    }

    return query.getMany();
  }

  async create(video: Partial<Video>): Promise<Video> {
    const newVideo = this.videoRepository.create(video);
    return this.videoRepository.save(newVideo);
  }

  async update(id: string, video: Partial<Video>): Promise<Video | null> {
    await this.videoRepository.update(id, video);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.videoRepository.delete(id);
    return result.affected > 0;
  }

  async findByStatus(status: VideoStatus, limit?: number): Promise<Video[]> {
    const query = this.videoRepository
      .createQueryBuilder("video")
      .where("video.status = :status", { status });

    if (limit) {
      query.take(limit);
    }

    return query.getMany();
  }

  async count(options?: {
    userId?: string;
    status?: VideoStatus;
  }): Promise<number> {
    const query = this.videoRepository.createQueryBuilder("video");

    if (options?.userId) {
      query.where("video.userId = :userId", { userId: options.userId });
    }

    if (options?.status) {
      query.andWhere("video.status = :status", { status: options.status });
    }

    return query.getCount();
  }

  async findPendingForProcessing(limit?: number): Promise<Video[]> {
    const query = this.videoRepository
      .createQueryBuilder("video")
      .where("video.status IN (:...statuses)", {
        statuses: [VideoStatus.PENDING, VideoStatus.QUEUED],
      })
      .orderBy("video.createdAt", "ASC");

    if (limit) {
      query.take(limit);
    }

    return query.getMany();
  }
}
