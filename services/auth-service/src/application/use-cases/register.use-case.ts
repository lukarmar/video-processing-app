import {
  Injectable,
  ConflictException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { UserRepository } from "../../domain/repositories/user.repository";
import { AuthDomainService } from "../../domain/services/auth-domain.service";
import { PasswordService } from "../ports/password.service";
import { RegisterDto } from "../dtos/register.dto";
import { UserResponseDto } from "../dtos/user-response.dto";
import {
  USER_REPOSITORY,
  PASSWORD_SERVICE,
} from "../../infrastructure/di/tokens";

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly authDomainService: AuthDomainService,
    @Inject(PASSWORD_SERVICE) private readonly passwordService: PasswordService,
  ) {}

  async execute(registerDto: RegisterDto): Promise<UserResponseDto> {
    try {
      const existingUser = await this.userRepository.findByEmail(
        registerDto.email,
      );
      if (existingUser) {
        throw new ConflictException("User with this email already exists");
      }

      const userData = this.authDomainService.createUserEntity(
        registerDto.email,
        registerDto.password,
        registerDto.name,
      );

      const hashedPassword = await this.passwordService.hashPassword(
        registerDto.password,
      );
      userData.password = hashedPassword;

      const user = await this.userRepository.create(userData);

      return new UserResponseDto(user);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(error.message || "Failed to register user");
    }
  }
}
