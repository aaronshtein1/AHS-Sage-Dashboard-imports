import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { JwtPayload } from '../../common/types';

@Injectable()
export class OrgService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async getUserOrgs(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        org: true,
      },
    });

    return userRoles.map((ur) => ({
      id: ur.org.id,
      name: ur.org.name,
      role: ur.role,
      createdAt: ur.org.createdAt,
    }));
  }

  async createOrg(userId: string, createOrgDto: CreateOrgDto) {
    // Create org and assign creating user as admin
    const org = await this.prisma.org.create({
      data: {
        name: createOrgDto.name,
        userRoles: {
          create: {
            userId,
            role: 'admin',
          },
        },
      },
      include: {
        userRoles: {
          where: { userId },
        },
      },
    });

    return {
      id: org.id,
      name: org.name,
      role: 'admin',
      createdAt: org.createdAt,
    };
  }

  async getOrg(userId: string, orgId: string) {
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        orgId,
      },
      include: {
        org: true,
      },
    });

    if (!userRole) {
      throw new NotFoundException('Organization not found');
    }

    return {
      id: userRole.org.id,
      name: userRole.org.name,
      role: userRole.role,
      createdAt: userRole.org.createdAt,
    };
  }

  async selectOrg(userId: string, orgId: string, userEmail: string) {
    // Verify user has access to this org
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        orgId,
      },
    });

    if (!userRole) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    // Generate new access token with selected org
    const payload: JwtPayload = {
      sub: userId,
      email: userEmail,
      currentOrgId: orgId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1d',
    } as any);

    return {
      accessToken,
      org: {
        id: orgId,
        role: userRole.role,
      },
    };
  }
}
