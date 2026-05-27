import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookModule } from '../webhook/webhook.module';
import { CrmInboundWebhookController } from './controllers/crm-inbound-webhook.controller';
import { CrmSyncController } from './controllers/crm-sync.controller';
import { Contact } from './entities/contact.entity';
import { CrmUser } from './entities/crm-user.entity';
import { Deal } from './entities/deal.entity';
import { CrmAuthGuard } from './guards/crm-auth.guard';
import { CrmContactsService } from './services/crm-contacts.service';
import { CrmDealsService } from './services/crm-deals.service';
import { CrmOutboundService } from './services/crm-outbound.service';
import { CrmUsersService } from './services/crm-users.service';
import { Conversation } from '../conversations/entities/conversation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Deal, CrmUser, Conversation]),
    WebhookModule,
  ],
  controllers: [CrmSyncController, CrmInboundWebhookController],
  providers: [CrmAuthGuard, CrmContactsService, CrmDealsService, CrmUsersService, CrmOutboundService],
  exports: [CrmContactsService, CrmDealsService, CrmUsersService, CrmOutboundService],
})
export class CrmModule {}
