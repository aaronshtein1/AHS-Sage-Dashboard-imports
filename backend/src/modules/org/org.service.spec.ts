import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrgService } from './org.service';
import { PrismaService } from '../../common/prisma.service';

describe('OrgService - Tenant Isolation', () => {
  let service: OrgService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    org: {
      create: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '1d',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OrgService>(OrgService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserOrgs', () => {
    it('should return only orgs the user has access to', async () => {
      const userId = 'user-1';
      const mockUserRoles = [
        {
          org: { id: 'org-1', name: 'Company A', createdAt: new Date() },
          role: 'admin',
        },
        {
          org: { id: 'org-2', name: 'Company B', createdAt: new Date() },
          role: 'accountant',
        },
      ];

      mockPrismaService.userRole.findMany.mockResolvedValue(mockUserRoles);

      const result = await service.getUserOrgs(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('org-1');
      expect(result[1].id).toBe('org-2');
      expect(mockPrismaService.userRole.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { org: true },
      });
    });

    it('should not return orgs user does not belong to', async () => {
      const userId = 'user-1';

      mockPrismaService.userRole.findMany.mockResolvedValue([]);

      const result = await service.getUserOrgs(userId);

      expect(result).toHaveLength(0);
    });
  });

  describe('createOrg', () => {
    it('should create org and assign creator as admin', async () => {
      const userId = 'user-1';
      const createOrgDto = { name: 'New Company' };

      const mockOrg = {
        id: 'org-1',
        name: createOrgDto.name,
        createdAt: new Date(),
        userRoles: [
          {
            userId,
            role: 'admin',
          },
        ],
      };

      mockPrismaService.org.create.mockResolvedValue(mockOrg);

      const result = await service.createOrg(userId, createOrgDto);

      expect(result.name).toBe(createOrgDto.name);
      expect(result.role).toBe('admin');
      expect(mockPrismaService.org.create).toHaveBeenCalledWith({
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
    });
  });

  describe('getOrg', () => {
    it('should return org if user has access', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';

      const mockUserRole = {
        org: {
          id: orgId,
          name: 'Company A',
          createdAt: new Date(),
        },
        role: 'admin',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      const result = await service.getOrg(userId, orgId);

      expect(result.id).toBe(orgId);
      expect(result.name).toBe('Company A');
    });

    it('should throw NotFoundException if user does not have access', async () => {
      const userId = 'user-1';
      const orgId = 'org-999';

      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      await expect(service.getOrg(userId, orgId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('selectOrg - Tenant Isolation', () => {
    it('should generate token with selected org for authorized user', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';
      const userEmail = 'test@example.com';

      const mockUserRole = {
        userId,
        orgId,
        role: 'admin',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.selectOrg(userId, orgId, userEmail);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.org.id).toBe(orgId);
      expect(result.org.role).toBe('admin');
    });

    it('should prevent user from selecting org they do not belong to', async () => {
      const userId = 'user-1';
      const unauthorizedOrgId = 'org-999';
      const userEmail = 'test@example.com';

      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      await expect(
        service.selectOrg(userId, unauthorizedOrgId, userEmail),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should enforce that JWT contains correct orgId', async () => {
      const userId = 'user-1';
      const orgId = 'org-1';
      const userEmail = 'test@example.com';

      const mockUserRole = {
        userId,
        orgId,
        role: 'accountant',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      let capturedPayload;
      mockJwtService.sign.mockImplementation((payload) => {
        capturedPayload = payload;
        return 'token';
      });

      await service.selectOrg(userId, orgId, userEmail);

      expect(capturedPayload.currentOrgId).toBe(orgId);
      expect(capturedPayload.sub).toBe(userId);
    });
  });
});
