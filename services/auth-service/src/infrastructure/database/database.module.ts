import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User } from "../../domain/entities/user.entity";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>("DATABASE_URL");

        if (dbUrl?.startsWith("sqlite:")) {
          return {
            type: "sqlite",
            database: dbUrl.replace("sqlite:", ""),
            entities: [User],
            synchronize: true,
            logging: configService.get<string>("NODE_ENV") === "development",
          };
        }

        return {
          type: "postgres",
          url: dbUrl,
          entities: [User],
          synchronize: configService.get<string>("NODE_ENV") !== "production",
          logging: configService.get<string>("NODE_ENV") === "development",
          ssl:
            configService.get<string>("NODE_ENV") === "production"
              ? { rejectUnauthorized: false }
              : false,
        };
      },
    }),
    TypeOrmModule.forFeature([User]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
