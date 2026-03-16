import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponse, JwtPayload } from '../../common/types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    // Return login response (no orgs yet for new user)
    return this.generateLoginResponse(user.id, email, []);
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const { email, password } = loginDto;

    // Find user with their org relationships
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            org: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Map user orgs
    const orgs = user.userRoles.map((ur) => ({
      id: ur.org.id,
      name: ur.org.name,
      role: ur.role,
    }));

    return this.generateLoginResponse(user.id, email, orgs);
  }

  async refreshToken(userId: string, email: string): Promise<LoginResponse> {
    // Get user's orgs
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        org: true,
      },
    });

    const orgs = userRoles.map((ur) => ({
      id: ur.org.id,
      name: ur.org.name,
      role: ur.role,
    }));

    return this.generateLoginResponse(userId, email, orgs);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            org: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const orgs = user.userRoles.map((ur) => ({
      id: ur.org.id,
      name: ur.org.name,
      role: ur.role,
    }));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      orgs,
    };
  }

  private generateLoginResponse(
    userId: string,
    email: string,
    orgs: { id: string; name: string; role: string }[],
  ): LoginResponse {
    const payload: JwtPayload = {
      sub: userId,
      email,
      // If user has orgs, set first one as current org
      currentOrgId: orgs.length > 0 ? orgs[0].id : undefined,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1d',
    } as any);

    const refreshToken = this.jwtService.sign(
      { sub: userId, email },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      } as any,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        name: orgs.length > 0 ? email : email, // We don't have name in payload, will fix in controller
        orgs,
      },
    };
  }
}
