import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

import { User } from '../src/domain/entities/user.entity';
import { AuthModule } from '../src/presentation/auth.module';
import { HealthModule } from '../src/presentation/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.test',
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      entities: [User],
      synchronize: true,
      dropSchema: true,
      logging: false,
      autoLoadEntities: true,
    }),
    CacheModule.register({
      isGlobal: true,
      store: 'memory',
    }),
    JwtModule.register({
      global: true,
      secret: 'test-secret-key',
      signOptions: { expiresIn: '1h' },
    }),
    PrometheusModule.register(),
    AuthModule,
    HealthModule,
  ],
})
export class TestAppModule {}
