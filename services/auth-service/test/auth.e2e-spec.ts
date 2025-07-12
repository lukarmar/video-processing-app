import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { TestAppModule } from "./test-app.module";

describe("AuthController (e2e)", () => {
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

  describe("/auth/register (POST)", () => {
    it("should register a new user", () => {
      const timestamp = Date.now();
      return request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: `test-${timestamp}@example.com`,
          password: "StrongPassword123",
          name: "Test User",
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty("id");
          expect(res.body.data.email).toBe(`test-${timestamp}@example.com`);
          expect(res.body.data.name).toBe("Test User");
          expect(res.body.data.isActive).toBe(true);
        });
    });

    it("should return 409 when user already exists", async () => {
      const timestamp = Date.now();
      const userData = {
        email: `existing-${timestamp}@example.com`,
        password: "StrongPassword123",
        name: "Existing User",
      };

      await request(app.getHttpServer())
        .post("/auth/register")
        .send(userData)
        .expect(201);

      return request(app.getHttpServer())
        .post("/auth/register")
        .send(userData)
        .expect(409);
    });

    it("should return 400 for invalid email", () => {
      return request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "invalid-email",
          password: "StrongPassword123",
          name: "Test User",
        })
        .expect(400);
    });

    it("should return 400 for weak password", () => {
      const timestamp = Date.now();
      return request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: `test-weak-${timestamp}@example.com`,
          password: "weak",
          name: "Test User",
        })
        .expect(400);
    });
  });

  describe("/auth/login (POST)", () => {
    let testUserEmail: string;
    
    beforeEach(async () => {
      const timestamp = Date.now();
      testUserEmail = `login-${timestamp}@example.com`;
      
      await request(app.getHttpServer()).post("/auth/register").send({
        email: testUserEmail,
        password: "StrongPassword123",
        name: "Login User",
      });
    });

    it("should login successfully", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: testUserEmail,
          password: "StrongPassword123",
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty("accessToken");
          expect(res.body.data).toHaveProperty("refreshToken");
          expect(res.body.data.user.email).toBe(testUserEmail);
        });
    });

    it("should return 401 for invalid credentials", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: testUserEmail,
          password: "WrongPassword",
        })
        .expect(401);
    });

    it("should return 401 for non-existent user", () => {
      const timestamp = Date.now();
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: `nonexistent-${timestamp}@example.com`,
          password: "StrongPassword123",
        })
        .expect(401);
    });
  });

  describe("/auth/profile (GET)", () => {
    let accessToken: string;
    let testUserEmail: string;

    beforeEach(async () => {
      const timestamp = Date.now();
      testUserEmail = `profile-${timestamp}@example.com`;
      
      await request(app.getHttpServer()).post("/auth/register").send({
        email: testUserEmail,
        password: "StrongPassword123",
        name: "Profile User",
      });

      const loginResponse = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: testUserEmail,
          password: "StrongPassword123",
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it("should return user profile", () => {
      return request(app.getHttpServer())
        .get("/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.email).toBe(testUserEmail);
          expect(res.body.data.name).toBe("Profile User");
        });
    });

    it("should return 401 without token", () => {
      return request(app.getHttpServer()).get("/auth/profile").expect(401);
    });

    it("should return 401 with invalid token", () => {
      return request(app.getHttpServer())
        .get("/auth/profile")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });
  });
});
