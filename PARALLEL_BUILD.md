# Parallel Build Coordination Document

## Project: Sage Intacct Replacement (Codename: OpenLedger)

This document coordinates multiple Claude Code instances working on this project simultaneously without overlap.

---

## Directory Ownership Matrix

Each workstream owns specific directories. **DO NOT modify files outside your assigned directories** unless coordinating via the `_HANDOFF.md` file.

| Workstream | Owner Directories | Shared (Read-Only) |
|------------|-------------------|-------------------|
| **WS1: Database & Posting Engine** | `prisma/`, `backend/src/modules/posting/`, `backend/src/modules/ledger/`, `backend/src/common/` | `backend/src/app.module.ts` |
| **WS2: Auth & Tenant Infrastructure** | `backend/src/modules/auth/`, `backend/src/modules/org/`, `backend/src/modules/user/`, `backend/src/guards/`, `backend/src/decorators/` | `prisma/schema.prisma` (read) |
| **WS3: Frontend Foundation** | `src/app/`, `src/components/`, `src/lib/`, `src/hooks/` | `backend/` (read for API contracts) |
| **WS4: Bank & Reconciliation** | `backend/src/modules/bank/`, `backend/src/modules/plaid/`, `backend/src/modules/reconciliation/` | `prisma/schema.prisma` (read) |

---

## Shared Files Protocol

These files require coordination. Update `_HANDOFF.md` when modifying:

```
prisma/schema.prisma          → WS1 owns, others request additions via _HANDOFF.md
backend/src/app.module.ts     → Each WS adds own module import
docker-compose.yml            → WS1 owns initially, others may add services
.env.example                  → Any WS may add their env vars (prefix with WS#)
```

---

## API Contract Registry

All API endpoints must be registered here before implementation. Claim by adding your workstream ID.

### Auth & Users (WS2)
- [ ] `POST /auth/login` - WS2
- [ ] `POST /auth/register` - WS2
- [ ] `POST /auth/refresh` - WS2
- [ ] `GET /auth/me` - WS2
- [ ] `GET /orgs` - WS2
- [ ] `POST /orgs` - WS2
- [ ] `GET /orgs/:id` - WS2
- [ ] `PUT /orgs/:id/select` - WS2 (set current org context)

### Accounts & Dimensions (WS1)
- [ ] `GET /accounts` - WS1
- [ ] `POST /accounts` - WS1
- [ ] `PUT /accounts/:id` - WS1
- [ ] `GET /dimension-types` - WS1
- [ ] `POST /dimension-types` - WS1
- [ ] `GET /dimension-values` - WS1
- [ ] `POST /dimension-values` - WS1

### Journals & Posting (WS1)
- [ ] `GET /journal-types` - WS1
- [ ] `GET /journals` - WS1
- [ ] `POST /journals` - WS1
- [ ] `GET /journals/:id` - WS1
- [ ] `POST /journals/:id/post` - WS1
- [ ] `POST /journals/:id/reverse` - WS1

### Reports (WS1)
- [ ] `GET /reports/trial-balance` - WS1
- [ ] `GET /reports/balance-sheet` - WS1
- [ ] `GET /reports/profit-loss` - WS1
- [ ] `GET /reports/journal-listing` - WS1

### Bank & Plaid (WS4)
- [ ] `POST /plaid/link-token` - WS4
- [ ] `POST /plaid/exchange-token` - WS4
- [ ] `GET /plaid/accounts` - WS4
- [ ] `POST /plaid/sync` - WS4
- [ ] `GET /bank/transactions` - WS4
- [ ] `POST /bank/transactions/:id/categorize` - WS4
- [ ] `POST /bank/transactions/:id/create-journal` - WS4

### Reconciliation (WS4)
- [ ] `GET /reconciliation/sessions` - WS4
- [ ] `POST /reconciliation/sessions` - WS4
- [ ] `GET /reconciliation/sessions/:id` - WS4
- [ ] `POST /reconciliation/sessions/:id/match` - WS4
- [ ] `POST /reconciliation/sessions/:id/finalize` - WS4

### Periods (WS1)
- [ ] `GET /periods` - WS1
- [ ] `POST /periods/:id/close` - WS1
- [ ] `POST /periods/:id/reopen` - WS1

