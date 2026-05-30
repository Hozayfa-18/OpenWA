import { Injectable, Scope, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IframeToken } from '../entities/iframe-token.entity';
import { GenerateIframeTokenDto } from '../dto/generate-iframe-token.dto';
import { TenantContext } from '../../../common/tenant/tenant-context.service';
import { createLogger } from '../../../common/services/logger.service';

const DEFAULT_TTL = 60;
const MAX_TTL = 1440;
const EMBED_JWT_MAX_SECONDS = 1800; // 30 min

@Injectable({ scope: Scope.REQUEST })
export class IframeService {
  private readonly logger = createLogger('IframeService');

  constructor(
    @InjectRepository(IframeToken)
    private readonly repo: Repository<IframeToken>,
    private readonly ctx: TenantContext,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async generate(dto: GenerateIframeTokenDto): Promise<{ url: string; expiresAt: Date }> {
    const ttlMinutes = Math.min(dto.ttlMinutes ?? DEFAULT_TTL, MAX_TTL);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    const token = await this.repo.save({
      tenantId: this.ctx.tenantId,
      crmUserId: dto.user.id,
      crmUserName: dto.user.name ?? null,
      scope: dto.scope,
      filter: dto.filter ?? null,
      activeChat: dto.activeChat ?? null,
      useDealsEvents: dto.use_events?.deals ?? false,
      useMessageEvents: dto.use_events?.messages ?? false,
      expiresAt,
    });

    const appUrl = this.config.get<string>('app.embedBaseUrl', 'http://localhost:5173');
    return { url: `${appUrl}/embed/chat?token=${token.id}`, expiresAt };
  }

  async exchange(tokenId: string): Promise<{
    accessToken: string;
    expiresAt: Date;
    payload: Record<string, unknown>;
  }> {
    const token = await this.repo.findOneBy({ id: tokenId });
    if (!token) throw new NotFoundException('Iframe token not found');
    if (token.expiresAt < new Date()) throw new UnauthorizedException('Iframe token has expired');

    const remainingSeconds = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000);
    const ttlSeconds = Math.min(remainingSeconds, EMBED_JWT_MAX_SECONDS);

    const jwtPayload = {
      sub: token.crmUserId,
      tenantId: token.tenantId,
      type: 'embed' as const,
      scope: token.scope,
      filter: token.filter,
      activeChat: token.activeChat,
      useDealsEvents: token.useDealsEvents,
      useMessageEvents: token.useMessageEvents,
      crmUserId: token.crmUserId,
      crmUserName: token.crmUserName,
    };

    const accessToken = this.jwt.sign(jwtPayload, { expiresIn: ttlSeconds });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    return { accessToken, expiresAt, payload: jwtPayload };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpired(): Promise<void> {
    const result = await this.repo.delete({ expiresAt: LessThan(new Date()) });
    this.logger.log(`Cleaned ${result.affected ?? 0} expired iframe tokens`);
  }
}
