import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";

import { DatabaseModule } from "./infrastructure/database/database.module";
import { AuthModule } from "./presentation/auth.module";
import { HealthModule } from "./presentation/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
    }),

    CacheModule.register({
      isGlobal: true,
      ttl: 3600,
    }),

    PrometheusModule.register({
      defaultLabels: {
        service: "auth-service",
      },
    }),

    DatabaseModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
