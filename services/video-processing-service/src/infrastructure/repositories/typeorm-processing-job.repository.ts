import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import {
  ProcessingJob,
  JobStatus,
} from "../../domain/entities/processing-job.entity";
import { ProcessingJobRepository } from "../../domain/repositories/processing-job.repository";

@Injectable()
export class TypeOrmProcessingJobRepository implements ProcessingJobRepository {
  constructor(
    @InjectRepository(ProcessingJob)
    private readonly jobRepository: Repository<ProcessingJob>,
  ) {}

  async findById(id: string): Promise<ProcessingJob | null> {
    return this.jobRepository.findOne({ where: { id } });
  }

  async findByVideoId(videoId: string): Promise<ProcessingJob[]> {
    return this.jobRepository.find({ where: { videoId } });
  }

  async create(job: Partial<ProcessingJob>): Promise<ProcessingJob> {
    const newJob = this.jobRepository.create(job);
    return this.jobRepository.save(newJob);
  }

  async update(
    id: string,
    job: Partial<ProcessingJob>,
  ): Promise<ProcessingJob | null> {
    await this.jobRepository.update(id, job);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.jobRepository.delete(id);
    return result.affected > 0;
  }

  async findByStatus(
    status: JobStatus,
    limit?: number,
  ): Promise<ProcessingJob[]> {
    const query = this.jobRepository
      .createQueryBuilder("job")
      .where("job.status = :status", { status });

    if (limit) {
      query.take(limit);
    }

    return query.getMany();
  }

  async findPendingJobs(limit?: number): Promise<ProcessingJob[]> {
    const query = this.jobRepository
      .createQueryBuilder("job")
      .where("job.status = :status", { status: JobStatus.PENDING })
      .orderBy("job.priority", "DESC")
      .addOrderBy("job.createdAt", "ASC");

    if (limit) {
      query.take(limit);
    }

    return query.getMany();
  }

  async countByStatus(status: JobStatus): Promise<number> {
    return this.jobRepository.count({ where: { status } });
  }

  async findFailedJobs(limit?: number): Promise<ProcessingJob[]> {
    const query = this.jobRepository
      .createQueryBuilder("job")
      .where("job.status = :status", { status: JobStatus.FAILED })
      .orderBy("job.updatedAt", "DESC");

    if (limit) {
      query.take(limit);
    }

    return query.getMany();
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    result?: any,
    errorMessage?: string,
  ): Promise<ProcessingJob | null> {
    const updateData: Partial<ProcessingJob> = { status };

    if (result) {
      updateData.result = result;
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    if (status === JobStatus.PROCESSING) {
      updateData.startedAt = new Date();
    } else if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      updateData.completedAt = new Date();
    }

    await this.jobRepository.update(id, updateData);
    return this.findById(id);
  }

  async findDelayedJobs(before?: Date): Promise<ProcessingJob[]> {
    const beforeDate = before || new Date();
    return this.jobRepository
      .createQueryBuilder("job")
      .where("job.status = :status", { status: JobStatus.DELAYED })
      .andWhere("job.updatedAt < :before", { before: beforeDate })
      .getMany();
  }

  async getJobStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [pending, processing, completed, failed, delayed] = await Promise.all(
      [
        this.countByStatus(JobStatus.PENDING),
        this.countByStatus(JobStatus.PROCESSING),
        this.countByStatus(JobStatus.COMPLETED),
        this.countByStatus(JobStatus.FAILED),
        this.countByStatus(JobStatus.DELAYED),
      ],
    );

    return {
      pending,
      processing,
      completed,
      failed,
      delayed,
    };
  }

  async cleanupOldJobs(olderThan: Date): Promise<number> {
    const result = await this.jobRepository
      .createQueryBuilder()
      .delete()
      .where("status IN (:...statuses)", {
        statuses: [JobStatus.COMPLETED, JobStatus.FAILED],
      })
      .andWhere("updatedAt < :olderThan", { olderThan })
      .execute();

    return result.affected || 0;
  }
}
