# OpenLedger Backend - WS2: Auth & Tenant Infrastructure

## Overview

This NestJS backend implements enterprise-grade authentication and multi-tenant infrastructure for the OpenLedger accounting system.

## Features Implemented

### ✅ Authentication System
- JWT-based authentication with access & refresh tokens
- Secure password hashing with bcrypt
- User registration and login
- Token refresh mechanism
- Protected routes with Passport strategies

### ✅ Multi-Tenant Architecture
- Organization-based tenant isolation
- Automatic tenant context injection via decorators
- Guards to enforce tenant membership
- Secure org switching with JWT updates

### ✅ Role-Based Access Control (RBAC)
- Three role levels: `admin`, `accountant`, `viewer`
- Role guards for endpoint protection
- Per-organization role assignments
- Flexible role requirements via decorators

### ✅ Developer-Friendly Tools
- `@CurrentOrg()` decorator for automatic tenant context
- `@Roles()` decorator for role requirements
- `TenantGuard` for org membership enforcement
- `RolesGuard` for role-based access
- Comprehensive Jest tests

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma          # Database models (User, Org, Role)
├── src/
│   ├── common/
│   │   ├── prisma.service.ts  # Database connection service
│   │   └── types/index.ts     # Shared type definitions
│   ├── decorators/
│   │   ├── current-org.decorator.ts  # Extract org context
│   │   └── roles.decorator.ts        # Specify role requirements
│   ├── guards/
│   │   ├── jwt-auth.guard.ts         # JWT authentication
│   │   ├── jwt-refresh.guard.ts      # Refresh token validation
│   │   ├── tenant.guard.ts           # Tenant isolation
│   │   └── roles.guard.ts            # Role-based access
│   ├── modules/
│   │   ├── auth/                     # Authentication module
│   │   ├── org/                      # Organization management
│   │   └── user/                     # User management
│   ├── app.module.ts
│   └── main.ts
└── test/
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info

### Organizations
- `GET /api/orgs` - List user's organizations
- `POST /api/orgs` - Create new organization
- `GET /api/orgs/:id` - Get organization details
- `PUT /api/orgs/:id/select` - Switch organization context

### Users
- `GET /api/users/profile` - Get user profile
- `GET /api/users/org-users` - List users in current org

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/openledger"

# JWT Authentication
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="1d"
JWT_REFRESH_SECRET="your-refresh-secret-change-in-production"
JWT_REFRESH_EXPIRES_IN="7d"
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Run migrations (when WS1 completes schema)
npx prisma migrate dev

# Start development server
npm run start:dev
```

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Usage for Other Workstreams

### Protecting Endpoints

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentOrg } from '../decorators/current-org.decorator';
import type { OrgContext } from '../common/types';

@Controller('example')
@UseGuards(JwtAuthGuard, TenantGuard)  // Require auth + org context
export class ExampleController {

  // Only admins can access
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(@CurrentOrg() org: OrgContext) {
    // org.orgId - current organization ID
    // org.userId - current user ID
    // org.role - user's role in this org
  }

  // All authenticated users in org can access
  @Get()
  async findAll(@CurrentOrg() org: OrgContext) {
    // Automatically scoped to org.orgId
  }
}
```

### Tenant Isolation Pattern

**Critical:** All database queries MUST filter by `orgId` from `@CurrentOrg()`:

```typescript
// ✅ CORRECT - Tenant isolated
async findJournals(orgId: string) {
  return this.prisma.journalEntry.findMany({
    where: { orgId },  // Always filter by orgId
  });
}

// ❌ WRONG - Cross-tenant data leak!
async findJournals() {
  return this.prisma.journalEntry.findMany();
}
```

## Security Features

- ✅ Password hashing with bcrypt (10 rounds)
- ✅ JWT token expiration
- ✅ Refresh token rotation
- ✅ Tenant isolation enforcement at guard level
- ✅ Role-based access control
- ✅ Input validation with class-validator
- ✅ CORS configuration
- ✅ Global validation pipes

## Testing

Comprehensive test coverage for:
- Auth flows (register, login, refresh)
- Tenant isolation (cross-tenant access prevention)
- Role-based access control (RBAC)
- Guard behavior
- Service business logic

Run tests with: `npm test`

## Technical Stack

- **Framework:** NestJS 11
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** Passport.js + JWT
- **Validation:** class-validator + class-transformer
- **Testing:** Jest
- **Language:** TypeScript 5

## Notes for Other Workstreams

- **WS1 (Database):** Prisma schema is ready in `prisma/schema.prisma`. Add your models in the designated sections.
- **WS3 (Frontend):** API contracts and types are documented in `_HANDOFF.md`.
- **WS4 (Bank):** Use the same guard patterns for tenant isolation on your endpoints.

## License

Proprietary - OpenLedger Project
