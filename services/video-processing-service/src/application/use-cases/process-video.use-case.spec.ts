import { Test, TestingModule } from "@nestjs/testing";
import { ProcessVideoUseCase } from "./process-video.use-case";
import { TypeOrmVideoRepository } from "../../infrastructure/repositories/typeorm-video.repository";
import { TypeOrmProcessingJobRepository } from "../../infrastructure/repositories/typeorm-processing-job.repository";
import { VideoProcessingDomainService } from "../../domain/services/video-processing-domain.service";
import { QueueService } from "../ports/services";
import { ProcessVideoDto } from "../dtos/upload-video.dto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Video, VideoStatus } from "../../domain/entities/video.entity";
import { ProcessingJob, JobStatus } from "../../domain/entities/processing-job.entity";

describe("ProcessVideoUseCase", () => {
  let useCase: ProcessVideoUseCase;
  let videoRepository: jest.Mocked<TypeOrmVideoRepository>;
  let jobRepository: jest.Mocked<TypeOrmProcessingJobRepository>;
  let videoProcessingDomainService: jest.Mocked<VideoProcessingDomainService>;
  let queueService: jest.Mocked<QueueService>;

  beforeEach(async () => {
    const mockVideoRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockJobRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByVideoId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockVideoProcessingDomainService = {
      validateVideoForUpload: jest.fn(),
      createVideoEntity: jest.fn(),
      canVideoBeProcessed: jest.fn(),
      createProcessingJob: jest.fn(),
      calculateProcessingPriority: jest.fn(),
    };

    const mockQueueService = {
      addJob: jest.fn(),
      getJob: jest.fn(),
      removeJob: jest.fn(),
      getQueueStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessVideoUseCase,
        { provide: TypeOrmVideoRepository, useValue: mockVideoRepository },
        { provide: TypeOrmProcessingJobRepository, useValue: mockJobRepository },
        { provide: VideoProcessingDomainService, useValue: mockVideoProcessingDomainService },
        { provide: "QueueService", useValue: mockQueueService },
      ],
    }).compile();

    useCase = module.get<ProcessVideoUseCase>(ProcessVideoUseCase);
    videoRepository = module.get(TypeOrmVideoRepository);
    jobRepository = module.get(TypeOrmProcessingJobRepository);
    videoProcessingDomainService = module.get(VideoProcessingDomainService);
    queueService = module.get("QueueService");
  });

  describe("execute", () => {
    const createMockVideo = (overrides: Partial<Video> = {}): Video => {
      const video = new Video();
      Object.assign(video, {
        id: "video-id",
        userId: "user-id",
        filename: "test-video.mp4",
        originalName: "test-video.mp4",
        mimeType: "video/mp4",
        size: 1024 * 1024,
        duration: 120,
        status: VideoStatus.PENDING,
        processingAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      });
      return video;
    };

    const createMockJob = (overrides: Partial<ProcessingJob> = {}): ProcessingJob => {
      const job = new ProcessingJob();
      Object.assign(job, {
        id: "job-id",
        videoId: "video-id",
        userId: "user-id",
        inputPath: "/app/uploads/user-id/test-video.mp4",
        status: JobStatus.PENDING,
        priority: 0,
        attempts: 0,
        maxAttempts: 3,
        processingOptions: {
          priority: 80,
          framesPerSecond: 30,
          outputFormat: "mp4",
          compressionQuality: 90,
        },
        createdAt: new Date(),
        ...overrides,
      });
      return job;
    };

    const processVideoDto: ProcessVideoDto = {
      videoId: "video-id",
      priority: 80,
      framesPerSecond: 30,
      outputFormat: "mp4",
      compressionQuality: 90,
    };

    const user = { email: "test@example.com", name: "Test User" };

    it("should successfully process a video", async () => {
      const mockVideo = createMockVideo();
      const mockJob = createMockJob();
      
      videoRepository.findById.mockResolvedValue(mockVideo);
      videoProcessingDomainService.canVideoBeProcessed.mockReturnValue(true);
      videoProcessingDomainService.createProcessingJob.mockReturnValue({
        videoId: "video-id",
        userId: "user-id",
        status: JobStatus.PENDING,
        processingOptions: processVideoDto,
      });
      jobRepository.create.mockResolvedValue(mockJob);
      videoProcessingDomainService.calculateProcessingPriority.mockReturnValue(10);
      queueService.addJob.mockResolvedValue("job-queue-id");
      videoRepository.update.mockResolvedValue(mockVideo);

      const result = await useCase.execute(processVideoDto, "user-id", user);

      expect(videoRepository.findById).toHaveBeenCalledWith("video-id");
      expect(videoProcessingDomainService.canVideoBeProcessed).toHaveBeenCalledWith(mockVideo);
      expect(videoProcessingDomainService.createProcessingJob).toHaveBeenCalledWith(
        "video-id",
        "user-id",
        "/app/uploads/user-id/test-video.mp4",
        {
          priority: 80,
          framesPerSecond: 30,
          outputFormat: "mp4",
          compressionQuality: 90,
        },
      );
      expect(jobRepository.create).toHaveBeenCalled();
      expect(videoProcessingDomainService.calculateProcessingPriority).toHaveBeenCalledWith(mockVideo);
      expect(queueService.addJob).toHaveBeenCalledWith(
        "video-processing",
        {
          jobId: "job-id",
          videoId: "video-id",
          userId: "user-id",
          user,
          inputPath: "/app/uploads/user-id/test-video.mp4",
          processingOptions: processVideoDto,
        },
        {
          priority: 10,
          attempts: 3,
        },
      );
      expect(videoRepository.update).toHaveBeenCalledWith("video-id", {
        status: VideoStatus.QUEUED,
      });
      expect(result.id).toBe("video-id");
    });

    it("should throw NotFoundException when video is not found", async () => {
      videoRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(processVideoDto, "user-id", user)).rejects.toThrow(
        new NotFoundException("Video not found"),
      );
      expect(videoProcessingDomainService.canVideoBeProcessed).not.toHaveBeenCalled();
      expect(jobRepository.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when user is not authorized", async () => {
      const unauthorizedVideo = createMockVideo({ userId: "other-user-id" });
      videoRepository.findById.mockResolvedValue(unauthorizedVideo);

      await expect(useCase.execute(processVideoDto, "user-id", user)).rejects.toThrow(
        new BadRequestException("Unauthorized to process this video"),
      );
      expect(videoProcessingDomainService.canVideoBeProcessed).not.toHaveBeenCalled();
      expect(jobRepository.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when video cannot be processed", async () => {
      const mockVideo = createMockVideo();
      videoRepository.findById.mockResolvedValue(mockVideo);
      videoProcessingDomainService.canVideoBeProcessed.mockReturnValue(false);

      await expect(useCase.execute(processVideoDto, "user-id", user)).rejects.toThrow(
        new BadRequestException(
          `Video cannot be processed. Status: ${mockVideo.status}, Attempts: ${mockVideo.processingAttempts}`,
        ),
      );
      expect(jobRepository.create).not.toHaveBeenCalled();
      expect(queueService.addJob).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when job creation fails", async () => {
      const jobError = new Error("Job creation failed");
      const mockVideo = createMockVideo();
      
      videoRepository.findById.mockResolvedValue(mockVideo);
      videoProcessingDomainService.canVideoBeProcessed.mockReturnValue(true);
      videoProcessingDomainService.createProcessingJob.mockReturnValue({
        videoId: "video-id",
        userId: "user-id",
        status: JobStatus.PENDING,
        processingOptions: processVideoDto,
      });
      jobRepository.create.mockRejectedValue(jobError);

      await expect(useCase.execute(processVideoDto, "user-id", user)).rejects.toThrow(
        new BadRequestException("Failed to process video: Job creation failed"),
      );
      expect(queueService.addJob).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when queue service fails", async () => {
      const queueError = new Error("Queue service failed");
      const mockVideo = createMockVideo();
      const mockJob = createMockJob();
      
      videoRepository.findById.mockResolvedValue(mockVideo);
      videoProcessingDomainService.canVideoBeProcessed.mockReturnValue(true);
      videoProcessingDomainService.createProcessingJob.mockReturnValue({
        videoId: "video-id",
        userId: "user-id",
        status: JobStatus.PENDING,
        processingOptions: processVideoDto,
      });
      jobRepository.create.mockResolvedValue(mockJob);
      videoProcessingDomainService.calculateProcessingPriority.mockReturnValue(10);
      queueService.addJob.mockRejectedValue(queueError);

      await expect(useCase.execute(processVideoDto, "user-id", user)).rejects.toThrow(
        new BadRequestException("Failed to process video: Queue service failed"),
      );
    });

    it("should execute without user parameter", async () => {
      const mockVideo = createMockVideo();
      const mockJob = createMockJob();
      
      videoRepository.findById.mockResolvedValue(mockVideo);
      videoProcessingDomainService.canVideoBeProcessed.mockReturnValue(true);
      videoProcessingDomainService.createProcessingJob.mockReturnValue({
        videoId: "video-id",
        userId: "user-id",
        status: JobStatus.PENDING,
        processingOptions: processVideoDto,
      });
      jobRepository.create.mockResolvedValue(mockJob);
      videoProcessingDomainService.calculateProcessingPriority.mockReturnValue(10);
      queueService.addJob.mockResolvedValue("job-queue-id");
      videoRepository.update.mockResolvedValue(mockVideo);

      const result = await useCase.execute(processVideoDto, "user-id");

      expect(queueService.addJob).toHaveBeenCalledWith(
        "video-processing",
        expect.objectContaining({
          user: undefined,
        }),
        expect.any(Object),
      );
      expect(result.id).toBe("video-id");
    });

    it("should handle video repository update failure gracefully", async () => {
      const mockVideo = createMockVideo();
      const mockJob = createMockJob();
      
      videoRepository.findById.mockResolvedValue(mockVideo);
      videoProcessingDomainService.canVideoBeProcessed.mockReturnValue(true);
      videoProcessingDomainService.createProcessingJob.mockReturnValue({
        videoId: "video-id",
        userId: "user-id",
        status: JobStatus.PENDING,
        processingOptions: processVideoDto,
      });
      jobRepository.create.mockResolvedValue(mockJob);
      videoProcessingDomainService.calculateProcessingPriority.mockReturnValue(10);
      queueService.addJob.mockResolvedValue("job-queue-id");
      videoRepository.update.mockResolvedValue(null);

      const result = await useCase.execute(processVideoDto, "user-id", user);

      expect(result.id).toBe("video-id");
    });
  });
});
