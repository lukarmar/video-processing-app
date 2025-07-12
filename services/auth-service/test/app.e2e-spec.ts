import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { TestAppModule } from "./test-app.module";

describe("AuthService (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/health (GET)", () => {
    return request(app.getHttpServer())
      .get("/health")
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe("ok");
        expect(res.body.data.service).toBe("auth-service");
      });
  });

  it("/api/docs (GET)", () => {
    return request(app.getHttpServer())
      .get("/api/docs")
      .expect((res) => {
        expect([200, 404]).toContain(res.status);
      });
  });

  it("/auth/login (POST) - should return 400 for invalid credentials", () => {
    return request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "invalid-email",
        password: "short",
      })
      .expect(400);
  });

  it("/auth/register (POST) - should return 400 for invalid data", () => {
    return request(app.getHttpServer())
      .post("/auth/register")
      .send({
        email: "invalid-email",
        password: "short",
      })
      .expect(400);
  });
});
