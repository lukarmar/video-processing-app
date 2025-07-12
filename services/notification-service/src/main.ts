import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Notification Service API")
    .setDescription("Multi-channel notification service for video platform")
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(",") || ["*"],
    credentials: true,
  });

  const port = process.env.PORT || 3004;
  await app.listen(port);
  console.log(`🔔 Notification Service running on port ${port}`);
}

bootstrap();
