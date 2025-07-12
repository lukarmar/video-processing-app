import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({ summary: "Health check endpoint" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  async healthCheck(): Promise<{
    success: boolean;
    data: {
      status: string;
      service: string;
      version: string;
      timestamp: string;
      uptime: number;
      memory: NodeJS.MemoryUsage;
      environment: string;
      port: number;
    };
    message: string;
  }> {
    return {
      success: true,
      data: {
        status: "ok",
        service: "video-processing-service",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: this.configService.get("NODE_ENV", "development"),
        port: this.configService.get("PORT", 3003),
      },
      message: "Video Processing Service is healthy",
    };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness check endpoint" })
  @ApiResponse({ status: 200, description: "Service is ready" })
  async readinessCheck(): Promise<{
    success: boolean;
    data: {
      status: string;
      service: string;
      timestamp: string;
    };
    message: string;
  }> {
    return {
      success: true,
      data: {
        status: "ready",
        service: "video-processing-service",
        timestamp: new Date().toISOString(),
      },
      message: "Video Processing Service is ready",
    };
  }

  @Get("live")
  @ApiOperation({ summary: "Liveness check endpoint" })
  @ApiResponse({ status: 200, description: "Service is live" })
  async livenessCheck(): Promise<{
    success: boolean;
    data: {
      status: string;
      service: string;
      timestamp: string;
    };
    message: string;
  }> {
    return {
      success: true,
      data: {
        status: "live",
        service: "video-processing-service",
        timestamp: new Date().toISOString(),
      },
      message: "Video Processing Service is live",
    };
  }
}
