import { Test, TestingModule } from "@nestjs/testing";
import { GetVideoStatusUseCase } from "./get-video-status.use-case";
import { TypeOrmVideoRepository } from "../../infrastructure/repositories/typeorm-video.repository";
import { VideoStorageService } from "../../infrastructure/services/video-storage.service";
import { Video, VideoStatus } from "../../domain/entities/video.entity";
import { NotFoundException } from "@nestjs/common";

describe("GetVideoStatusUseCase", () => {
  let useCase: GetVideoStatusUseCase;
  let videoRepository: jest.Mocked<TypeOrmVideoRepository>;
  let videoStorageService: jest.Mocked<VideoStorageService>;

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
      status: VideoStatus.COMPLETED,
      s3Key: "user-id/video-id/output.mp4",
      processingAttempts: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    return video;
  };

  beforeEach(async () => {
    const mockVideoRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByStatus: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockVideoStorageService = {
      generateDownloadUrl: jest.fn(),
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetVideoStatusUseCase,
        { provide: TypeOrmVideoRepository, useValue: mockVideoRepository },
        { provide: VideoStorageService, useValue: mockVideoStorageService },
      ],
    }).compile();

    useCase = module.get<GetVideoStatusUseCase>(GetVideoStatusUseCase);
    videoRepository = module.get(TypeOrmVideoRepository);
    videoStorageService = module.get(VideoStorageService);
  });

  describe("getVideoById", () => {

    it("should return video with download URL when video is completed and has s3Key", async () => {
      const downloadUrl = "https://s3.amazonaws.com/bucket/presigned-url";
      const mockVideo = createMockVideo();
      
      videoRepository.findById.mockResolvedValue(mockVideo);
      videoStorageService.generateDownloadUrl.mockResolvedValue(downloadUrl);

      const result = await useCase.getVideoById("video-id", "user-id");

      expect(videoRepository.findById).toHaveBeenCalledWith("video-id");
      expect(videoStorageService.generateDownloadUrl).toHaveBeenCalledWith("user-id/video-id/output.mp4");
      expect(result.id).toBe("video-id");
      expect(result.downloadUrl).toBe(downloadUrl);
    });

    it("should return video without download URL when video is not completed", async () => {
      const processingVideo = createMockVideo({ status: VideoStatus.PROCESSING });
      
      videoRepository.findById.mockResolvedValue(processingVideo);

      const result = await useCase.getVideoById("video-id", "user-id");

      expect(videoRepository.findById).toHaveBeenCalledWith("video-id");
      expect(videoStorageService.generateDownloadUrl).not.toHaveBeenCalled();
      expect(result.id).toBe("video-id");
      expect(result.downloadUrl).toBeUndefined();
    });

    it("should return video without download URL when s3Key is missing", async () => {
      const videoWithoutS3Key = createMockVideo({ s3Key: undefined });
      
      videoRepository.findById.mockResolvedValue(videoWithoutS3Key);

      const result = await useCase.getVideoById("video-id", "user-id");

      expect(videoRepository.findById).toHaveBeenCalledWith("video-id");
      expect(videoStorageService.generateDownloadUrl).not.toHaveBeenCalled();
      expect(result.id).toBe("video-id");
      expect(result.downloadUrl).toBeUndefined();
    });

    it("should handle download URL generation error gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const mockVideo = createMockVideo();
      
      videoRepository.findById.mockResolvedValue(mockVideo);
      videoStorageService.generateDownloadUrl.mockRejectedValue(new Error("S3 error"));

      const result = await useCase.getVideoById("video-id", "user-id");

      expect(videoRepository.findById).toHaveBeenCalledWith("video-id");
      expect(videoStorageService.generateDownloadUrl).toHaveBeenCalledWith("user-id/video-id/output.mp4");
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error generating download URL:", expect.any(Error));
      expect(result.id).toBe("video-id");
      expect(result.downloadUrl).toBeUndefined();
      
      consoleErrorSpy.mockRestore();
    });

    it("should throw NotFoundException when video is not found", async () => {
      videoRepository.findById.mockResolvedValue(null);

      await expect(useCase.getVideoById("video-id", "user-id")).rejects.toThrow(
        new NotFoundException("Video not found"),
      );
      expect(videoStorageService.generateDownloadUrl).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when user is not authorized", async () => {
      const unauthorizedVideo = createMockVideo({ userId: "other-user-id" });
      videoRepository.findById.mockResolvedValue(unauthorizedVideo);

      await expect(useCase.getVideoById("video-id", "user-id")).rejects.toThrow(
        new NotFoundException("Video not found"),
      );
      expect(videoStorageService.generateDownloadUrl).not.toHaveBeenCalled();
    });
  });

  describe("getUserVideos", () => {
    const createMockVideos = (): Video[] => [
      createMockVideo({
        id: "video-1",
        filename: "video1.mp4",
        status: VideoStatus.COMPLETED,
        s3Key: "user-id/video-1/output.mp4",
      }),
      createMockVideo({
        id: "video-2",
        filename: "video2.mp4",
        status: VideoStatus.PROCESSING,
        s3Key: undefined,
      }),
    ];

    it("should return paginated user videos with download URLs", async () => {
      const downloadUrl1 = "https://s3.amazonaws.com/bucket/presigned-url-1";
      const mockVideos = createMockVideos();
      
      videoRepository.findByUserId.mockResolvedValue(mockVideos);
      videoRepository.count.mockResolvedValue(2);
      videoStorageService.generateDownloadUrl.mockResolvedValue(downloadUrl1);

      const result = await useCase.getUserVideos("user-id", { page: 1, limit: 10 });

      expect(videoRepository.findByUserId).toHaveBeenCalledWith("user-id", {
        status: undefined,
        limit: 10,
        offset: 0,
      });
      expect(videoRepository.count).toHaveBeenCalledWith({
        userId: "user-id",
        status: undefined,
      });
      expect(videoStorageService.generateDownloadUrl).toHaveBeenCalledWith("user-id/video-1/output.mp4");
      expect(result.videos).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it("should filter videos by status", async () => {
      const completedVideo = createMockVideo({
        id: "video-1",
        status: VideoStatus.COMPLETED,
        s3Key: "user-id/video-1/output.mp4",
      });
      
      videoRepository.findByUserId.mockResolvedValue([completedVideo]);
      videoRepository.count.mockResolvedValue(1);
      videoStorageService.generateDownloadUrl.mockResolvedValue("download-url");

      const result = await useCase.getUserVideos("user-id", { 
        status: VideoStatus.COMPLETED,
        page: 1,
        limit: 10,
      });

      expect(videoRepository.findByUserId).toHaveBeenCalledWith("user-id", {
        status: VideoStatus.COMPLETED,
        limit: 10,
        offset: 0,
      });
      expect(videoRepository.count).toHaveBeenCalledWith({
        userId: "user-id",
        status: VideoStatus.COMPLETED,
      });
      expect(result.videos).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should use default pagination parameters", async () => {
      videoRepository.findByUserId.mockResolvedValue([]);
      videoRepository.count.mockResolvedValue(0);

      const result = await useCase.getUserVideos("user-id");

      expect(videoRepository.findByUserId).toHaveBeenCalledWith("user-id", {
        status: undefined,
        limit: 10,
        offset: 0,
      });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it("should calculate correct offset for pagination", async () => {
      videoRepository.findByUserId.mockResolvedValue([]);
      videoRepository.count.mockResolvedValue(0);

      await useCase.getUserVideos("user-id", { page: 3, limit: 5 });

      expect(videoRepository.findByUserId).toHaveBeenCalledWith("user-id", {
        status: undefined,
        limit: 5,
        offset: 10,
      });
    });

    it("should handle download URL generation errors for individual videos", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      const mockVideos = createMockVideos();
      
      videoRepository.findByUserId.mockResolvedValue(mockVideos);
      videoRepository.count.mockResolvedValue(2);
      videoStorageService.generateDownloadUrl.mockRejectedValue(new Error("S3 error"));

      const result = await useCase.getUserVideos("user-id");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error generating download URL for video video-1:",
        expect.any(Error),
      );
      expect(result.videos).toHaveLength(2);
      expect(result.videos[0].downloadUrl).toBeUndefined();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe("getVideosByStatus", () => {
    it("should return videos filtered by status", async () => {
      const mockVideos = [
        createMockVideo({
          id: "video-1",
          userId: "user-1",
          filename: "video1.mp4",
          status: VideoStatus.PROCESSING,
        }),
        createMockVideo({
          id: "video-2",
          userId: "user-2",
          filename: "video2.mp4",
          status: VideoStatus.PROCESSING,
        }),
      ];

      videoRepository.findByStatus.mockResolvedValue(mockVideos);

      const result = await useCase.getVideosByStatus(VideoStatus.PROCESSING);

      expect(videoRepository.findByStatus).toHaveBeenCalledWith(VideoStatus.PROCESSING, undefined);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("video-1");
      expect(result[1].id).toBe("video-2");
    });

    it("should return videos with limit", async () => {
      const mockVideo = createMockVideo({
        id: "video-1",
        userId: "user-1",
        filename: "video1.mp4",
        status: VideoStatus.PROCESSING,
      });

      videoRepository.findByStatus.mockResolvedValue([mockVideo]);

      const result = await useCase.getVideosByStatus(VideoStatus.PROCESSING, 1);

      expect(videoRepository.findByStatus).toHaveBeenCalledWith(VideoStatus.PROCESSING, 1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("video-1");
    });

    it("should return empty array when no videos found", async () => {
      videoRepository.findByStatus.mockResolvedValue([]);

      const result = await useCase.getVideosByStatus(VideoStatus.FAILED);

      expect(videoRepository.findByStatus).toHaveBeenCalledWith(VideoStatus.FAILED, undefined);
      expect(result).toHaveLength(0);
    });
  });
});
