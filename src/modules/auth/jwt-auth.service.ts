import {
  Injectable, ConflictException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS   = 10;
const REFRESH_TTL_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACCESS_TTL      = '15m';

@Injectable()
export class JwtAuthService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,

    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string }> {
    // Create tenant first
    const slug = this.toSlug(dto.tenantName);
    const tenant = this.tenantRepo.create({ name: dto.tenantName, slug });
    const savedTenant = await this.tenantRepo.save(tenant);

    // Ensure email not taken in this tenant
    const existing = await this.userRepo.findOne({
      where: { tenantId: savedTenant.id, email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    // Create owner user
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      tenantId: savedTenant.id,
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: UserRole.OWNER,
    });
    const savedUser = await this.userRepo.save(user);

    return this.issueTokens(savedUser, savedTenant.id);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user, user.tenantId);
  }

  async refresh(rawToken: string): Promise<{ accessToken: string }> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.refreshRepo.findOne({
      where: { tokenHash, isActive: true },
    });

    if (!stored) throw new UnauthorizedException('Invalid refresh token');
    if (stored.expiresAt && stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.userRepo.findOne({ where: { id: stored.userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const payload: JwtPayload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: ACCESS_TTL });

    return { accessToken };
  }

  async me(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  private async issueTokens(
    user: User,
    tenantId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: user.id, tenantId, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: ACCESS_TTL });

    // Generate and store refresh token
    const rawRefresh   = randomBytes(32).toString('hex');
    const tokenHash    = this.hashToken(rawRefresh);
    const expiresAt    = new Date(Date.now() + REFRESH_TTL_MS);

    const rt = this.refreshRepo.create({ userId: user.id, tenantId, tokenHash, expiresAt });
    await this.refreshRepo.save(rt);

    return { accessToken, refreshToken: rawRefresh };
  }

  private toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
