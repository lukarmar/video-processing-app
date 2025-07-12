import { Test, TestingModule } from "@nestjs/testing";
import { LoginUseCase } from "./login.use-case";
import { UserRepository } from "../../domain/repositories/user.repository";
import { AuthDomainService } from "../../domain/services/auth-domain.service";
import { PasswordService, TokenService, CacheService } from "../ports/password.service";
import { LoginDto } from "../dtos/login.dto";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import {
  USER_REPOSITORY,
  PASSWORD_SERVICE,
  TOKEN_SERVICE,
  CACHE_SERVICE,
} from "../../infrastructure/di/tokens";

describe("LoginUseCase", () => {
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;
  let cacheService: jest.Mocked<CacheService>;

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
      comparePassword: jest.fn(),
    };

    const mockTokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyToken: jest.fn(),
    };

    const mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
        { provide: AuthDomainService, useValue: mockAuthDomainService },
        { provide: PASSWORD_SERVICE, useValue: mockPasswordService },
        { provide: TOKEN_SERVICE, useValue: mockTokenService },
        { provide: CACHE_SERVICE, useValue: mockCacheService },
      ],
    }).compile();

    useCase = module.get<LoginUseCase>(LoginUseCase);
    userRepository = module.get(USER_REPOSITORY);
    passwordService = module.get(PASSWORD_SERVICE);
    tokenService = module.get(TOKEN_SERVICE);
    cacheService = module.get(CACHE_SERVICE);
  });

  describe("execute", () => {
    const loginDto: LoginDto = {
      email: "test@example.com",
      password: "StrongPassword123",
    };

    const mockUser = {
      id: "user-id",
      email: "test@example.com",
      name: "Test User",
      password: "hashedPassword",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isValidPassword: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      updateProfile: jest.fn(),
    };

    it("should successfully login a user with valid credentials", async () => {
      const accessToken = "access-token";
      const refreshToken = "refresh-token";
      const payload = { sub: mockUser.id, email: mockUser.email, name: mockUser.name };

      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.comparePassword.mockResolvedValue(true);
      tokenService.generateAccessToken.mockReturnValue(accessToken);
      tokenService.generateRefreshToken.mockReturnValue(refreshToken);
      cacheService.set.mockResolvedValue(undefined);

      const result = await useCase.execute(loginDto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(passwordService.comparePassword).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(payload);
      expect(tokenService.generateRefreshToken).toHaveBeenCalledWith(payload);
      expect(cacheService.set).toHaveBeenCalledWith(
        `refresh_token:${mockUser.id}`,
        refreshToken,
        7 * 24 * 3600,
      );
      expect(result.accessToken).toBe(accessToken);
      expect(result.refreshToken).toBe(refreshToken);
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.email).toBe(mockUser.email);
    });

    it("should throw UnauthorizedException when user does not exist", async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(useCase.execute(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(passwordService.comparePassword).not.toHaveBeenCalled();
      expect(tokenService.generateAccessToken).not.toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when password is invalid", async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.comparePassword.mockResolvedValue(false);

      await expect(useCase.execute(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(passwordService.comparePassword).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(tokenService.generateAccessToken).not.toHaveBeenCalled();
      expect(tokenService.generateRefreshToken).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when an unexpected error occurs", async () => {
      userRepository.findByEmail.mockRejectedValue(new Error("Database error"));

      await expect(useCase.execute(loginDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(loginDto.email);
    });

    it("should preserve UnauthorizedException when thrown", async () => {
      const unauthorizedError = new UnauthorizedException("Invalid credentials");
      userRepository.findByEmail.mockRejectedValue(unauthorizedError);

      await expect(useCase.execute(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userRepository.findByEmail).toHaveBeenCalledWith(loginDto.email);
    });
  });
});
