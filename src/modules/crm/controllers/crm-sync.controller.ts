import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, Scopes } from '../../auth/decorators/auth.decorators';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ScopesGuard } from '../../auth/guards/scopes.guard';
import { UserRole } from '../../users/entities/user.entity';
import { UpsertContactsDto } from '../dto/upsert-contacts.dto';
import { UpsertCrmUsersDto } from '../dto/upsert-crm-users.dto';
import { UpsertDealsDto } from '../dto/upsert-deals.dto';
import { CrmContactsService } from '../services/crm-contacts.service';
import { CrmDealsService } from '../services/crm-deals.service';
import { CrmUsersService } from '../services/crm-users.service';
import { CrmAuthGuard } from '../guards/crm-auth.guard';

@ApiTags('v1/crm')
@Controller('v1/crm')
@UseGuards(CrmAuthGuard, RolesGuard, ScopesGuard)
@ApiBearerAuth()
export class CrmSyncController {
  constructor(
    private readonly contactsService: CrmContactsService,
    private readonly dealsService: CrmDealsService,
    private readonly usersService: CrmUsersService,
  ) {}

  @Post('contacts')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @Scopes('contacts:write')
  @ApiOperation({ summary: 'Upsert up to 100 CRM contacts' })
  upsertContacts(@Body() dto: UpsertContactsDto) {
    return this.contactsService.upsert(dto.contacts);
  }

  @Get('contacts')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_REP, UserRole.QUALITY_CONTROL)
  @Scopes('contacts:read')
  @ApiOperation({ summary: 'List all synced CRM contacts' })
  getContacts() {
    return this.contactsService.findAll();
  }

  @Post('deals')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MANAGER)
  @Scopes('deals:write')
  @ApiOperation({ summary: 'Upsert up to 100 CRM deals' })
  upsertDeals(@Body() dto: UpsertDealsDto) {
    return this.dealsService.upsert(dto.deals);
  }

  @Get('deals')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_REP, UserRole.QUALITY_CONTROL)
  @Scopes('deals:read')
  @ApiOperation({ summary: 'List all synced CRM deals' })
  getDeals() {
    return this.dealsService.findAll();
  }

  @Post('users')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Scopes('contacts:write')
  @ApiOperation({ summary: 'Upsert up to 100 CRM users' })
  upsertUsers(@Body() dto: UpsertCrmUsersDto) {
    return this.usersService.upsert(dto.users);
  }

  @Get('users')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @Scopes('contacts:read')
  @ApiOperation({ summary: 'List all synced CRM users' })
  getUsers() {
    return this.usersService.findAll();
  }
}
