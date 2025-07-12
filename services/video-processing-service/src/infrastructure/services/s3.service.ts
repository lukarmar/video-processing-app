import { Injectable, Logger } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import * as fs from 'fs';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3;
  private readonly bucketName: string;

  constructor() {
    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.NODE_ENV === 'development' ? 'http://localstack:4566' : undefined,
      s3ForcePathStyle: process.env.NODE_ENV === 'development' ? true : false,
    });
    this.bucketName = process.env.AWS_S3_BUCKET || 'video-processing-bucket';
    
    if (process.env.NODE_ENV === 'development') {
      this.initializeBucket();
    }
  }

  private async initializeBucket(): Promise<void> {
    try {
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      this.logger.log(`S3 bucket ${this.bucketName} already exists`);
    } catch (error) {
      if (error.code === 'NotFound' || error.code === 'NoSuchBucket') {
        try {
          await this.s3.createBucket({ Bucket: this.bucketName }).promise();
          this.logger.log(`S3 bucket ${this.bucketName} created successfully`);
        } catch (createError) {
          this.logger.error(`Failed to create S3 bucket: ${createError.message}`);
        }
      } else {
        this.logger.error(`Error checking S3 bucket: ${error.message}`);
      }
    }
  }

  async uploadFile(
    filePath: string,
    s3Key: string,
    contentType?: string,
  ): Promise<string> {
    try {
      this.logger.log(`Uploading file to S3: ${s3Key} to bucket: ${this.bucketName}`);
      this.logger.log(`S3 Configuration - Endpoint: ${this.s3.config.endpoint}, Force Path Style: ${this.s3.config.s3ForcePathStyle}`);
      
      const fileStream = fs.createReadStream(filePath);
      const uploadParams: S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileStream,
        ContentType: contentType || 'application/octet-stream',
      };

      const result = await this.s3.upload(uploadParams).promise();
      this.logger.log(`File uploaded successfully: ${result.Location}`);
      
      return result.Location;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
      this.logger.error(`Error details: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }
  }

  async generatePresignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: s3Key,
        Expires: expiresIn,
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      this.logger.log(`Generated presigned URL for: ${s3Key}`);
      if (process.env.NODE_ENV === 'development' && url.includes('localstack:4566')) {
        const externalUrl = url.replace('localstack:4566', 'localhost:4566');
        this.logger.log(`Converted to external URL: ${externalUrl}`);
        return externalUrl;
      }
      
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(s3Key: string): Promise<void> {
    try {
      await this.s3
        .deleteObject({
          Bucket: this.bucketName,
          Key: s3Key,
        })
        .promise();
      
      this.logger.log(`File deleted from S3: ${s3Key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`);
      throw error;
    }
  }

  async fileExists(s3Key: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({
          Bucket: this.bucketName,
          Key: s3Key,
        })
        .promise();
      
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}
