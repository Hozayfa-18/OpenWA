import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { BulkMessageService } from './bulk-message.service';
import { MessageController } from './message.controller';
import { SessionModule } from '../session/session.module';
import { Message } from './entities/message.entity';
import { MessageBatch } from './entities/message-batch.entity';
import { QueueModule } from '../queue/queue.module';
import { Conversation } from '../conversations/entities/conversation.entity';

const messageQueueModules = process.env.QUEUE_ENABLED === 'true' ? [QueueModule] : [];

@Module({
  imports: [TypeOrmModule.forFeature([Message, MessageBatch, Conversation], 'data'), SessionModule, ...messageQueueModules],
  controllers: [MessageController],
  providers: [MessageService, BulkMessageService],
  exports: [MessageService, BulkMessageService],
})
export class MessageModule {}
