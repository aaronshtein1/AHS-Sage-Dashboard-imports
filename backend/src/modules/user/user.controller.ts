import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantGuard } from '../../guards/tenant.guard';
import { CurrentOrg } from '../../decorators/current-org.decorator';
import type { OrgContext } from '../../common/types';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    return this.userService.getProfile(req.user.userId);
  }

  @Get('org-users')
  @UseGuards(TenantGuard)
  async getOrgUsers(@CurrentOrg() orgContext: OrgContext) {
    return this.userService.getOrgUsers(orgContext.orgId);
  }
}
