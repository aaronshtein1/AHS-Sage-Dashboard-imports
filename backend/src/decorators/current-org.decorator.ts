import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { OrgContext } from '../common/types';

export const CurrentOrg = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext): Promise<OrgContext> => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!user.currentOrgId) {
      throw new UnauthorizedException(
        'No organization context selected. Please select an organization first.',
      );
    }

    // Get the user's role in this org from the database
    // This requires PrismaService to be injected, but decorators can't inject services
    // So we'll add the role to the JWT payload when org is selected
    // For now, we'll assume the role is in the request user object
    const role = user.role || 'viewer';

    return {
      orgId: user.currentOrgId,
      userId: user.userId,
      role,
    };
  },
);
