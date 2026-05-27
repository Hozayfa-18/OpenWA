import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/auth.decorators';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('v1/tenants')
@Controller('v1/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly ctx: TenantContext,
  ) {}

  @Get('me')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current tenant profile' })
  me() {
    return this.tenantsService.findById(this.ctx.tenantId);
  }

  @Patch('me')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update current tenant profile' })
  update(@Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(this.ctx.tenantId, dto);
  }
}
