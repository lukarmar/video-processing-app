import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { RegisterUseCase } from "../../application/use-cases/register.use-case";
import { LoginUseCase } from "../../application/use-cases/login.use-case";
import { RefreshTokenUseCase } from "../../application/use-cases/refresh-token.use-case";
import { RegisterDto } from "../../application/dtos/register.dto";
import { LoginDto } from "../../application/dtos/login.dto";
import { RefreshTokenDto } from "../../application/dtos/refresh-token.dto";
import {
  UserResponseDto,
  AuthResponseDto,
} from "../../application/dtos/user-response.dto";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";

const ApiResponseUtil = {
  success: (data: any, message: string, statusCode: number = 200) => ({
    success: true,
    data,
    message,
    statusCode,
  }),
};

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({
    status: 201,
    description: "User registered successfully",
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 409, description: "User already exists" })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.registerUseCase.execute(registerDto);
    return ApiResponseUtil.success(user, "User registered successfully", 201);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login user" })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto) {
    const authResponse = await this.loginUseCase.execute(loginDto);
    return ApiResponseUtil.success(authResponse, "Login successful");
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({
    status: 200,
    description: "Token refreshed successfully",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid refresh token" })
  @ApiBody({ type: RefreshTokenDto })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const authResponse =
      await this.refreshTokenUseCase.execute(refreshTokenDto);
    return ApiResponseUtil.success(
      authResponse,
      "Token refreshed successfully",
    );
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user profile" })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@Request() req) {
    const userResponse = new UserResponseDto(req.user);
    return ApiResponseUtil.success(
      userResponse,
      "User profile retrieved successfully",
    );
  }

  @Get("validate")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Validate JWT token" })
  @ApiResponse({ status: 200, description: "Token is valid" })
  @ApiResponse({ status: 401, description: "Invalid token" })
  async validateToken(@Request() req) {
    return ApiResponseUtil.success(
      { valid: true, userId: req.user.id },
      "Token is valid",
    );
  }
}
