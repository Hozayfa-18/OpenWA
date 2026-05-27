import {
  Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/auth.decorators';
import { AuthService } from '../auth.service';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { UserRole } from '../../users/entities/user.entity';
import { CreateApiKeyDto } from '../dto';

@ApiTags('v1/api-keys')
@Controller('v1/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class V1ApiKeysController {
  constructor(
    private readonly authService: AuthService,
    private readonly ctx: TenantContext,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'List tenant API keys' })
  findAll() {
    return this.authService.findAllForTenant(this.ctx.tenantId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Create a tenant API key' })
  async create(@Body() dto: CreateApiKeyDto) {
    const { apiKey, rawKey } = await this.authService.createApiKeyForTenant(
      this.ctx.tenantId,
      dto,
    );
    return { ...apiKey, apiKey: rawKey };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tenant API key' })
  delete(@Param('id') id: string) {
    return this.authService.deleteForTenant(this.ctx.tenantId, id);
  }
}
