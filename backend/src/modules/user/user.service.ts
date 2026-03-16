import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getOrgUsers(orgId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return userRoles.map((ur) => ({
      id: ur.user.id,
      email: ur.user.email,
      name: ur.user.name,
      role: ur.role,
    }));
  }
}
