import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IframeToken } from './entities/iframe-token.entity';
import { IframeService } from './services/iframe.service';
import { IframeController } from './iframe.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([IframeToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret', 'change-me-in-production'),
      }),
    }),
  ],
  providers: [IframeService],
  controllers: [IframeController],
})
export class IframeModule {}
