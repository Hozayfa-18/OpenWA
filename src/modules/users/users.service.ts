import {
  Injectable, ConflictException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly ctx: TenantContext,
  ) {}

  findAll(): Promise<User[]> {
    return this.repo.find({ where: { tenantId: this.ctx.tenantId } });
  }

  async create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.repo.findOne({
      where: { tenantId: this.ctx.tenantId, email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    if (dto.role === UserRole.OWNER) {
      const owner = await this.repo.findOne({
        where: { tenantId: this.ctx.tenantId, role: UserRole.OWNER },
      });
      if (owner) throw new ForbiddenException('A tenant can only have one owner');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.repo.create({
      tenantId: this.ctx.tenantId,
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
    });
    const saved = await this.repo.save(user);
    const { passwordHash: _, ...safe } = saved;
    return safe;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.repo.findOne({ where: { id, tenantId: this.ctx.tenantId } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.name)  user.name = dto.name;
    if (dto.role)  user.role = dto.role;
    return this.repo.save(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.repo.findOne({ where: { id, tenantId: this.ctx.tenantId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.OWNER) {
      throw new ForbiddenException('Cannot delete the tenant owner');
    }
    await this.repo.remove(user);
  }
}
