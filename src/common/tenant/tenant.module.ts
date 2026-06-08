import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantContext } from './tenant-context.service';
import { TenantScopeGuard } from './tenant-scope.guard';
import { Session } from '../../modules/session/entities/session.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Session])],
  providers: [TenantContext, TenantScopeGuard],
  // Re-export TypeOrmModule so the Session repository is globally injectable.
  // TenantScopeGuard is instantiated inside each module that applies it via
  // @UseGuards, so those modules must be able to resolve SessionRepository.
  exports: [TenantContext, TenantScopeGuard, TypeOrmModule],
})
export class TenantModule {}
