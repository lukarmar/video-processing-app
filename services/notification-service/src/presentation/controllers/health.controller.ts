import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiResponse } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiResponse({ status: 200, description: "Health check endpoint" })
  getHealth() {
    return {
      status: "ok",
      service: "notification-service",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
