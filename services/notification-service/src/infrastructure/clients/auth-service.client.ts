import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface UserData {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  preferences?: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
  };
}

@Injectable()
export class AuthServiceClient {
  private readonly logger = new Logger(AuthServiceClient.name);
  private readonly httpClient: AxiosInstance;
  private readonly authServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://auth-service:3006';
    
    this.httpClient = axios.create({
      baseURL: this.authServiceUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Auth Service Client initialized with URL: ${this.authServiceUrl}`);
  }

  async getUserById(userId: string): Promise<UserData | null> {
    try {
      this.logger.log(`Fetching user data for userId: ${userId}`);
      
      const response = await this.httpClient.get(`/users/${userId}`);
      
      if (response.status === 200 && response.data.success) {
        const userData = response.data.data;
        
        const userWithPreferences: UserData = {
          ...userData,
          preferences: userData.preferences || {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
          },
        };
        
        this.logger.log(`User data fetched successfully for userId: ${userId}`);
        return userWithPreferences;
      }
      
      return null;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.warn(`User not found: ${userId}`);
        return null;
      }
      
      this.logger.error(`Failed to fetch user ${userId} from auth service:`, error.message);
      
      return {
        id: parseInt(userId),
        email: `user-${userId}@temp.com`,
        name: `Usuário ${userId}`,
        isActive: true,
        preferences: {
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
        },
      };
    }
  }

  async getUserByEmail(email: string): Promise<UserData | null> {
    try {
      this.logger.log(`Fetching user data for email: ${email}`);
      
      const response = await this.httpClient.get(`/users/by-email/${encodeURIComponent(email)}`);
      
      if (response.status === 200 && response.data.success) {
        const userData = response.data.data;
        
        const userWithPreferences: UserData = {
          ...userData,
          preferences: userData.preferences || {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
          },
        };
        
        this.logger.log(`User data fetched successfully for email: ${email}`);
        return userWithPreferences;
      }
      
      return null;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.warn(`User not found by email: ${email}`);
        return null;
      }
      
      this.logger.error(`Failed to fetch user by email ${email} from auth service:`, error.message);
      return null;
    }
  }

  async checkServiceHealth(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Auth service health check failed:', error.message);
      return false;
    }
  }
}
