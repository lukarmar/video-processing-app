import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { UserRepository } from "../../domain/repositories/user.repository";
import { TokenService, CacheService } from "../ports/password.service";
import { RefreshTokenDto } from "../dtos/refresh-token.dto";
import { AuthResponseDto } from "../dtos/user-response.dto";
import {
  USER_REPOSITORY,
  TOKEN_SERVICE,
  CACHE_SERVICE,
} from "../../infrastructure/di/tokens";

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(CACHE_SERVICE) private readonly cacheService: CacheService,
  ) {}

  async execute(refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    try {
      const decoded = this.tokenService.verifyToken(
        refreshTokenDto.refreshToken,
      );
      if (!decoded) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const cachedToken = await this.cacheService.get(
        `refresh_token:${decoded.sub}`,
      );
      if (!cachedToken || cachedToken !== refreshTokenDto.refreshToken) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const user = await this.userRepository.findById(decoded.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException("User not found or inactive");
      }

      const payload = { sub: user.id, email: user.email, name: user.name };
      const accessToken = this.tokenService.generateAccessToken(payload);
      const newRefreshToken = this.tokenService.generateRefreshToken(payload);

      await this.cacheService.set(
        `refresh_token:${user.id}`,
        newRefreshToken,
        7 * 24 * 3600,
      );

      return new AuthResponseDto(accessToken, newRefreshToken, user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(error.message || "Token refresh failed");
    }
  }
}
