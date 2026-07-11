import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RotateApiKeyDto {
  @ApiPropertyOptional({
    description:
      'Hours the old key keeps working after rotation (grace window). 0 = revoke immediately. Defaults to API_KEY_GRACE_PERIOD_HOURS (24).',
    minimum: 0,
    maximum: 720,
    example: 24,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  gracePeriodHours?: number;
}
