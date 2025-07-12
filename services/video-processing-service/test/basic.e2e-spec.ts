import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { HealthController } from '../src/presentation/controllers/health.controller';
import { ConfigService } from '@nestjs/config';

describe('Video Processing Service - Basic E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'NODE_ENV': 'test',
                'PORT': 3002,
                'APP_VERSION': '1.0.0',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET) should return service status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status', 'ok');
      expect(response.body.data).toHaveProperty('service');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('message');
    });

    it('/health (GET) should return proper response structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(typeof response.body.success).toBe('boolean');
      expect(typeof response.body.data.status).toBe('string');
      expect(typeof response.body.data.uptime).toBe('number');
      expect(typeof response.body.data.memory).toBe('object');
      expect(response.body.data.memory).toHaveProperty('rss');
      expect(response.body.data.memory).toHaveProperty('heapTotal');
      expect(response.body.data.memory).toHaveProperty('heapUsed');
    });

    it('/health (GET) should return consistent data types', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const { data } = response.body;
      
      expect(data.status).toBe('ok');
      expect(typeof data.service).toBe('string');
      expect(typeof data.version).toBe('string');
      expect(typeof data.environment).toBe('string');
      expect(typeof data.port).toBe('number');
      expect(data.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      await request(app.getHttpServer())
        .get('/non-existent-route')
        .expect(404);
    });

    it('should handle invalid HTTP methods on health endpoint', async () => {
      await request(app.getHttpServer())
        .post('/health')
        .expect(404);
    });
  });
});
