import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { User } from "../domain/entities/user.entity";
import { AuthDomainService } from "../domain/services/auth-domain.service";

import { RegisterUseCase } from "../application/use-cases/register.use-case";
import { LoginUseCase } from "../application/use-cases/login.use-case";
import { RefreshTokenUseCase } from "../application/use-cases/refresh-token.use-case";

import { TypeOrmUserRepository } from "../infrastructure/repositories/typeorm-user.repository";
import { BcryptPasswordService } from "../infrastructure/security/bcrypt-password.service";
import { JwtTokenService } from "../infrastructure/security/jwt-token.service";
import { RedisCacheService } from "../infrastructure/cache/redis-cache.service";

import { AuthController } from "./controllers/auth.controller";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

import {
  USER_REPOSITORY,
  PASSWORD_SERVICE,
  TOKEN_SERVICE,
  CACHE_SERVICE,
} from "../infrastructure/di/tokens";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN") || "1h",
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthDomainService,

    RegisterUseCase,
    LoginUseCase,
    RefreshTokenUseCase,

    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },

    {
      provide: PASSWORD_SERVICE,
      useClass: BcryptPasswordService,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenService,
    },
    {
      provide: CACHE_SERVICE,
      useClass: RedisCacheService,
    },

    JwtAuthGuard,
  ],
  exports: [
    USER_REPOSITORY,
    PASSWORD_SERVICE,
    TOKEN_SERVICE,
    CACHE_SERVICE,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
