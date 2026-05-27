import {
  Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthService } from '../jwt-auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Public, CurrentUser } from '../decorators/auth.decorators';

@ApiTags('v1/auth')
@Controller('api/v1/auth')
export class V1AuthController {
  constructor(private readonly jwtAuthService: JwtAuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new tenant + owner account' })
  async register(@Body() dto: RegisterDto) {
    return this.jwtAuthService.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  async login(@Body() dto: LoginDto) {
    return this.jwtAuthService.login(dto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.jwtAuthService.refresh(body.refreshToken);
  }

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
