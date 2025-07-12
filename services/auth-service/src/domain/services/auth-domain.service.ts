import { Injectable } from "@nestjs/common";
import { User } from "../entities/user.entity";
import { Email } from "../value-objects/email.vo";
import { Password } from "../value-objects/password.vo";

@Injectable()
export class AuthDomainService {
  public validateUserCredentials(
    user: User,
    email: Email,
    password: Password,
  ): boolean {
    if (!user.isActive) {
      throw new Error("User account is deactivated");
    }

    const userEmail = new Email(user.email);
    if (!userEmail.equals(email)) {
      return false;
    }

    return user.isValidPassword(password.getValue());
  }

  public canUserPerformAction(user: User): boolean {
    if (!user.isActive) {
      return false;
    }

    return true;
  }

  public createUserEntity(
    email: string,
    password: string,
    name: string,
  ): Partial<User> {
    const emailVO = new Email(email);
    const passwordVO = new Password(password);

    return {
      email: emailVO.getValue(),
      password: passwordVO.getValue(),
      name: name.trim(),
      isActive: true,
    };
  }
}
