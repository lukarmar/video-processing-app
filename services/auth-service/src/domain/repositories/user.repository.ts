import { User } from "../entities/user.entity";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Partial<User>): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  findAll(options?: {
    limit?: number;
    offset?: number;
    isActive?: boolean;
  }): Promise<User[]>;
  count(options?: { isActive?: boolean }): Promise<number>;
}
