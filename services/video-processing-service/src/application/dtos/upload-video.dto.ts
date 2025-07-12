import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UploadVideoDto {
  @ApiProperty({ type: "string", format: "binary" })
  file: Express.Multer.File;
}

export class ProcessVideoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  videoId: string;

  @ApiPropertyOptional({
    description: "Frames per second to extract (default: 1)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(30)
  framesPerSecond?: number;

  @ApiPropertyOptional({
    description: "Output format for frames (default: jpg)",
  })
  @IsOptional()
  @IsString()
  outputFormat?: string;

  @ApiPropertyOptional({
    description: "Compression quality 1-100 (default: 95)",
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  compressionQuality?: number;

  @ApiPropertyOptional({ description: "Processing priority (default: 0)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;
}
