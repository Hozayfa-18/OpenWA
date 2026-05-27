import { IsEmail, IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString() @MinLength(8)
  password: string;

  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsEnum(UserRole)
  role: UserRole;
}
