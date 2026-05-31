import { Body, Controller, ForbiddenException, Get, Post, Query } from '@nestjs/common';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { CrmDealsService } from '../services/crm-deals.service';
import { CreateChatDealDto } from '../dto/create-chat-deal.dto';

@Controller('v1/crm')
export class CrmChatDealsController {
  constructor(
    private readonly dealsService: CrmDealsService,
    private readonly ctx: TenantContext,
  ) {}

  private assertChatInScope(chatId: string): void {
    const embed = this.ctx.embed;
    if (embed?.scope === 'card') {
      const allowed = (embed.filter ?? []).map((f) => f.chatId);
      if (!allowed.includes(chatId)) {
        throw new ForbiddenException('Chat is outside the embed session scope');
      }
    }
  }

  @Get('deals/by-chat')
  byChat(@Query('chatType') chatType: string, @Query('chatId') chatId: string) {
    this.assertChatInScope(chatId);
    return this.dealsService.findForChat(chatType, chatId);
  }

  @Post('deals/by-chat')
  create(@Body() dto: CreateChatDealDto) {
    this.assertChatInScope(dto.chatId);
    return this.dealsService.createForChat(dto.chatType, dto.chatId, dto.name);
  }
}
