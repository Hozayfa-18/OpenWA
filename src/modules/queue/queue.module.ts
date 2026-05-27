import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookProcessor } from './processors/webhook.processor';
import { ConversationUpdateProcessor } from './processors/conversation-update.processor';
import { QUEUE_NAMES } from './queue-names';
import { Webhook } from '../webhook/entities/webhook.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { HooksModule } from '../../core/hooks/hooks.module';

// Re-export for backward compatibility
export { QUEUE_NAMES } from './queue-names';

@Module({
  imports: [
    // Required for WebhookProcessor to inject Repository<Webhook>
    TypeOrmModule.forFeature([Webhook, Conversation], 'data'),
    // Required for WebhookProcessor to inject HookManager
    HooksModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.WEBHOOK }),
    BullModule.registerQueue({ name: QUEUE_NAMES.CONVERSATION_UPDATE }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.WEBHOOK,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.CONVERSATION_UPDATE,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [WebhookProcessor, ConversationUpdateProcessor],
  exports: [BullModule],
})
export class QueueModule {}
