export interface FileStorageService {
  saveFile(file: Express.Multer.File, userId: string): Promise<string>;
  getFilePath(filename: string, userId: string): string;
  deleteFile(filename: string, userId: string): Promise<void>;
  getFileUrl(filename: string, userId: string): string;
  fileExists(filename: string, userId: string): Promise<boolean>;
}

export interface VideoProcessingService {
  extractFrames(
    inputPath: string,
    outputDir: string,
    options: {
      framesPerSecond?: number;
      outputFormat?: string;
      compressionQuality?: number;
      maxWidth?: number;
      maxHeight?: number;
    },
  ): Promise<{
    frames: string[];
    totalFrames: number;
    duration: number;
  }>;

  getVideoMetadata(filePath: string): Promise<{
    width: number;
    height: number;
    duration: number;
    frameRate: number;
    bitrate: number;
    codec: string;
    format: string;
  }>;
}

export interface CompressionService {
  createZipFromFiles(
    files: string[],
    outputPath: string,
    options?: {
      compressionLevel?: number;
      comment?: string;
    },
  ): Promise<{
    path: string;
    size: number;
  }>;
}

export interface QueueService {
  addJob(
    jobType: string,
    data: any,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
    },
  ): Promise<string>;

  getJobStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    data?: any;
    error?: string;
  }>;

  removeJob(jobId: string): Promise<void>;
}

export interface NotificationService {
  sendVideoProcessingComplete(
    userId: string,
    videoId: string,
    downloadUrl: string,
    user?: { email: string; name?: string },
  ): Promise<void>;

  sendVideoProcessingFailed(
    userId: string,
    videoId: string,
    error: string,
    user?: { email: string; name?: string },
  ): Promise<void>;
}
