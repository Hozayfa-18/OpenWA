import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { UpsertCrmUserItemDto } from '../dto/upsert-crm-users.dto';
import { CrmUser } from '../entities/crm-user.entity';

@Injectable()
export class CrmUsersService {
  constructor(
    @InjectRepository(CrmUser)
    private readonly repo: Repository<CrmUser>,
    private readonly ctx: TenantContext,
  ) {}

  findAll(): Promise<CrmUser[]> {
    return this.repo.findBy({ tenantId: this.ctx.tenantId });
  }

  async upsert(items: UpsertCrmUserItemDto[]): Promise<{ upserted: number }> {
    const tenantId = this.ctx.tenantId;

    if (items.length === 0) {
      return { upserted: 0 };
    }

    await this.repo.upsert(
      items.map(item => ({
        id: item.id,
        tenantId,
        name: item.name,
        email: item.email ?? null,
      })),
      { conflictPaths: ['tenantId', 'id'], skipUpdateIfNoValuesChanged: true },
    );

    return { upserted: items.length };
  }
}
