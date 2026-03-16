import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * TenantGuard ensures that the authenticated user has access to the
 * organization (tenant) specified in their JWT currentOrgId.
 * This guard should be used on all endpoints that operate within an org context.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.currentOrgId) {
      throw new ForbiddenException(
        'No organization context. Please select an organization first.',
      );
    }

    // Verify user actually belongs to the org
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: user.userId,
        orgId: user.currentOrgId,
      },
    });

    if (!userRole) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    // Attach role to request for use by RolesGuard and CurrentOrg decorator
    request.user.role = userRole.role;

    return true;
  }
}
