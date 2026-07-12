import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import type { Request } from 'express';
import { Public } from '../decorators/auth.decorators';
import { ClerkProvisioningService } from './clerk-provisioning.service';
import { mapClerkRole } from './clerk-roles';
import { createLogger } from '../../../common/services/logger.service';

interface ClerkEvent {
  type: string;
  data: Record<string, unknown>;
}

@Controller('webhooks/clerk')
export class ClerkWebhookController {
  private readonly logger = createLogger('ClerkWebhookController');

  constructor(
    private readonly config: ConfigService,
    private readonly provisioning: ClerkProvisioningService,
  ) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
  ): Promise<{ received: boolean }> {
    const secret = this.config.get<string>('clerk.webhookSigningSecret');
    if (!secret) throw new BadRequestException('Webhook secret not configured');

    // Raw bytes are required so the Svix signature matches (enabled via rawBody:true in main.ts).
    const payload = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

    let event: ClerkEvent;
    try {
      event = new Webhook(secret).verify(payload.toString('utf8'), {
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature'],
      }) as ClerkEvent;
    } catch (err) {
      this.logger.warn('Invalid Clerk webhook signature', { error: String(err) });
      throw new BadRequestException('Invalid signature');
    }

    await this.dispatch(event);
    return { received: true };
  }

  private async dispatch(event: ClerkEvent): Promise<void> {
    const d = event.data;
    switch (event.type) {
      case 'organization.created':
      case 'organization.updated':
        await this.provisioning.upsertTenant({
          clerkOrgId: String(d.id),
          name: String(d.name ?? d.id),
          slug: d.slug ? String(d.slug) : undefined,
        });
        break;

      case 'organizationMembership.created':
      case 'organizationMembership.updated': {
        const org = d.organization as Record<string, unknown> | undefined;
        const pud = d.public_user_data as Record<string, unknown> | undefined;
        if (!org || !pud) break;
        const tenant = await this.provisioning.upsertTenant({
          clerkOrgId: String(org.id),
          name: String(org.name ?? org.id),
        });
        await this.provisioning.upsertUser({
          clerkUserId: String(pud.user_id),
          tenantId: tenant.id,
          email: String(pud.identifier ?? ''),
          name:
            [pud.first_name, pud.last_name].filter(Boolean).join(' ') ||
            String(pud.identifier ?? pud.user_id),
          role: mapClerkRole(d.role ? String(d.role) : undefined),
        });
        break;
      }

      case 'organizationMembership.deleted': {
        const pud = d.public_user_data as Record<string, unknown> | undefined;
        if (pud?.user_id) await this.provisioning.deleteMembership(String(pud.user_id));
        break;
      }

      default:
        this.logger.debug(`Unhandled Clerk event: ${event.type}`);
    }
  }
}
