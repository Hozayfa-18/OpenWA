import { Repository, FindOptionsWhere, DeepPartial } from 'typeorm';
import { TenantContext } from './tenant-context.service';

export abstract class TenantAwareRepository<T extends { tenantId: string }> {
  protected abstract get repo(): Repository<T>;
  protected abstract get ctx(): TenantContext;

  protected get tenantId(): string {
    return this.ctx.tenantId;
  }

  findAll(where: FindOptionsWhere<T> = {}): Promise<T[]> {
    return this.repo.findBy({
      ...where,
      tenantId: this.tenantId,
    } as FindOptionsWhere<T>);
  }

  findOne(id: string): Promise<T | null> {
    return this.repo.findOneBy({
      id,
      tenantId: this.tenantId,
    } as unknown as FindOptionsWhere<T>);
  }

  async save(entity: DeepPartial<T>): Promise<T> {
    return this.repo.save({
      ...entity,
      tenantId: this.tenantId,
    } as DeepPartial<T>);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({
      id,
      tenantId: this.tenantId,
    } as unknown as FindOptionsWhere<T>);
  }
}
