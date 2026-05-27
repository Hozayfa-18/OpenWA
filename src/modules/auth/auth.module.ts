import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ApiKey } from './entities/api-key.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';

import { AuthService } from './auth.service';
import { JwtAuthService } from './jwt-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

import { AuthController } from './auth.controller';
import { AuthValidateController } from './auth-validate.controller';
import { V1AuthController } from './controllers/v1-auth.controller';
import { V1ApiKeysController } from './controllers/v1-api-keys.controller';

import { ApiKeyGuard } from './guards/api-key.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ScopesGuard } from './guards/scopes.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey]),
    TypeOrmModule.forFeature([RefreshToken, Tenant, User]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('auth.jwtSecret', 'change-me-in-production'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [
    AuthController,
    AuthValidateController,
    V1AuthController,
    V1ApiKeysController,
  ],
  providers: [
    AuthService,
    JwtAuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    ScopesGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
  exports: [AuthService, JwtAuthService, JwtAuthGuard, RolesGuard, ScopesGuard],
})
export class AuthModule {}

