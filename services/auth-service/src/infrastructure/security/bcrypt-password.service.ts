import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PasswordService } from "../../application/ports/password.service";

@Injectable()
export class BcryptPasswordService implements PasswordService {
  private readonly saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }
}
