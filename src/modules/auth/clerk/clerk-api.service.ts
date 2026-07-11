import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { createLogger } from '../../../common/services/logger.service';

/** Thin wrapper over Clerk's Backend API for authoritative user/org details at provisioning time. */
@Injectable()
export class ClerkApiService {
  private readonly logger = createLogger('ClerkApiService');
  private readonly client: ClerkClient | null;

  constructor(config: ConfigService) {
    const secretKey = config.get<string>('clerk.secretKey');
    this.client = secretKey ? createClerkClient({ secretKey }) : null;
  }

  /** Primary email + display name for a Clerk user, or null if unavailable. */
  async getUser(userId: string): Promise<{ email: string; name: string } | null> {
    if (!this.client) return null;
    try {
      const u = await this.client.users.getUser(userId);
      const email =
        u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? '';
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || email;
      return { email, name };
    } catch (err) {
      this.logger.warn('Clerk getUser failed', { userId, error: String(err) });
      return null;
    }
  }

  /** Display name + slug for a Clerk organization, or null if unavailable. */
  async getOrganization(orgId: string): Promise<{ name: string; slug?: string } | null> {
    if (!this.client) return null;
    try {
      const o = await this.client.organizations.getOrganization({ organizationId: orgId });
      return { name: o.name, slug: o.slug ?? undefined };
    } catch (err) {
      this.logger.warn('Clerk getOrganization failed', { orgId, error: String(err) });
      return null;
    }
  }
}
