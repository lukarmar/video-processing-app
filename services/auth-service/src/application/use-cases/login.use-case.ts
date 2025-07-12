import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { UserRepository } from "../../domain/repositories/user.repository";
import { AuthDomainService } from "../../domain/services/auth-domain.service";
import {
  PasswordService,
  TokenService,
  CacheService,
} from "../ports/password.service";
import { LoginDto } from "../dtos/login.dto";
import { AuthResponseDto } from "../dtos/user-response.dto";
import {
  USER_REPOSITORY,
  PASSWORD_SERVICE,
  TOKEN_SERVICE,
  CACHE_SERVICE,
} from "../../infrastructure/di/tokens";

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly authDomainService: AuthDomainService,
    @Inject(PASSWORD_SERVICE) private readonly passwordService: PasswordService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(CACHE_SERVICE) private readonly cacheService: CacheService,
  ) {}

  async execute(loginDto: LoginDto): Promise<AuthResponseDto> {
    try {
      const user = await this.userRepository.findByEmail(loginDto.email);
      if (!user) {
        throw new UnauthorizedException("Invalid credentials");
      }

      const isPasswordValid = await this.passwordService.comparePassword(
        loginDto.password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException("Invalid credentials");
      }

      const payload = { sub: user.id, email: user.email, name: user.name };
      const accessToken = this.tokenService.generateAccessToken(payload);
      const refreshToken = this.tokenService.generateRefreshToken(payload);

      await this.cacheService.set(
        `refresh_token:${user.id}`,
        refreshToken,
        7 * 24 * 3600,
      );

      return new AuthResponseDto(accessToken, refreshToken, user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(error.message || "Login failed");
    }
  }
}
