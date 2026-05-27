import { Module, DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { SessionModule } from './modules/session/session.module';
import { MessageModule } from './modules/message/message.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { EngineModule } from './engine/engine.module';
import { LoggerModule } from './common/services/logger.module';
import { SettingsModule } from './modules/settings/settings.module';
import { InfraModule } from './modules/infra/infra.module';
import { EventsModule } from './modules/events/events.module';
import { ContactModule } from './modules/contact/contact.module';
import { GroupModule } from './modules/group/group.module';
import { LabelModule } from './modules/label/label.module';
import { ChannelModule } from './modules/channel/channel.module';
import { CacheModule } from './common/cache';
import { StorageModule } from './common/storage/storage.module';
import { StatsModule } from './modules/stats/stats.module';
import { StatusModule } from './modules/status/status.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HooksModule } from './core/hooks';
import { PluginsModule } from './core/plugins';
import { PluginsApiModule } from './modules/plugins/plugins.module';
import { TenantModule } from './common/tenant/tenant.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { CrmModule } from './modules/crm/crm.module';
import { ConversationsModule } from './modules/conversations/conversations.module';

const queueModules: Array<Type | DynamicModule> = [];
if (process.env.QUEUE_ENABLED === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const queueModule = require('./modules/queue/queue.module') as { QueueModule: Type };
  queueModules.push(queueModule.QueueModule);
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database', 'postgres'),
        entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.get<boolean>('database.synchronize', false),
        migrationsRun: !configService.get<boolean>('database.synchronize', false),
        logging: configService.get<boolean>('database.logging', false),
        retryAttempts: 10,
        retryDelay: 3000,
        ssl: configService.get<boolean>('database.ssl', true)
          ? { rejectUnauthorized: configService.get<boolean>('database.sslRejectUnauthorized', false) }
          : false,
        extra: { max: configService.get<number>('database.poolSize', 10) },
      }),
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: configService.get<number>('api.rateLimit.shortTtl', 1000), limit: configService.get<number>('api.rateLimit.shortLimit', 10) },
          { name: 'medium', ttl: configService.get<number>('api.rateLimit.mediumTtl', 60000), limit: configService.get<number>('api.rateLimit.mediumLimit', 100) },
          { name: 'long', ttl: configService.get<number>('api.rateLimit.longTtl', 3600000), limit: configService.get<number>('api.rateLimit.longLimit', 1000) },
        ],
      }),
    }),

    HooksModule,
    PluginsModule,
    LoggerModule,
    CacheModule,
    StorageModule,
    AuditModule,
    EventsModule,
    ...queueModules,
    AuthModule,
    TenantModule,
    TenantsModule,
    UsersModule,
    CrmModule,
    ConversationsModule,
    EngineModule,
    SessionModule,
    MessageModule,
    WebhookModule,
    HealthModule,
    SettingsModule,
    InfraModule,
    ContactModule,
    GroupModule,
    LabelModule,
    ChannelModule,
    StatsModule,
    StatusModule,
    CatalogModule,
    PluginsApiModule,
  ],
})
export class AppModule {}
