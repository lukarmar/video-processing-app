import { Injectable } from "@nestjs/common";
import { FileStorageService } from "../../application/ports/services";
import * as path from "path";
import * as fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class LocalFileStorageService implements FileStorageService {
  private readonly uploadPath = process.env.UPLOAD_PATH || "/app/uploads";

  async saveFile(file: Express.Multer.File, userId: string): Promise<string> {
    const filename = file.filename || `${uuidv4()}_${file.originalname}`;
    const userDir = path.join(this.uploadPath, userId);
    const filePath = path.join(userDir, filename);

    await fs.mkdir(userDir, { recursive: true });
    await fs.writeFile(filePath, file.buffer);

    return filename;
  }

  getFilePath(filename: string, userId: string): string {
    return path.join(this.uploadPath, userId, filename);
  }

  async deleteFile(filename: string, userId: string): Promise<void> {
    const filePath = this.getFilePath(filename, userId);
    await fs.unlink(filePath);
  }

  getFileUrl(filename: string, userId: string): string {
    return `/uploads/${userId}/${filename}`;
  }

  async fileExists(filename: string, userId: string): Promise<boolean> {
    const filePath = this.getFilePath(filename, userId);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
