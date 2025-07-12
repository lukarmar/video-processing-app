import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/typeorm";
import { Connection } from "typeorm";

const ApiResponseUtil = {
  success: (data: any, message: string, statusCode: number = 200) => ({
    success: true,
    data,
    message,
    statusCode,
  }),
};

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  @ApiOperation({ summary: "Health check" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  async healthCheck() {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "auth-service",
      version: "1.0.0",
      uptime: process.uptime(),
      database: await this.checkDatabase(),
    };

    return ApiResponseUtil.success(health, "Service is healthy");
  }

  private async checkDatabase(): Promise<{ status: string; message?: string }> {
    try {
      await this.connection.query("SELECT 1");
      return { status: "connected" };
    } catch (error) {
      return { status: "disconnected", message: error.message };
    }
  }
}
