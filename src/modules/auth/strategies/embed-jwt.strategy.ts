import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface EmbedJwtPayload {
  sub: string;
  tenantId: string;
  type: 'embed';
  scope: 'global' | 'card';
  filter: Array<{ chatType: string; chatId: string; username?: string }> | null;
  activeChat: { channelId?: string; chatType: string; chatId: string } | null;
  useDealsEvents: boolean;
  useMessageEvents: boolean;
  crmUserId: string;
  crmUserName: string | null;
}

@Injectable()
export class EmbedJwtStrategy extends PassportStrategy(Strategy, 'embed-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('auth.jwtSecret', 'change-me-in-production'),
    });
  }

  validate(payload: EmbedJwtPayload): EmbedJwtPayload | null {
    if (payload.type !== 'embed') return null;
    return payload;
  }
}