---

## Handoff File Protocol

When you need something from another workstream, add to `_HANDOFF.md`:

```markdown
## Request: [WS# → WS#]
**From:** WS1
**To:** WS2
**Need:** Org context decorator that extracts org_id from JWT
**Blocking:** Posting engine tenant isolation
**Status:** PENDING | IN_PROGRESS | DONE
```

---

## Type Definitions (Shared)

All workstreams should use these shared types. Create in `backend/src/common/types/`:

```typescript
// backend/src/common/types/index.ts

export interface OrgContext {
  orgId: string;
  userId: string;
  role: 'admin' | 'accountant' | 'viewer';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type Decimal = string; // Prisma Decimal serialized
```

---

## Database Schema Sections

WS1 owns schema.prisma but each WS is responsible for their section:

```prisma
// ========== WS2: Auth & Org ==========
// model Org { ... }
// model User { ... }
// model Role { ... }
// model UserRole { ... }

// ========== WS1: Chart of Accounts ==========
// model Account { ... }
// model DimensionType { ... }
// model DimensionValue { ... }
// model AccountRequiredDimension { ... }

// ========== WS1: Journals & Ledger ==========
// model JournalType { ... }
// model JournalBatch { ... }
// model JournalEntry { ... }
// model JournalLine { ... }
// model JournalLineDimension { ... }
// model LedgerPosting { ... }
// model AuditEvent { ... }

// ========== WS4: Bank & Reconciliation ==========
// model PlaidItem { ... }
// model PlaidAccount { ... }
// model SourceTransaction { ... }
// model SourceToJournalLine { ... }
// model ReconSession { ... }
// model ReconMatch { ... }
```

---

## Completion Checklist

### WS1: Database & Posting Engine
- [ ] Prisma schema complete
- [ ] Migrations generated
- [ ] Posting engine with balance validation
- [ ] Trial Balance endpoint
- [ ] Journal CRUD endpoints
- [ ] Dimension enforcement
- [ ] Period close logic
- [ ] Jest tests for posting

### WS2: Auth & Tenant Infrastructure
- [ ] NestJS project scaffolded
- [ ] JWT auth module
- [ ] User/Org/Role models
- [ ] RBAC guards
- [ ] Org context decorator
- [ ] Tenant isolation middleware
- [ ] Login/register endpoints
- [ ] Jest tests for auth

### WS3: Frontend Foundation
- [ ] Next.js app structure
- [ ] Auth pages (login)
- [ ] Org selector
- [ ] Dashboard layout
- [ ] Chart of Accounts page
- [ ] Journals page (list + create)
- [ ] Trial Balance page
- [ ] shadcn/ui components setup
- [ ] Playwright smoke test

### WS4: Bank & Reconciliation
- [ ] Plaid sandbox integration
- [ ] Bank account linking flow
- [ ] Transaction sync
- [ ] Transaction review UI endpoint
- [ ] Reconciliation session logic
- [ ] Match/unmatch logic
- [ ] Reconciliation history
- [ ] Jest tests for Plaid idempotency

---

## Communication Protocol

1. **Before starting:** Read this file and `_HANDOFF.md`
2. **Claim your directories:** Don't touch others' directories
3. **Need something from another WS?** Add to `_HANDOFF.md`
4. **Finished a component?** Update checklist above
5. **Breaking change to shared files?** Document in `_HANDOFF.md`

---

## Getting Started Commands

```bash
# WS1: After writing schema
cd backend && npx prisma migrate dev --name init

# WS2: Scaffold NestJS
npx @nestjs/cli new backend --skip-git --package-manager npm

# WS3: Frontend already exists, install shadcn
npx shadcn@latest init

# WS4: After WS1 schema is ready
# Implement your modules in backend/src/modules/bank/
```

---

## Environment Variables by Workstream

```env
# WS1 - Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/openledger

# WS2 - Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1d

# WS3 - Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001

# WS4 - Plaid
PLAID_CLIENT_ID=your-client-id
PLAID_SECRET=your-sandbox-secret
PLAID_ENV=sandbox
```

---

## File: _HANDOFF.md (Create separately)

This file tracks inter-workstream dependencies and requests.
