import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../../common/tenant/tenant.module';
import { Message } from '../message/entities/message.entity';
import { ConversationsController } from './conversations.controller';
import { Conversation } from './entities/conversation.entity';
import { ConversationRepository } from './repositories/conversation.repository';
import { ConversationsService } from './services/conversations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message]), TenantModule],
  providers: [ConversationRepository, ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}

