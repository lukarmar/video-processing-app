import { Test, TestingModule } from "@nestjs/testing";
import { UploadVideoUseCase } from "./upload-video.use-case";
import { TypeOrmVideoRepository } from "../../infrastructure/repositories/typeorm-video.repository";
import { VideoProcessingDomainService } from "../../domain/services/video-processing-domain.service";
import { FileStorageService, VideoProcessingService } from "../ports/services";
import { BadRequestException } from "@nestjs/common";
import { Video, VideoStatus } from "../../domain/entities/video.entity";

describe("UploadVideoUseCase", () => {
  let useCase: UploadVideoUseCase;
  let videoRepository: jest.Mocked<TypeOrmVideoRepository>;
  let videoProcessingDomainService: jest.Mocked<VideoProcessingDomainService>;
  let fileStorageService: jest.Mocked<FileStorageService>;
  let videoProcessingService: jest.Mocked<VideoProcessingService>;

  beforeEach(async () => {
    const mockVideoRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockVideoProcessingDomainService = {
      validateVideoForUpload: jest.fn(),
      createVideoEntity: jest.fn(),
    };

    const mockFileStorageService = {
      saveFile: jest.fn(),
      getFilePath: jest.fn(),
      deleteFile: jest.fn(),
    };

    const mockVideoProcessingService = {
      getVideoMetadata: jest.fn(),
      processVideo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadVideoUseCase,
        { provide: TypeOrmVideoRepository, useValue: mockVideoRepository },
        { provide: VideoProcessingDomainService, useValue: mockVideoProcessingDomainService },
        { provide: "FileStorageService", useValue: mockFileStorageService },
        { provide: "VideoProcessingService", useValue: mockVideoProcessingService },
      ],
    }).compile();

    useCase = module.get<UploadVideoUseCase>(UploadVideoUseCase);
    videoRepository = module.get(TypeOrmVideoRepository);
    videoProcessingDomainService = module.get(VideoProcessingDomainService);
    fileStorageService = module.get("FileStorageService");
    videoProcessingService = module.get("VideoProcessingService");
  });

  describe("execute", () => {
    const mockFile = {
      originalname: "test-video.mp4",
      mimetype: "video/mp4",
      size: 1024 * 1024,
      buffer: Buffer.from("fake video content"),
    };

    const createMockVideo = (overrides: Partial<Video> = {}): Video => {
      const video = new Video();
      Object.assign(video, {
        id: "video-id",
        userId: "user-id",
        filename: "unique-filename.mp4",
        originalName: "test-video.mp4",
        mimeType: "video/mp4",
        size: 1024 * 1024,
        duration: 120,
        status: VideoStatus.PENDING,
        processingAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          width: 1920,
          height: 1080,
          frameRate: 30,
          bitrate: 5000,
          codec: "h264",
        },
        ...overrides,
      });
      return video;
    };

    const mockMetadata = {
      duration: 120,
      width: 1920,
      height: 1080,
      frameRate: 30,
      bitrate: 5000,
      codec: "h264",
      format: "mp4",
    };

    it("should successfully upload a video with metadata", async () => {
      const validation = { isValid: true, error: null };
      const savedFilename = "unique-filename.mp4";
      const filePath = "/uploads/user-id/unique-filename.mp4";
      const mockVideo = createMockVideo();

      videoProcessingDomainService.validateVideoForUpload.mockReturnValue(validation);
      fileStorageService.saveFile.mockResolvedValue(savedFilename);
      fileStorageService.getFilePath.mockReturnValue(filePath);
      videoProcessingService.getVideoMetadata.mockResolvedValue(mockMetadata);
      videoRepository.create.mockResolvedValue(mockVideo);

      const result = await useCase.execute(mockFile, "user-id");

      expect(videoProcessingDomainService.validateVideoForUpload).toHaveBeenCalledWith(
        "test-video.mp4",
        "video/mp4",
        1024 * 1024,
      );
      expect(fileStorageService.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          originalname: "test-video.mp4",
          mimetype: "video/mp4",
          size: 1024 * 1024,
          filename: expect.stringMatching(/\.mp4$/),
        }),
        "user-id",
      );
      expect(fileStorageService.getFilePath).toHaveBeenCalledWith(savedFilename, "user-id");
      expect(videoProcessingService.getVideoMetadata).toHaveBeenCalledWith(filePath);
      expect(videoRepository.create).toHaveBeenCalledWith({
        userId: "user-id",
        filename: savedFilename,
        originalName: "test-video.mp4",
        mimeType: "video/mp4",
        size: 1024 * 1024,
        duration: 120,
        metadata: {
          width: 1920,
          height: 1080,
          frameRate: 30,
          bitrate: 5000,
          codec: "h264",
        },
      });
      expect(result.id).toBe("video-id");
      expect(result.filename).toBe("unique-filename.mp4");
    });

    it("should successfully upload a video without metadata when metadata extraction fails", async () => {
      const validation = { isValid: true, error: null };
      const savedFilename = "unique-filename.mp4";
      const filePath = "/uploads/user-id/unique-filename.mp4";
      const videoWithoutMetadata = createMockVideo({ duration: undefined, metadata: undefined });

      videoProcessingDomainService.validateVideoForUpload.mockReturnValue(validation);
      fileStorageService.saveFile.mockResolvedValue(savedFilename);
      fileStorageService.getFilePath.mockReturnValue(filePath);
      videoProcessingService.getVideoMetadata.mockRejectedValue(new Error("Metadata extraction failed"));
      videoRepository.create.mockResolvedValue(videoWithoutMetadata);

      const result = await useCase.execute(mockFile, "user-id");

      expect(videoRepository.create).toHaveBeenCalledWith({
        userId: "user-id",
        filename: savedFilename,
        originalName: "test-video.mp4",
        mimeType: "video/mp4",
        size: 1024 * 1024,
        duration: undefined,
        metadata: undefined,
      });
      expect(result.id).toBe("video-id");
    });

    it("should throw BadRequestException when video validation fails", async () => {
      const validation = { isValid: false, error: "Invalid video format" };

      videoProcessingDomainService.validateVideoForUpload.mockReturnValue(validation);

      await expect(useCase.execute(mockFile, "user-id")).rejects.toThrow(
        new BadRequestException("Invalid video format"),
      );
      expect(fileStorageService.saveFile).not.toHaveBeenCalled();
      expect(videoRepository.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when file storage fails", async () => {
      const validation = { isValid: true, error: null };
      const storageError = new Error("Storage failed");

      videoProcessingDomainService.validateVideoForUpload.mockReturnValue(validation);
      fileStorageService.saveFile.mockRejectedValue(storageError);

      await expect(useCase.execute(mockFile, "user-id")).rejects.toThrow(
        new BadRequestException("Failed to upload video: Storage failed"),
      );
      expect(videoRepository.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when video repository fails", async () => {
      const validation = { isValid: true, error: null };
      const savedFilename = "unique-filename.mp4";
      const filePath = "/uploads/user-id/unique-filename.mp4";
      const repositoryError = new Error("Database error");

      videoProcessingDomainService.validateVideoForUpload.mockReturnValue(validation);
      fileStorageService.saveFile.mockResolvedValue(savedFilename);
      fileStorageService.getFilePath.mockReturnValue(filePath);
      videoProcessingService.getVideoMetadata.mockResolvedValue(mockMetadata);
      videoRepository.create.mockRejectedValue(repositoryError);

      await expect(useCase.execute(mockFile, "user-id")).rejects.toThrow(
        new BadRequestException("Failed to upload video: Database error"),
      );
    });

    it("should preserve BadRequestException when thrown during validation", async () => {
      const validation = { isValid: false, error: "File too large" };

      videoProcessingDomainService.validateVideoForUpload.mockReturnValue(validation);

      await expect(useCase.execute(mockFile, "user-id")).rejects.toThrow(
        new BadRequestException("File too large"),
      );
    });
  });
});
