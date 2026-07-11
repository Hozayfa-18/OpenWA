import { Controller, Get, Post, Delete, Body, Param, Req, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/auth.decorators';
import { AuthService } from '../auth.service';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { UserRole } from '../../users/entities/user.entity';
import { CreateApiKeyDto } from '../dto';
import { RotateApiKeyDto } from '../dto/rotate-api-key.dto';

@ApiTags('v1/api-keys')
@Controller('v1/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class V1ApiKeysController {
  constructor(
    private readonly authService: AuthService,
    private readonly ctx: TenantContext,
    private readonly auditService: AuditService,
  ) {}

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return (forwarded as string).split(',')[0].trim();
    return req.ip ?? '';
  }

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
    const { apiKey, rawKey } = await this.authService.createApiKeyForTenant(this.ctx.tenantId, dto);
    return { ...apiKey, apiKey: rawKey };
  }

  @Get(':id/reveal')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Reveal the full API key (always-viewable). Audit-logged.' })
  @ApiResponse({ status: 200, description: 'Decrypted key returned' })
  @ApiResponse({ status: 404, description: 'Key not found for this tenant' })
  @ApiResponse({ status: 422, description: 'Key predates encryption — rotate to get a revealable key' })
  async reveal(@Param('id') id: string, @Req() req: Request) {
    const result = await this.authService.revealForTenant(this.ctx.tenantId, id);
    await this.auditService.logInfo(AuditAction.API_KEY_REVEALED, {
      ipAddress: this.clientIp(req),
      path: req.originalUrl,
      method: req.method,
      metadata: { apiKeyId: id, tenantId: this.ctx.tenantId, userId: this.ctx.userId },
    });
    return result;
  }

  @Post(':id/rotate')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Rotate an API key — issues a new key, grace-expires the old one.' })
  @ApiResponse({ status: 201, description: 'New key issued' })
  @ApiResponse({ status: 404, description: 'Key not found for this tenant' })
  async rotate(@Param('id') id: string, @Body() dto: RotateApiKeyDto, @Req() req: Request) {
    const result = await this.authService.rotateForTenant(this.ctx.tenantId, id, dto.gracePeriodHours);
    await this.auditService.logInfo(AuditAction.API_KEY_ROTATED, {
      ipAddress: this.clientIp(req),
      path: req.originalUrl,
      method: req.method,
      metadata: {
        oldKeyId: id,
        newKeyId: result.id,
        tenantId: this.ctx.tenantId,
        userId: this.ctx.userId,
      },
    });
    return result;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tenant API key' })
  delete(@Param('id') id: string) {
    return this.authService.deleteForTenant(this.ctx.tenantId, id);
  }
}
