import { Test, TestingModule } from "@nestjs/testing";
import { RefreshTokenUseCase } from "./refresh-token.use-case";
import { UserRepository } from "../../domain/repositories/user.repository";
import { TokenService, CacheService } from "../ports/password.service";
import { RefreshTokenDto } from "../dtos/refresh-token.dto";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import {
  USER_REPOSITORY,
  TOKEN_SERVICE,
  CACHE_SERVICE,
} from "../../infrastructure/di/tokens";

describe("RefreshTokenUseCase", () => {
  let useCase: RefreshTokenUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let tokenService: jest.Mocked<TokenService>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
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
        RefreshTokenUseCase,
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
        { provide: TOKEN_SERVICE, useValue: mockTokenService },
        { provide: CACHE_SERVICE, useValue: mockCacheService },
      ],
    }).compile();

    useCase = module.get<RefreshTokenUseCase>(RefreshTokenUseCase);
    userRepository = module.get(USER_REPOSITORY);
    tokenService = module.get(TOKEN_SERVICE);
    cacheService = module.get(CACHE_SERVICE);
  });

  describe("execute", () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: "valid-refresh-token",
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

    const decodedToken = {
      sub: "user-id",
      email: "test@example.com",
      name: "Test User",
    };

    it("should successfully refresh tokens with valid refresh token", async () => {
      const newAccessToken = "new-access-token";
      const newRefreshToken = "new-refresh-token";

      tokenService.verifyToken.mockReturnValue(decodedToken);
      cacheService.get.mockResolvedValue(refreshTokenDto.refreshToken);
      userRepository.findById.mockResolvedValue(mockUser);
      tokenService.generateAccessToken.mockReturnValue(newAccessToken);
      tokenService.generateRefreshToken.mockReturnValue(newRefreshToken);
      cacheService.set.mockResolvedValue(undefined);

      const result = await useCase.execute(refreshTokenDto);

      expect(tokenService.verifyToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      expect(cacheService.get).toHaveBeenCalledWith(`refresh_token:${decodedToken.sub}`);
      expect(userRepository.findById).toHaveBeenCalledWith(decodedToken.sub);
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(decodedToken);
      expect(tokenService.generateRefreshToken).toHaveBeenCalledWith(decodedToken);
      expect(cacheService.set).toHaveBeenCalledWith(
        `refresh_token:${mockUser.id}`,
        newRefreshToken,
        7 * 24 * 3600,
      );
      expect(result.accessToken).toBe(newAccessToken);
      expect(result.refreshToken).toBe(newRefreshToken);
      expect(result.user.id).toBe(mockUser.id);
    });

    it("should throw UnauthorizedException when token verification fails", async () => {
      tokenService.verifyToken.mockReturnValue(null);

      await expect(useCase.execute(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.verifyToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      expect(cacheService.get).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when cached token does not match", async () => {
      tokenService.verifyToken.mockReturnValue(decodedToken);
      cacheService.get.mockResolvedValue("different-token");

      await expect(useCase.execute(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.verifyToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      expect(cacheService.get).toHaveBeenCalledWith(`refresh_token:${decodedToken.sub}`);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when cached token is null", async () => {
      tokenService.verifyToken.mockReturnValue(decodedToken);
      cacheService.get.mockResolvedValue(null);

      await expect(useCase.execute(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.verifyToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
      expect(cacheService.get).toHaveBeenCalledWith(`refresh_token:${decodedToken.sub}`);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when user is not found", async () => {
      tokenService.verifyToken.mockReturnValue(decodedToken);
      cacheService.get.mockResolvedValue(refreshTokenDto.refreshToken);
      userRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userRepository.findById).toHaveBeenCalledWith(decodedToken.sub);
    });

    it("should throw UnauthorizedException when user is inactive", async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      tokenService.verifyToken.mockReturnValue(decodedToken);
      cacheService.get.mockResolvedValue(refreshTokenDto.refreshToken);
      userRepository.findById.mockResolvedValue(inactiveUser);

      await expect(useCase.execute(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userRepository.findById).toHaveBeenCalledWith(decodedToken.sub);
    });

    it("should throw BadRequestException when an unexpected error occurs", async () => {
      tokenService.verifyToken.mockImplementation(() => {
        throw new Error("Token verification error");
      });

      await expect(useCase.execute(refreshTokenDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(tokenService.verifyToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
    });

    it("should preserve UnauthorizedException when thrown", async () => {
      const unauthorizedError = new UnauthorizedException("Custom unauthorized error");
      tokenService.verifyToken.mockImplementation(() => {
        throw unauthorizedError;
      });

      await expect(useCase.execute(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.verifyToken).toHaveBeenCalledWith(refreshTokenDto.refreshToken);
    });
  });
});
