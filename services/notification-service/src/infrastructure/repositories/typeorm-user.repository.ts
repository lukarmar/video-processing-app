import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';

export interface CreateUserData {
  email: string;
  name: string;
  password?: string;
  pushToken?: string;
  phoneNumber?: string;
  preferences?: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
  };
}

@Injectable()
export class TypeOrmUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async create(data: CreateUserData): Promise<User> {
    const user = this.repository.create(data);
    return await this.repository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return await this.repository.findOne({ where: { id: parseInt(id) } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.repository.findOne({ where: { email } });
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    await this.repository.update(parseInt(id), data);
  }

  async findOrCreate(userData: CreateUserData): Promise<User> {
    let user = await this.findByEmail(userData.email);
    
    if (!user) {
      user = await this.create({
        ...userData,
        preferences: userData.preferences || {
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
        },
      });
    }
    
    return user;
  }
}
