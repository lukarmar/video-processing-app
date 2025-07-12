import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from './s3.service';
import * as archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VideoStorageService {
  private readonly logger = new Logger(VideoStorageService.name);

  constructor(private readonly s3Service: S3Service) {}

  async uploadProcessedVideo(
    framesDirectory: string,
    videoId: string,
    userId: string,
  ): Promise<string> {
    try {
      this.logger.log(`Starting upload of processed video: ${videoId}`);
      
      const tempZipPath = `/tmp/${videoId}_frames.zip`;
      const s3Key = `processed-videos/${userId}/${videoId}_frames.zip`;
      
      await this.createZipFile(framesDirectory, tempZipPath);
      await this.s3Service.uploadFile(
        tempZipPath,
        s3Key,
        'application/zip',
      );
      
      if (fs.existsSync(tempZipPath)) {
        fs.unlinkSync(tempZipPath);
      }
      
      this.logger.log(`Successfully uploaded processed video to S3: ${s3Key}`);
      return s3Key;
    } catch (error) {
      this.logger.error(`Failed to upload processed video: ${error.message}`);
      throw error;
    }
  }

  async generateDownloadUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    return this.s3Service.generatePresignedUrl(s3Key, expiresIn);
  }

  async deleteProcessedVideo(s3Key: string): Promise<void> {
    return this.s3Service.deleteFile(s3Key);
  }

  async videoExists(s3Key: string): Promise<boolean> {
    return this.s3Service.fileExists(s3Key);
  }

  private async createZipFile(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 },
      });

      output.on('close', () => {
        this.logger.log(`ZIP file created: ${outputPath} (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', (err) => {
        this.logger.error(`Error creating ZIP file: ${err.message}`);
        reject(err);
      });

      archive.pipe(output);

      if (fs.existsSync(sourceDir)) {
        const files = fs.readdirSync(sourceDir);
        for (const file of files) {
          const filePath = path.join(sourceDir, file);
          if (fs.statSync(filePath).isFile()) {
            archive.file(filePath, { name: file });
          }
        }
      }

      archive.finalize();
    });
  }
}
