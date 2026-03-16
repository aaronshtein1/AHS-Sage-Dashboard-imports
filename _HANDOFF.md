# Inter-Workstream Handoff Tracker

## Active Requests

### Request: WS4 → WS1
**From:** WS4 (Bank)
**To:** WS1 (Database)
**Need:** Schema models for PlaidItem, PlaidAccount, SourceTransaction ready
**Blocking:** Plaid module implementation
**Status:** ✅ FULLY COMPLETE
**Note:** WS1 has added ALL required models and proper FK relations. Prisma client generated successfully.

### Request: WS3 → WS1
**From:** WS3 (Frontend)
**To:** WS1 (Database)
**Need:** Journal and Account API response shapes
**Blocking:** Journal creation form
**Status:** PENDING

---

## Completed Handoffs

### ✅ Request: WS3 → WS2
**From:** WS3 (Frontend)
**To:** WS2 (Auth)
**Need:** API contract for login response (JWT structure, user object shape)
**Blocking:** Login page implementation
**Status:** DONE
**Completed:** WS2 has implemented full auth infrastructure with API contracts documented below

### ✅ Request: WS4 → WS1
**From:** WS4 (Bank & Reconciliation)
**To:** WS1 (Database & Posting)
**Need:** Coordination on journal creation from bank transactions
**Status:** ✅ FULLY COMPLETE
**Completed:** WS1 has added all required models (Account, JournalEntry, JournalLine, JournalType, JournalBatch, Period, LedgerPosting, DimensionType, DimensionValue, AccountRequiredDimension, JournalLineDimension, AuditEvent) with proper FK relations to WS4 models. Prisma client regenerated successfully.

---

## Shared Type Definitions

When you define a type that others need, document it here:

```typescript
// ========== WS2: Auth & Tenant Types ==========
// Location: backend/src/common/types/index.ts

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    orgs: { id: string; name: string; role: string }[];
  };
}

interface JwtPayload {
  sub: string; // user id
  email: string;
  currentOrgId?: string; // selected org context
  iat?: number;
  exp?: number;
}

interface OrgContext {
  orgId: string;
  userId: string;
  role: 'admin' | 'accountant' | 'viewer';
}

// ========== WS1: Ledger Types ==========
// Location: backend/src/common/types/journal.types.ts

interface JournalEntryResponse {
  id: string;
  entryDate: string;
  postingDate: string | null;
  referenceNumber: string;
  description: string;
  status: 'draft' | 'posted';
  journalType: { code: string; name: string };
  lines: JournalLineResponse[];
  createdAt: string;
  postedAt: string | null;
  postedBy: string | null;
}
```

---

## Breaking Changes Log

| Date | WS | Change | Impact |
|------|-----|--------|--------|
| (start) | - | Initial setup | - |

---

## Notes

- WS1 should complete Prisma schema first - all other WS depend on it
- WS2 should provide auth guards before WS1/WS4 implement protected endpoints
- WS3 can stub API calls while waiting for backend endpoints

---

## WS2: Auth & Tenant Infrastructure - API Reference

### Completed Components

#### 1. Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user profile

#### 2. Organization Endpoints
- `GET /api/orgs` - List user's organizations
- `POST /api/orgs` - Create new organization
- `GET /api/orgs/:id` - Get organization details
- `PUT /api/orgs/:id/select` - Select organization context (updates JWT)

#### 3. User Endpoints
- `GET /api/users/profile` - Get user profile
- `GET /api/users/org-users` - List users in current org (requires TenantGuard)

### Guards & Decorators Available for Other Workstreams

#### Guards
```typescript
// backend/src/guards/jwt-auth.guard.ts
@UseGuards(JwtAuthGuard) // Requires valid JWT token

// backend/src/guards/tenant.guard.ts
@UseGuards(TenantGuard) // Enforces org context and membership

// backend/src/guards/roles.guard.ts
@UseGuards(RolesGuard) // Enforces role-based access
```

#### Decorators
```typescript
// backend/src/decorators/current-org.decorator.ts
@CurrentOrg() orgContext: OrgContext
// Returns { orgId, userId, role }

// backend/src/decorators/roles.decorator.ts
@Roles('admin', 'accountant')
// Specify required roles for endpoint
```

### Usage Example for Other Workstreams

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentOrg } from '../decorators/current-org.decorator';
import { OrgContext } from '../common/types';

@Controller('journals')
@UseGuards(JwtAuthGuard, TenantGuard) // All endpoints require auth + org context
export class JournalController {
  // Only admins and accountants can create journals
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
  async createJournal(
    @CurrentOrg() orgContext: OrgContext,
    @Body() createDto: CreateJournalDto,
  ) {
    // orgContext.orgId is automatically isolated to user's selected org
    // orgContext.role contains user's role in this org
    return this.journalService.create(orgContext.orgId, createDto);
  }

