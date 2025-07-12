import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../domain/entities/user.entity";
import { UserRepository } from "../../domain/repositories/user.repository";

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    const result = await this.userRepository.update(id, userData);
    if (result.affected === 0) {
      return null;
    }
    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.userRepository.delete(id);
    return result.affected > 0;
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    isActive?: boolean;
  }): Promise<User[]> {
    const queryBuilder = this.userRepository.createQueryBuilder("user");

    if (options?.isActive !== undefined) {
      queryBuilder.where("user.isActive = :isActive", {
        isActive: options.isActive,
      });
    }

    if (options?.limit) {
      queryBuilder.limit(options.limit);
    }

    if (options?.offset) {
      queryBuilder.offset(options.offset);
    }

    queryBuilder.orderBy("user.createdAt", "DESC");

    return await queryBuilder.getMany();
  }

  async count(options?: { isActive?: boolean }): Promise<number> {
    const queryBuilder = this.userRepository.createQueryBuilder("user");

    if (options?.isActive !== undefined) {
      queryBuilder.where("user.isActive = :isActive", {
        isActive: options.isActive,
      });
    }

    return await queryBuilder.getCount();
  }
}
