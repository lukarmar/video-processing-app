import {
  Controller,
  Get,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Response,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response as ExpressResponse } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UploadVideoUseCase } from "../../application/use-cases/upload-video.use-case";
import { ProcessVideoUseCase } from "../../application/use-cases/process-video.use-case";
import { GetVideoStatusUseCase } from "../../application/use-cases/get-video-status.use-case";
import { VideoResponseDto } from "../../application/dtos/video-response.dto";
import {
  UploadVideoDto,
  ProcessVideoDto,
} from "../../application/dtos/upload-video.dto";
import { ProcessingStatsDto } from "../../application/dtos/processing-stats.dto";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { VideoStatus } from "../../domain/entities/video.entity";
import { VideoStorageService } from "../../infrastructure/services/video-storage.service";

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
  };
}

interface UserVideosResponse {
  videos: VideoResponseDto[];
  total: number;
  page: number;
  limit: number;
}

@ApiTags("Video Processing")
@ApiBearerAuth()
@Controller("video")
@UseGuards(JwtAuthGuard)
export class VideoProcessingController {
  constructor(
    private readonly uploadVideoUseCase: UploadVideoUseCase,
    private readonly processVideoUseCase: ProcessVideoUseCase,
    private readonly getVideoStatusUseCase: GetVideoStatusUseCase,
    private readonly videoStorageService: VideoStorageService,
  ) {}

  @Post("upload")
  @ApiOperation({ summary: "Upload video for processing" })
  @ApiResponse({
    status: 201,
    description: "Video uploaded successfully",
    type: VideoResponseDto,
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description: "Video file to upload",
    type: UploadVideoDto,
  })
  @UseInterceptors(FileInterceptor("video"))
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    data: VideoResponseDto;
    message: string;
  }> {
    const userId = req.user.sub;
    const result = await this.uploadVideoUseCase.execute(file, userId);
    return {
      success: true,
      data: result,
      message: "Video uploaded successfully",
    };
  }

  @Post(":id/process")
  @ApiOperation({ summary: "Start video processing" })
  @ApiResponse({ status: 200, description: "Video processing started" })
  async processVideo(
    @Param("id") id: string,
    @Body() processDto: ProcessVideoDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    data: VideoResponseDto;
    message: string;
  }> {
    const userId = req.user.sub;
    const user = { email: req.user.email };
    const result = await this.processVideoUseCase.execute(processDto, userId, user);
    return {
      success: true,
      data: result,
      message: "Video processing started",
    };
  }

  @Get(":id/status")
  @ApiOperation({ summary: "Get video processing status" })
  @ApiResponse({
    status: 200,
    description: "Video status retrieved",
    type: VideoResponseDto,
  })
  async getVideoStatus(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    data: VideoResponseDto;
    message: string;
  }> {
    const userId = req.user.sub;
    const result = await this.getVideoStatusUseCase.getVideoById(id, userId);
    return {
      success: true,
      data: result,
      message: "Video status retrieved successfully",
    };
  }

  @Get("user/:userId")
  @ApiOperation({ summary: "Get user videos" })
  @ApiResponse({ status: 200, description: "User videos retrieved" })
  async getUserVideos(
    @Param("userId") userId: string,
    @Query("status") status?: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ): Promise<{
    success: boolean;
    data: UserVideosResponse;
    message: string;
  }> {
    const result = await this.getVideoStatusUseCase.getUserVideos(userId, {
      status: status as VideoStatus,
      limit,
      page: offset ? Math.floor(offset / (limit || 10)) + 1 : 1,
    });
    return {
      success: true,
      data: result,
      message: "User videos retrieved successfully",
    };
  }

  @Get("stats")
  @ApiOperation({ summary: "Get processing statistics" })
  @ApiResponse({
    status: 200,
    description: "Processing stats retrieved",
    type: ProcessingStatsDto,
  })
  async getProcessingStats(): Promise<{
    success: boolean;
    data: ProcessingStatsDto;
    message: string;
  }> {
    const stats: ProcessingStatsDto = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
    };

    return {
      success: true,
      data: stats,
      message: "Processing stats retrieved successfully",
    };
  }

  @Get(":id/download")
  @ApiOperation({ summary: "Get download URL for processed video frames" })
  @ApiResponse({ 
    status: 200, 
    description: "Download URL generated successfully",
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            downloadUrl: { type: 'string' },
            expiresIn: { type: 'number' }
          }
        },
        message: { type: 'string' }
      }
    }
  })
  async getDownloadUrl(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    data: { downloadUrl: string; expiresIn: number };
    message: string;
  }> {
    const userId = req.user.sub;
    const video = await this.getVideoStatusUseCase.getVideoById(id, userId);

    if (!video.s3Key || video.status !== "completed") {
      throw new BadRequestException(
        "Video processing not completed or download not available",
      );
    }

    try {
      const expiresIn = 3600;
      const downloadUrl = await this.videoStorageService.generateDownloadUrl(
        video.s3Key,
        expiresIn,
      );

      return {
        success: true,
        data: {
          downloadUrl,
          expiresIn,
        },
        message: "Download URL generated successfully",
      };
    } catch (error) {
      throw new BadRequestException(`Failed to generate download URL: ${error.message}`);
    }
  }

  @Get(":id/download-redirect")
  @ApiOperation({ summary: "Download processed video frames (redirect to S3)" })
  @ApiResponse({ status: 302, description: "Redirects to download URL" })
  async downloadVideo(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
    @Response() res: ExpressResponse,
  ): Promise<void> {
    const userId = req.user.sub;
    const video = await this.getVideoStatusUseCase.getVideoById(id, userId);

    if (!video.s3Key || video.status !== "completed") {
      throw new BadRequestException(
        "Video processing not completed or download not available",
      );
    }

    try {
      const downloadUrl = await this.videoStorageService.generateDownloadUrl(
        video.s3Key,
        3600,
      );

      res.redirect(downloadUrl);
    } catch (error) {
      throw new BadRequestException(`Download failed: ${error.message}`);
    }
  }
}
