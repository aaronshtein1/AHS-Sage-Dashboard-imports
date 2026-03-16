# Bank Feeds API Documentation

## Overview

The Bank Feeds API provides endpoints for managing bank account connections, transaction imports, matching rules, and automated reconciliation. All endpoints require authentication via JWT token.

## Base URL

```
http://localhost:3020/api
```

## Authentication

All API requests require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Obtain Authentication Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

## Plaid Integration

### Initialize Plaid Link

Creates a link token for Plaid Link initialization.

```http
POST /api/plaid/link-token
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userId": "user_123"
}
```

**Response:**
```json
{
  "linkToken": "link-sandbox-a1b2c3d4-e5f6-1234-5678-90abcdef1234",
  "expiration": "2024-01-15T12:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Link token created successfully
- `401 Unauthorized` - Invalid or missing auth token
- `500 Internal Server Error` - Plaid API error

---

### Exchange Public Token

Exchanges a Plaid public token for an access token and imports accounts.

```http
POST /api/plaid/exchange
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "publicToken": "public-sandbox-abc123",
  "metadata": {
    "institution": {
      "name": "Chase",
      "institution_id": "ins_3"
    },
    "accounts": [
      {
        "id": "account_id_123",
        "name": "Plaid Checking",
        "type": "depository",
        "subtype": "checking"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "accounts": [
    {
      "id": "ba_456",
      "plaidAccountId": "account_id_123",
      "institutionName": "Chase",
      "accountName": "Plaid Checking",
      "accountType": "checking",
      "currentBalance": 1250.50,
      "availableBalance": 1250.50,
      "isoCurrencyCode": "USD",
      "lastSync": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Status Codes:**
- `201 Created` - Accounts imported successfully
- `400 Bad Request` - Invalid public token or metadata
- `401 Unauthorized` - Invalid auth token
- `500 Internal Server Error` - Exchange failed

---

### Sync Transactions

Fetches latest transactions from Plaid for connected accounts.

```http
POST /api/plaid/sync/{bankAccountId}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "transactionsAdded": 15,
  "transactionsModified": 2,
  "transactionsRemoved": 0,
  "cursor": "cursor_abc123xyz",
  "hasMore": false
}
```

**Status Codes:**
- `200 OK` - Sync completed successfully
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Bank account not found
- `500 Internal Server Error` - Sync failed

---

## Bank Accounts

### List Bank Accounts

Retrieves all connected bank accounts for the organization.

```http
GET /api/bank-accounts
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `disconnected`)
- `institutionName` (optional): Filter by institution name

**Response:**
```json
{
  "accounts": [
    {
      "id": "ba_123",
      "plaidAccountId": "acc_xyz789",
      "institutionName": "Chase",
      "accountName": "Business Checking",
      "accountType": "checking",
      "accountNumber": "****1234",
      "currentBalance": 25000.00,
      "availableBalance": 24500.00,
      "isoCurrencyCode": "USD",
      "lastSync": "2024-01-15T08:00:00Z",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Invalid auth token

---

### Get Bank Account Details

```http
GET /api/bank-accounts/{accountId}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "ba_123",
  "plaidAccountId": "acc_xyz789",
  "institutionName": "Chase",
  "accountName": "Business Checking",
  "accountType": "checking",
  "accountNumber": "****1234",
  "routingNumber": "*****6789",
  "currentBalance": 25000.00,
  "availableBalance": 24500.00,
  "isoCurrencyCode": "USD",
  "lastSync": "2024-01-15T08:00:00Z",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z",
  "syncHistory": [
    {
      "syncDate": "2024-01-15T08:00:00Z",
      "transactionsAdded": 5,
      "status": "success"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Account not found

---

### Disconnect Bank Account

```http
DELETE /api/bank-accounts/{accountId}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Bank account disconnected successfully"
}
```

**Status Codes:**
- `200 OK` - Disconnected successfully
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Account not found

---

## Source Transactions

### List Transactions

Retrieves source transactions with filtering and pagination.

```http
GET /api/source-transactions
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `status` (optional): Filter by status (`unmatched`, `matched`, `posted`, `ignored`)
- `bankAccountId` (optional): Filter by bank account
- `startDate` (optional): Filter by date range start (ISO 8601)
- `endDate` (optional): Filter by date range end (ISO 8601)
- `minAmount` (optional): Minimum amount filter
- `maxAmount` (optional): Maximum amount filter
- `search` (optional): Search in description or merchant name
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Example Request:**
```http
GET /api/source-transactions?status=unmatched&startDate=2024-01-01&limit=25
```

**Response:**
```json
{
  "transactions": [
    {
      "id": "st_789",
      "plaidTransactionId": "txn_abc123",
      "bankAccountId": "ba_123",
      "bankAccount": {
        "id": "ba_123",
        "institutionName": "Chase",
        "accountName": "Business Checking"
      },
      "date": "2024-01-15",
      "description": "AMAZON.COM*ABC123",
      "merchantName": "Amazon",
      "amount": -125.50,
      "category": ["Shops", "Computers and Electronics"],
      "pending": false,
      "status": "unmatched",
      "matchedJournalId": null,
      "matchedAccountId": null,
      "matchConfidence": null,
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-15T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "totalPages": 6,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Invalid auth token

---

### Get Transaction Details

```http
GET /api/source-transactions/{transactionId}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "st_789",
  "plaidTransactionId": "txn_abc123",
  "bankAccountId": "ba_123",
  "bankAccount": {
    "id": "ba_123",
    "institutionName": "Chase",
    "accountName": "Business Checking",
    "accountNumber": "****1234"
  },
  "date": "2024-01-15",
  "description": "AMAZON.COM*ABC123",
  "merchantName": "Amazon",
  "amount": -125.50,
  "category": ["Shops", "Computers and Electronics"],
  "pending": false,
  "status": "matched",
  "matchedJournalId": "je_456",
  "matchedAccountId": "acc_789",
  "matchedAccount": {
    "id": "acc_789",
    "accountNo": "6000",
    "title": "Office Supplies"
  },
  "matchConfidence": "HIGH",
  "matchedBy": "RULE",
  "matchRuleId": "rule_123",
  "dimensions": {
    "DEPT": "ADMIN",
    "LOC": "HQ"
  },
  "createdAt": "2024-01-15T09:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Transaction not found

---

### Match Transaction Manually

Manually match a source transaction to a GL account.

```http
POST /api/source-transactions/{transactionId}/match
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "accountId": "acc_789",
  "dimensions": {
    "DEPT": "ADMIN",
    "LOC": "HQ"
  },
  "notes": "Office supplies purchase"
}
```

**Response:**
```json
{
  "id": "st_789",
  "status": "matched",
  "matchedAccountId": "acc_789",
  "matchConfidence": "MANUAL",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Status Codes:**
- `200 OK` - Matched successfully
- `400 Bad Request` - Invalid account or dimensions
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Transaction not found
- `409 Conflict` - Transaction already posted

---

### Batch Match Transactions

Match multiple transactions at once.

```http
POST /api/source-transactions/batch-match
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "transactionIds": ["st_789", "st_790", "st_791"],
  "accountId": "acc_789",
  "dimensions": {
    "DEPT": "ADMIN"
  }
}
```

**Response:**
```json
{
  "success": true,
  "matched": 3,
  "failed": 0,
  "transactions": [
    {
      "id": "st_789",
      "status": "matched"
    },
    {
      "id": "st_790",
      "status": "matched"
    },
    {
      "id": "st_791",
      "status": "matched"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Batch operation completed
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Invalid auth token

---

### Post Transaction to Journal

Create a journal entry from a matched transaction.

```http
POST /api/source-transactions/{transactionId}/post
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "journalTypeId": "jt_123",
  "entryDate": "2024-01-15",
  "description": "Office supplies - Amazon"
}
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "id": "st_789",
    "status": "posted",
    "matchedJournalId": "je_456"
  },
  "journalEntry": {
    "id": "je_456",
    "referenceNumber": "BF-2024-001",
    "entryDate": "2024-01-15",
    "status": "posted"
  }
}
```

**Status Codes:**
- `201 Created` - Posted successfully
- `400 Bad Request` - Transaction not matched or invalid data
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Transaction not found

---

### Batch Post Transactions

Post multiple matched transactions to journals.

```http
POST /api/source-transactions/batch-post
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "transactionIds": ["st_789", "st_790"],
  "journalTypeId": "jt_123",
  "entryDate": "2024-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "posted": 2,
  "failed": 0,
  "results": [
    {
      "transactionId": "st_789",
      "journalId": "je_456",
      "status": "posted"
    },
    {
      "transactionId": "st_790",
      "journalId": "je_457",
      "status": "posted"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Batch operation completed
- `400 Bad Request` - Invalid request or unmatched transactions
- `401 Unauthorized` - Invalid auth token

---

### Update Transaction

Update transaction details (description, amount, etc.).

```http
PATCH /api/source-transactions/{transactionId}
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "description": "Updated description",
  "merchantName": "Updated merchant",
  "category": ["Updated", "Category"]
}
```

**Response:**
```json
{
  "id": "st_789",
  "description": "Updated description",
  "merchantName": "Updated merchant",
  "category": ["Updated", "Category"],
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Updated successfully
- `400 Bad Request` - Invalid data
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Transaction not found
- `409 Conflict` - Cannot update posted transaction

---

### Ignore Transaction

Mark a transaction as ignored (won't be matched or posted).

```http
POST /api/source-transactions/{transactionId}/ignore
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "st_789",
  "status": "ignored",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Ignored successfully
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Transaction not found

---

## Matching Rules

### List Matching Rules

Retrieves all bank feed matching rules for the organization.

```http
GET /api/bank-feed-rules
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `active` (optional): Filter by active status (`true`, `false`)
- `matchType` (optional): Filter by match type

**Response:**
```json
{
  "rules": [
    {
      "id": "rule_123",
      "name": "Amazon Purchases",
      "matchType": "CONTAINS_TEXT",
      "pattern": "AMAZON",
      "targetAccountId": "acc_789",
      "targetAccount": {
        "id": "acc_789",
        "accountNo": "6000",
        "title": "Office Supplies"
      },
      "dimensions": {
        "DEPT": "ADMIN"
      },
      "priority": 10,
      "autoPost": true,
      "minConfidence": "MEDIUM",
      "isActive": true,
      "matchCount": 45,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-10T00:00:00Z"
    }
  ],
  "total": 1
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Invalid auth token

---

### Create Matching Rule

Create a new bank feed matching rule.

```http
POST /api/bank-feed-rules
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Amazon Purchases",
  "matchType": "CONTAINS_TEXT",
  "pattern": "AMAZON",
  "targetAccountId": "acc_789",
  "dimensions": {
    "DEPT": "ADMIN",
    "LOC": "HQ"
  },
  "priority": 10,
  "autoPost": true,
  "minConfidence": "MEDIUM"
}
```

**Match Types:**
- `EXACT_MERCHANT` - Exact merchant name match (HIGH confidence)
- `CONTAINS_TEXT` - Description contains text (MEDIUM confidence)
- `REGEX_PATTERN` - Regex pattern match (MEDIUM confidence)
- `CATEGORY_MATCH` - Plaid category match (LOW confidence)
- `AMOUNT_RANGE` - Amount within range (LOW confidence)

**Request Fields:**
- `name` (required): Rule name
- `matchType` (required): Match algorithm type
- `pattern` (required): Match pattern (text, regex, or category)
- `targetAccountId` (required): Target GL account ID
- `dimensions` (optional): Dimension values to apply
- `priority` (optional): Rule priority (higher = checked first, default: 0)
- `autoPost` (optional): Auto-post high confidence matches (default: false)
- `minConfidence` (optional): Minimum confidence for match (default: MEDIUM)

**Response:**
```json
{
  "id": "rule_123",
  "name": "Amazon Purchases",
  "matchType": "CONTAINS_TEXT",
  "pattern": "AMAZON",
  "targetAccountId": "acc_789",
  "dimensions": {
    "DEPT": "ADMIN",
    "LOC": "HQ"
  },
  "priority": 10,
  "autoPost": true,
  "minConfidence": "MEDIUM",
  "isActive": true,
  "matchCount": 0,
  "createdAt": "2024-01-15T12:00:00Z"
}
```

**Status Codes:**
- `201 Created` - Rule created successfully
- `400 Bad Request` - Invalid data or pattern
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Target account not found

---

### Update Matching Rule

```http
PATCH /api/bank-feed-rules/{ruleId}
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Rule Name",
  "priority": 20,
  "isActive": false
}
```

**Response:**
```json
{
  "id": "rule_123",
  "name": "Updated Rule Name",
  "priority": 20,
  "isActive": false,
  "updatedAt": "2024-01-15T12:30:00Z"
}
```

**Status Codes:**
- `200 OK` - Updated successfully
- `400 Bad Request` - Invalid data
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Rule not found

---

### Delete Matching Rule

```http
DELETE /api/bank-feed-rules/{ruleId}
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Matching rule deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Deleted successfully
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Rule not found

---

### Test Matching Rule

Test a rule against existing unmatched transactions.

```http
POST /api/bank-feed-rules/{ruleId}/test
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "rule": {
    "id": "rule_123",
    "name": "Amazon Purchases"
  },
  "matchCount": 12,
  "transactions": [
    {
      "id": "st_789",
      "date": "2024-01-15",
      "description": "AMAZON.COM*ABC123",
      "amount": -125.50,
      "confidence": "MEDIUM"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Test completed
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Rule not found

---

### Run All Matching Rules

Apply all active matching rules to unmatched transactions.

```http
POST /api/bank-feed-rules/run
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "processed": 50,
  "matched": 35,
  "autoPosted": 12,
  "results": [
    {
      "ruleId": "rule_123",
      "ruleName": "Amazon Purchases",
      "matched": 12,
      "autoPosted": 8
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Matching completed
- `401 Unauthorized` - Invalid auth token

---

## Reconciliation

### Get Reconciliation Settings

```http
GET /api/reconciliation/settings
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "dateTolerance": 3,
  "strictAmountMatch": false,
  "similarityThreshold": 0.75,
  "autoMatchEnabled": true
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Invalid auth token

---

### Update Reconciliation Settings

```http
PUT /api/reconciliation/settings
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "dateTolerance": 5,
  "strictAmountMatch": true,
  "similarityThreshold": 0.8,
  "autoMatchEnabled": true
}
```

**Fields:**
- `dateTolerance`: Days tolerance for date matching (1-7)
- `strictAmountMatch`: Require exact amount match (no tolerance)
- `similarityThreshold`: Description similarity threshold (0.0-1.0)
- `autoMatchEnabled`: Enable automatic matching

**Response:**
```json
{
  "dateTolerance": 5,
  "strictAmountMatch": true,
  "similarityThreshold": 0.8,
  "autoMatchEnabled": true,
  "updatedAt": "2024-01-15T13:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Updated successfully
- `400 Bad Request` - Invalid settings
- `401 Unauthorized` - Invalid auth token

---

### Run Auto-Match

Run automatic reconciliation matching.

```http
POST /api/reconciliation/auto-match
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "bankAccountId": "ba_123",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

**Response:**
```json
{
  "success": true,
  "processed": 100,
  "matched": 45,
  "suggestions": [
    {
      "transactionId": "st_789",
      "journalLineId": "jl_456",
      "confidence": 0.95,
      "reasons": [
        "Exact amount match",
        "Date within tolerance (1 day)",
        "Description similarity: 0.88"
      ]
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Auto-match completed
- `400 Bad Request` - Invalid date range or account
- `401 Unauthorized` - Invalid auth token

---

### Accept Match Suggestion

Accept an auto-match suggestion.

```http
POST /api/reconciliation/suggestions/{suggestionId}/accept
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "transactionId": "st_789",
  "journalLineId": "jl_456",
  "status": "matched"
}
```

**Status Codes:**
- `200 OK` - Suggestion accepted
- `401 Unauthorized` - Invalid auth token
- `404 Not Found` - Suggestion not found

---

## Import/Export

### Import Transactions from CSV

```http
POST /api/source-transactions/import
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

{
  "file": <CSV file>,
  "bankAccountId": "ba_123",
  "dateColumn": "Date",
  "descriptionColumn": "Description",
  "amountColumn": "Amount",
  "dateFormat": "YYYY-MM-DD"
}
```

**CSV Format Example:**
```csv
Date,Description,Amount,Type
2024-01-15,Amazon Purchase,-125.50,debit
2024-01-16,Client Payment,1500.00,credit
```

**Response:**
```json
{
  "success": true,
  "imported": 45,
  "duplicates": 5,
  "errors": 0,
  "transactions": [
    {
      "id": "st_800",
      "date": "2024-01-15",
      "description": "Amazon Purchase",
      "amount": -125.50
    }
  ]
}
```

**Status Codes:**
- `201 Created` - Import completed
- `400 Bad Request` - Invalid CSV format or mapping
- `401 Unauthorized` - Invalid auth token

---

### Export Transactions to CSV

```http
GET /api/source-transactions/export
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- Same as List Transactions endpoint

**Response:**
```csv
Date,Description,Merchant,Amount,Status,Account,Reference
2024-01-15,AMAZON.COM*ABC123,Amazon,-125.50,posted,6000 - Office Supplies,BF-2024-001
```

**Status Codes:**
- `200 OK` - Export successful
- `401 Unauthorized` - Invalid auth token

---

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` - Invalid or missing authentication token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Requested resource not found
- `VALIDATION_ERROR` - Invalid request data
- `DUPLICATE` - Resource already exists
- `CONFLICT` - Operation conflicts with current state
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

---

## Rate Limiting

API requests are rate limited:

- **Authenticated requests**: 1000 requests per hour per user
- **Plaid sync operations**: 10 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1610784000
```

---

## Webhooks

### Plaid Webhooks

Plaid sends webhooks to:
```
POST /api/plaid/webhook
```

**Webhook Types:**
- `TRANSACTIONS` - New transactions available
- `ITEM_ERROR` - Connection issue with bank account
- `PENDING_EXPIRATION` - Access token expiring soon

**Example Payload:**
```json
{
  "webhook_type": "TRANSACTIONS",
  "webhook_code": "DEFAULT_UPDATE",
  "item_id": "item_abc123",
  "new_transactions": 5
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Initialize API client
const api = new BankFeedsAPI({
  baseURL: 'http://localhost:3020/api',
  token: 'your-jwt-token'
});

// List unmatched transactions
const transactions = await api.sourceTransactions.list({
  status: 'unmatched',
  limit: 50
});

// Match a transaction
await api.sourceTransactions.match('st_789', {
  accountId: 'acc_789',
  dimensions: { DEPT: 'ADMIN' }
});

// Post to journal
await api.sourceTransactions.post('st_789', {
  journalTypeId: 'jt_123',
  entryDate: '2024-01-15'
});
```

### cURL Examples

```bash
# List transactions
curl -X GET "http://localhost:3020/api/source-transactions?status=unmatched" \
  -H "Authorization: Bearer your-jwt-token"

# Match transaction
curl -X POST "http://localhost:3020/api/source-transactions/st_789/match" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"acc_789","dimensions":{"DEPT":"ADMIN"}}'

# Post to journal
curl -X POST "http://localhost:3020/api/source-transactions/st_789/post" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"journalTypeId":"jt_123","entryDate":"2024-01-15"}'
```

---

## Support

For questions or issues with the Bank Feeds API:

- Documentation: `/docs`
- Support: support@example.com
- GitHub Issues: https://github.com/your-org/your-repo/issues
