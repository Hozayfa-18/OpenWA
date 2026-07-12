import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User, UserRole } from '../../users/entities/user.entity';
import { mapClerkRole } from './clerk-roles';
import type { ClerkClaims } from './clerk-token.service';
import { ClerkApiService } from './clerk-api.service';

const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';

@Injectable()
export class ClerkProvisioningService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly clerkApi: ClerkApiService,
  ) {}

  async upsertTenant(input: { clerkOrgId: string; name: string; slug?: string }): Promise<Tenant> {
    const existing = await this.tenantRepo.findOne({ where: { clerkOrgId: input.clerkOrgId } });
    if (existing) {
      existing.name = input.name;
      return this.tenantRepo.save(existing);
    }
    return this.tenantRepo.save(
      this.tenantRepo.create({
        name: input.name,
        slug: input.slug ?? slugify(input.name),
        clerkOrgId: input.clerkOrgId,
      }),
    );
  }

  async upsertUser(input: {
    clerkUserId: string;
    tenantId: string;
    email: string;
    name: string;
    role: UserRole;
  }): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { clerkUserId: input.clerkUserId } });
    if (existing) {
      existing.tenantId = input.tenantId;
      existing.email = input.email;
      existing.name = input.name;
      existing.role = input.role;
      return this.userRepo.save(existing);
    }
    return this.userRepo.save(
      this.userRepo.create({
        clerkUserId: input.clerkUserId,
        tenantId: input.tenantId,
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: null,
      }),
    );
  }

  async deleteMembership(clerkUserId: string): Promise<void> {
    await this.userRepo.delete({ clerkUserId });
  }

  /**
   * Resolve tenant/user from a verified token, JIT-creating rows if missing. Null if no active org.
   * The default Clerk session token carries no email/name and no org name, so we fetch those from
   * the Clerk Backend API — but only when a row is new or still holds a placeholder, never per request.
   */
  async resolveFromClaims(
    claims: ClerkClaims,
  ): Promise<{ tenantId: string; userId: string; role: UserRole } | null> {
    if (!claims.orgId) return null;
    const role = mapClerkRole(claims.orgRole);

    // Tenant: fetch the real org name when the row is new or still a placeholder (== orgId).
    let tenant = await this.tenantRepo.findOne({ where: { clerkOrgId: claims.orgId } });
    if (!tenant || !tenant.name || tenant.name === claims.orgId) {
      const org = await this.clerkApi.getOrganization(claims.orgId);
      tenant = await this.upsertTenant({
        clerkOrgId: claims.orgId,
        name: org?.name ?? claims.orgId,
        slug: org?.slug,
      });
    }

    // User: fetch the real email/name when the row is new or missing an email.
    let user = await this.userRepo.findOne({ where: { clerkUserId: claims.userId } });
    if (!user || !user.email) {
      const contact = claims.email ? null : await this.clerkApi.getUser(claims.userId);
      user = await this.upsertUser({
        clerkUserId: claims.userId,
        tenantId: tenant.id,
        email: claims.email ?? contact?.email ?? '',
        name: claims.name ?? contact?.name ?? claims.userId,
        role,
      });
    } else if (user.tenantId !== tenant.id || user.role !== role) {
      // Keep tenant membership + role in sync from the token (cheap, no API call).
      user.tenantId = tenant.id;
      user.role = role;
      user = await this.userRepo.save(user);
    }

    return { tenantId: tenant.id, userId: user.id, role: user.role };
  }
}