  // All roles can view journals
  @Get()
  async listJournals(@CurrentOrg() orgContext: OrgContext) {
    return this.journalService.findAll(orgContext.orgId);
  }
}
```

### Tenant Isolation Guarantee

All endpoints using `@CurrentOrg()` decorator are guaranteed to:
1. Have valid JWT authentication
2. Have selected organization context
3. Verify user belongs to the organization
4. Provide orgId for data filtering

**Important:** All database queries in WS1/WS4 MUST filter by `orgId` from `@CurrentOrg()` to ensure tenant isolation.

---

## WS4: Bank & Reconciliation - API Reference

### Completed Components

#### 1. Plaid Integration Endpoints
- `POST /api/plaid/link-token` - Create Plaid Link token for institution connection
- `POST /api/plaid/exchange-token` - Exchange public token for access token and store connection
- `GET /api/plaid/accounts` - List all linked Plaid accounts for organization
- `POST /api/plaid/sync` - Sync transactions from Plaid (supports incremental sync)

#### 2. Bank Transaction Endpoints
- `GET /api/bank/transactions` - List transactions with filters (status, date range, account)
- `POST /api/bank/transactions/:id/categorize` - Assign GL account and dimensions to transaction
- `POST /api/bank/transactions/:id/create-journal` - Generate journal entry from categorized transaction

#### 3. Reconciliation Endpoints
- `GET /api/reconciliation/sessions` - List reconciliation sessions (optionally filter by account)
- `POST /api/reconciliation/sessions` - Create new reconciliation session
- `GET /api/reconciliation/sessions/:id` - Get session details with unmatched items
- `POST /api/reconciliation/sessions/:id/match` - Create transaction matches
- `POST /api/reconciliation/sessions/:id/finalize` - Finalize and lock reconciliation session
- `DELETE /api/reconciliation/matches/:id` - Remove a match from draft session

### Key Features Implemented

#### Plaid Transaction Idempotency
- Unique constraint on `(orgId, plaidTransactionId)` prevents duplicate transactions
- Upsert logic ensures transactions are updated, not duplicated, on re-sync
- Tested with Jest tests confirming idempotency behavior

#### Bank Transaction Workflow
1. Link bank account via Plaid
2. Sync transactions automatically
3. Review transactions (uncategorized, categorized, journaled states)
4. Categorize transactions with GL account and dimensions
5. Create journal entries from categorized transactions
6. Journal entries automatically create debit/credit pairs (cash + expense/revenue)

#### Reconciliation Features
- Beginning balance defaults to prior session's ending balance
- Match transactions one-to-many or many-to-many
- Balance validation with 1 cent tolerance
- Cannot modify finalized sessions
- Track matched vs unmatched items

### Database Schema (Prisma)

WS4 models added to `prisma/schema.prisma`:
- `PlaidItem` - Plaid institution connections
- `PlaidAccount` - Bank accounts from Plaid
- `SourceTransaction` - Bank transactions (with idempotency on orgId + plaidTransactionId)
- `SourceToJournalLine` - Links source transactions to journal lines
- `ReconSession` - Reconciliation sessions
- `ReconMatch` - Transaction matches within reconciliation

### Testing

Jest tests implemented:
- `plaid.service.spec.ts` - Plaid transaction idempotency tests
- `reconciliation.service.spec.ts` - Reconciliation balance validation and workflow tests

All tests passing (12 total tests across both modules).

### Environment Variables

Added to `.env.example`:
```
PLAID_CLIENT_ID=your-client-id
PLAID_SECRET=your-sandbox-secret
PLAID_ENV=sandbox
```

### Integration Notes for Other Workstreams

**For WS1 (Database & Posting):**
- WS4 uses `JournalService.createJournalEntry()` to create journals from bank transactions
- ✅ WS1 has added all models with proper FK relations
- ✅ `SourceTransaction.accountId` → `Account`
- ✅ `SourceTransaction.journalEntryId` → `JournalEntry`
- ✅ `SourceToJournalLine.journalLineId` → `JournalLine`
- ✅ `ReconSession.accountId` → `Account`
- ✅ `ReconMatch.journalLineId` → `JournalLine`
- Run `npx prisma generate` in backend directory if needed

**For WS3 (Frontend):**
- All WS4 endpoints use `@CurrentOrg()` for tenant isolation
- All endpoints require `JwtAuthGuard` and `TenantGuard`
- Mutation endpoints (categorize, create-journal, reconciliation) require `admin` or `accountant` role
- Response types follow standard `PaginatedResponse<T>` pattern for list endpoints
