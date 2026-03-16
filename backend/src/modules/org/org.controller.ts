import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrgService } from './org.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('orgs')
@UseGuards(JwtAuthGuard)
export class OrgController {
  constructor(private orgService: OrgService) {}

  @Get()
  async getUserOrgs(@Request() req) {
    return this.orgService.getUserOrgs(req.user.userId);
  }

  @Post()
  async createOrg(@Request() req, @Body() createOrgDto: CreateOrgDto) {
    return this.orgService.createOrg(req.user.userId, createOrgDto);
  }

  @Get(':id')
  async getOrg(@Request() req, @Param('id') orgId: string) {
    return this.orgService.getOrg(req.user.userId, orgId);
  }

  @Put(':id/select')
  async selectOrg(@Request() req, @Param('id') orgId: string) {
    return this.orgService.selectOrg(
      req.user.userId,
      orgId,
      req.user.email,
    );
  }
}
