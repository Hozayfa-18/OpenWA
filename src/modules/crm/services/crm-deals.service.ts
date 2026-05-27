import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { UpsertDealItemDto } from '../dto/upsert-deals.dto';
import { Deal } from '../entities/deal.entity';

@Injectable()
export class CrmDealsService {
  constructor(
    @InjectRepository(Deal, 'data')
    private readonly repo: Repository<Deal>,
    private readonly ctx: TenantContext,
  ) {}

  findAll(): Promise<Deal[]> {
    return this.repo.findBy({ tenantId: this.ctx.tenantId });
  }

  async upsert(items: UpsertDealItemDto[]): Promise<{ upserted: number }> {
    const tenantId = this.ctx.tenantId;

    if (items.length === 0) {
      return { upserted: 0 };
    }

    await this.repo.upsert(
      items.map(item => ({
        id: item.id,
        tenantId,
        name: item.name,
        responsibleUserId: item.responsibleUserId ?? null,
        contactIds: item.contactIds ?? [],
        closed: item.closed ?? false,
        uri: item.uri ?? null,
      })),
      { conflictPaths: ['tenantId', 'id'], skipUpdateIfNoValuesChanged: true },
    );

    return { upserted: items.length };
  }
}
