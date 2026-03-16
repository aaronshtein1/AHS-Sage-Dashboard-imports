import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../common/prisma.service';

describe('RolesGuard - RBAC', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let prisma: PrismaService;

  const mockPrismaService = {
    userRole: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        Reflector,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    user: any,
    requiredRoles: string[] | null,
  ): ExecutionContext => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(requiredRoles);

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  describe('Role-Based Access Control', () => {
    it('should allow access when user has required role', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-1',
      };

      const mockUserRole = {
        userId: 'user-1',
        orgId: 'org-1',
        role: 'admin',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      const context = createMockExecutionContext(mockUser, ['admin']);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user does not have required role', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-1',
      };

      const mockUserRole = {
        userId: 'user-1',
        orgId: 'org-1',
        role: 'viewer', // User is only a viewer
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      const context = createMockExecutionContext(mockUser, ['admin']); // But admin is required
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should allow access when no roles are required', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-1',
      };

      const context = createMockExecutionContext(mockUser, null);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has one of multiple required roles', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-1',
      };

      const mockUserRole = {
        userId: 'user-1',
        orgId: 'org-1',
        role: 'accountant',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      const context = createMockExecutionContext(mockUser, [
        'admin',
        'accountant',
      ]);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user has no role in org', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-1',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      const context = createMockExecutionContext(mockUser, ['admin']);
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });
  });

  describe('Role Hierarchy Enforcement', () => {
    it('should verify admin role has highest privileges', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-1',
      };

      const mockUserRole = {
        userId: 'user-1',
        orgId: 'org-1',
        role: 'admin',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      // Admin should pass admin-only check
      const context = createMockExecutionContext(mockUser, ['admin']);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should verify accountant role cannot access admin-only endpoints', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-1',
      };

      const mockUserRole = {
        userId: 'user-1',
        orgId: 'org-1',
        role: 'accountant',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      // Accountant should not pass admin-only check
      const context = createMockExecutionContext(mockUser, ['admin']);
      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should verify viewer role has read-only access', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-1',
      };

      const mockUserRole = {
        userId: 'user-1',
        orgId: 'org-1',
        role: 'viewer',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      // Viewer can access viewer endpoints
      const viewerContext = createMockExecutionContext(mockUser, [
        'admin',
        'accountant',
        'viewer',
      ]);
      const viewerResult = await guard.canActivate(viewerContext);
      expect(viewerResult).toBe(true);

      // But not admin-only
      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);
      const adminContext = createMockExecutionContext(mockUser, ['admin']);
      const adminResult = await guard.canActivate(adminContext);
      expect(adminResult).toBe(false);
    });
  });
});
