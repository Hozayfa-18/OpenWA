import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from '../auth.service';
import { createLogger } from '../../../common/services/logger.service';

/**
 * Hygiene job (ADR-006): deactivates rotated keys whose grace window has closed.
 * Not the enforcement line — `validateApiKey` already rejects past-grace keys —
 * this just keeps the table tidy. Idempotent and safe to run repeatedly.
 */
@Injectable()
export class ExpiredKeyCleanupJob {
  private readonly logger = createLogger('ExpiredKeyCleanupJob');

  constructor(private readonly authService: AuthService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCleanup(): Promise<void> {
    try {
      const count = await this.authService.deactivateExpiredRotatedKeys();
      if (count > 0) {
        this.logger.log(`Deactivated ${count} expired rotated key(s)`, {
          action: 'expired_keys_deactivated',
          count,
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to deactivate expired rotated keys',
        error instanceof Error ? error.message : String(error),
        { action: 'expired_keys_cleanup_error' },
      );
    }
  }
}
