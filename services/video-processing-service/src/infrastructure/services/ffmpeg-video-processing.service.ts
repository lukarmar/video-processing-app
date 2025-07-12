import { Injectable } from "@nestjs/common";
import { VideoProcessingService } from "../../application/ports/services";
import * as ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import * as fs from "fs/promises";

@Injectable()
export class FfmpegVideoProcessingService implements VideoProcessingService {
  async extractFrames(
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
  }> {
    await fs.mkdir(outputDir, { recursive: true });

    const fps = options.framesPerSecond || 1;
    const format = "png";

    return new Promise((resolve, reject) => {
      const frames: string[] = [];
      const duration = 0;

      ffmpeg(inputPath)
        .on("start", (commandLine) => {
          console.log("Spawned Ffmpeg with command: " + commandLine);
        })
        .on("progress", (progress) => {
          console.log("Processing: " + progress.percent + "% done");
        })
        .on("end", async () => {
          try {
            const files = await fs.readdir(outputDir);
            const frameFiles = files.filter(f => f.startsWith('frame_') && f.endsWith('.png'));
            frameFiles.forEach(file => {
              frames.push(path.join(outputDir, file));
            });
            
            resolve({
              frames,
              totalFrames: frames.length,
              duration,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on("error", (err) => {
          reject(err);
        })
        .fps(fps)
        .outputOptions([
          `-vf scale=${options.maxWidth || 1920}:${options.maxHeight || 1080}:force_original_aspect_ratio=decrease`,
        ])
        .output(path.join(outputDir, `frame_%04d.${format}`))
        .run();
    });
  }

  async getVideoMetadata(filePath: string): Promise<{
    width: number;
    height: number;
    duration: number;
    frameRate: number;
    bitrate: number;
    codec: string;
    format: string;
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === "video",
        );
        if (!videoStream) {
          reject(new Error("No video stream found"));
          return;
        }

        resolve({
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          duration: metadata.format.duration || 0,
          frameRate: eval(videoStream.r_frame_rate || "0/1"),
          format: metadata.format.format_name || "unknown",
          bitrate: metadata.format.bit_rate
            ? parseInt(metadata.format.bit_rate.toString())
            : 0,
          codec: videoStream.codec_name || "unknown",
        });
      });
    });
  }

  async compressVideo(
    inputPath: string,
    outputPath: string,
    options: {
      quality?: number;
      bitrate?: string;
      maxWidth?: number;
      maxHeight?: number;
    },
  ): Promise<void> {
    const quality = options.quality || 23;
    const bitrate = options.bitrate || "1000k";
    const maxWidth = options.maxWidth || 1920;
    const maxHeight = options.maxHeight || 1080;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          `-crf ${quality}`,
          `-b:v ${bitrate}`,
          `-vf scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease`,
          "-preset fast",
          "-c:v libx264",
          "-c:a aac",
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });
  }

  async createThumbnail(
    inputPath: string,
    outputPath: string,
    options: {
      width?: number;
      height?: number;
      timestamp?: string;
      quality?: number;
    },
  ): Promise<void> {
    const width = options.width || 320;
    const height = options.height || 240;
    const timestamp = options.timestamp || "00:00:01";
    const quality = options.quality || 5;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(timestamp)
        .outputOptions([
          `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease`,
          `-q:v ${quality}`,
        ])
        .format("png")
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });
  }

  async validateVideo(filePath: string): Promise<{
    isValid: boolean;
    error?: string;
    metadata?: Record<string, unknown>;
  }> {
    try {
      const metadata = await this.getVideoMetadata(filePath);
      return {
        isValid: true,
        metadata,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  }
}
