import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma.service';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
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
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-id',
        email: registerDto.email,
        name: registerDto.name,
        passwordHash: 'hashed-password',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(registerDto.email);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          passwordHash: 'hashed-password',
          name: registerDto.name,
        },
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should successfully login a user with correct credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: 'user-id',
        email: loginDto.email,
        passwordHash: 'hashed-password',
        userRoles: [
          {
            org: { id: 'org-1', name: 'Org 1' },
            role: 'admin',
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(loginDto.email);
      expect(result.user.orgs).toHaveLength(1);
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrong-password',
      };

      const mockUser = {
        id: 'user-id',
        email: loginDto.email,
        passwordHash: 'hashed-password',
        userRoles: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens for valid user', async () => {
      const userId = 'user-id';
      const email = 'test@example.com';

      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          org: { id: 'org-1', name: 'Org 1' },
          role: 'admin',
        },
      ]);
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.refreshToken(userId, email);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('getMe', () => {
    it('should return user profile with orgs', async () => {
      const userId = 'user-id';

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        userRoles: [
          {
            org: { id: 'org-1', name: 'Org 1' },
            role: 'admin',
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe(userId);

      expect(result.id).toBe(userId);
      expect(result.email).toBe(mockUser.email);
      expect(result.orgs).toHaveLength(1);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('nonexistent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
