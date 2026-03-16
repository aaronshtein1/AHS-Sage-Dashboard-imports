import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { PrismaService } from '../common/prisma.service';

describe('TenantGuard - Tenant Isolation', () => {
  let guard: TenantGuard;
  let prisma: PrismaService;

  const mockPrismaService = {
    userRole: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGuard,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    guard = module.get<TenantGuard>(TenantGuard);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as ExecutionContext;
  };

  describe('Tenant Access Control', () => {
    it('should allow access when user belongs to the org', async () => {
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

      const context = createMockExecutionContext(mockUser);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.userRole.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          orgId: 'org-1',
        },
      });
    });

    it('should deny access when user does not belong to the org', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-999', // Org user doesn't belong to
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      const context = createMockExecutionContext(mockUser);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deny access when no org context is set', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: null, // No org selected
      };

      const context = createMockExecutionContext(mockUser);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deny access when user is not authenticated', async () => {
      const mockUser = null;

      const context = createMockExecutionContext(mockUser);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should attach role to request for downstream guards', async () => {
      const mockRequest = {
        user: {
          userId: 'user-1',
          currentOrgId: 'org-1',
        },
      };

      const mockUserRole = {
        userId: 'user-1',
        orgId: 'org-1',
        role: 'accountant',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      await guard.canActivate(context);

      expect(mockRequest.user.role).toBe('accountant');
    });
  });

  describe('Cross-Tenant Data Isolation', () => {
    it('should prevent user from org-1 accessing org-2 data', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-2', // User trying to access org-2
      };

      // User only belongs to org-1
      mockPrismaService.userRole.findFirst.mockResolvedValue(null);

      const context = createMockExecutionContext(mockUser);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should verify tenant membership on every request', async () => {
      const mockUser = {
        userId: 'user-1',
        currentOrgId: 'org-1',
      };

      mockPrismaService.userRole.findFirst.mockResolvedValue({
        userId: 'user-1',
        orgId: 'org-1',
        role: 'viewer',
      });

      const context = createMockExecutionContext(mockUser);

      await guard.canActivate(context);

      // Verify that we actually query the database each time
      expect(mockPrismaService.userRole.findFirst).toHaveBeenCalledTimes(1);
    });
  });
});
