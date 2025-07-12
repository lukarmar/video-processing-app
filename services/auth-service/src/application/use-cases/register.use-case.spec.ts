import { Test, TestingModule } from "@nestjs/testing";
import { RegisterUseCase } from "./register.use-case";
import { UserRepository } from "../../domain/repositories/user.repository";
import { AuthDomainService } from "../../domain/services/auth-domain.service";
import { PasswordService } from "../ports/password.service";
import { RegisterDto } from "../dtos/register.dto";
import { ConflictException } from "@nestjs/common";
import {
  USER_REPOSITORY,
  PASSWORD_SERVICE,
} from "../../infrastructure/di/tokens";

describe("RegisterUseCase", () => {
  let useCase: RegisterUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let authDomainService: jest.Mocked<AuthDomainService>;
  let passwordService: jest.Mocked<PasswordService>;

  beforeEach(async () => {
    const mockUserRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    const mockAuthDomainService = {
      createUserEntity: jest.fn(),
    };

    const mockPasswordService = {
      hashPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterUseCase,
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
        { provide: AuthDomainService, useValue: mockAuthDomainService },
        { provide: PASSWORD_SERVICE, useValue: mockPasswordService },
      ],
    }).compile();

    useCase = module.get<RegisterUseCase>(RegisterUseCase);
    userRepository = module.get(USER_REPOSITORY);
    authDomainService = module.get(AuthDomainService);
    passwordService = module.get(PASSWORD_SERVICE);
  });

  describe("execute", () => {
    const registerDto: RegisterDto = {
      email: "test@example.com",
      password: "StrongPassword123",
      name: "Test User",
    };

    it("should successfully register a new user", async () => {
      const userData = {
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        isActive: true,
      };

      const hashedPassword = "hashedPassword";
      const createdUser = {
        id: "user-id",
        ...userData,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userRepository.findByEmail.mockResolvedValue(null);
      authDomainService.createUserEntity.mockReturnValue(userData);
      passwordService.hashPassword.mockResolvedValue(hashedPassword);
      userRepository.create.mockResolvedValue(createdUser as any);

      const result = await useCase.execute(registerDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(authDomainService.createUserEntity).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.password,
        registerDto.name,
      );
      expect(passwordService.hashPassword).toHaveBeenCalledWith(
        registerDto.password,
      );
      expect(userRepository.create).toHaveBeenCalledWith({
        ...userData,
        password: hashedPassword,
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          isActive: createdUser.isActive,
        }),
      );
    });

    it("should throw ConflictException when user already exists", async () => {
      const existingUser = { id: "existing-user-id", email: registerDto.email };
      userRepository.findByEmail.mockResolvedValue(existingUser as any);

      await expect(useCase.execute(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(authDomainService.createUserEntity).not.toHaveBeenCalled();
      expect(passwordService.hashPassword).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it("should handle domain service validation errors", async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      authDomainService.createUserEntity.mockImplementation(() => {
        throw new Error("Invalid email format");
      });

      await expect(useCase.execute(registerDto)).rejects.toThrow(
        "Invalid email format",
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(authDomainService.createUserEntity).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.password,
        registerDto.name,
      );
      expect(passwordService.hashPassword).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });
});
