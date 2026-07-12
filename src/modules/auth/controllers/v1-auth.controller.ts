import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthService } from '../jwt-auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/auth.decorators';

// Registration, login, and token refresh are handled by Clerk (see Clerk auth design).
// This controller retains only the DB-backed profile lookup for an authenticated user.
@ApiTags('v1/auth')
@Controller('v1/auth')
export class V1AuthController {
  constructor(private readonly jwtAuthService: JwtAuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@CurrentUser() userId: string) {
    const user = await this.jwtAuthService.me(userId);
    // Never return passwordHash
    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}
