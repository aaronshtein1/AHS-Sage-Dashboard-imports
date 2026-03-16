import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId || !user.currentOrgId) {
      return false;
    }

    // Get user's role in the current org
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: user.userId,
        orgId: user.currentOrgId,
      },
    });

    if (!userRole) {
      return false;
    }

    // Attach role to request user for use in CurrentOrg decorator
    request.user.role = userRole.role;

    return requiredRoles.includes(userRole.role);
  }
}
