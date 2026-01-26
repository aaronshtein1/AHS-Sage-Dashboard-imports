# Sage Intacct FP&A Dashboard

A modern Financial Planning & Analysis (FP&A) dashboard with Sage Intacct integration, built for healthcare organizations. Features real-time financial reporting, location-based profitability analysis, payer mix analysis, headcount planning, and scenario modeling.

## Features

### Financial Statements
- **P&L Statement** - Full income statement with drill-down, budget vs actual comparison
- **Balance Sheet** - Point-in-time financial position
- **Cash Flow Statement** - Operating, investing, and financing activities

### Healthcare Analytics
- **Location P&L** - Profitability by clinic/office with gross margin analysis
- **Payer Mix Analysis** - Revenue breakdown by insurance contract with collection rates
- **Contract Analysis** - Reimbursement rates as % of Medicare

### Workforce Planning
- **Headcount Planning** - Budget vs actual FTE by position and department
- **Labor Cost Analysis** - Fully-loaded costs including benefits and payroll taxes
- **Staff Budgeting** - Clinical vs administrative staffing models

### Planning & Budgeting
- **Annual Budgets** - Create and manage operating budgets
- **Scenario Planning** - What-if analysis with assumption changes
- **Variance Analysis** - Budget vs actual with automated alerts

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **UI**: Tailwind CSS, shadcn/ui components, Recharts
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Integration**: Sage Intacct Web Services XML API

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Sage Intacct Web Services subscription

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd AHS-Sage-Dashboard-imports
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/sage_fpa"

INTACCT_SENDER_ID="your-sender-id"
INTACCT_SENDER_PASSWORD="your-sender-password"
INTACCT_COMPANY_ID="your-company-id"
INTACCT_USER_ID="your-user-id"
INTACCT_USER_PASSWORD="your-user-password"
```

4. Set up the database:
```bash
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Docker Deployment (Self-Hosted)

1. Copy the Docker environment file:
```bash
cp docker/.env.example docker/.env
```

2. Edit `docker/.env` with your credentials.

3. Build and run with Docker Compose:
```bash
cd docker
docker-compose up -d
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # Dashboard pages
│   │   ├── financials/    # P&L, Balance Sheet, Cash Flow
│   │   ├── healthcare/    # Location P&L, Payer Mix
│   │   ├── planning/      # Budget, Forecast, Scenarios
│   │   ├── workforce/     # Headcount, Labor Costs
│   │   └── settings/      # Intacct connection settings
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── charts/           # Chart components
│   ├── dashboard/        # Dashboard widgets
│   └── layout/           # Layout components
├── lib/                   # Utilities and services
│   ├── intacct/          # Sage Intacct API client
│   ├── reports/          # Report generation
│   └── utils/            # Helper functions
└── types/                # TypeScript types
```

## Sage Intacct API Integration

The dashboard integrates with Sage Intacct via their Web Services XML API:

- **GL Accounts**: Chart of accounts structure
- **Account Balances**: Period-end balances for reporting
- **GL Detail**: Transaction-level data for drill-down
- **Reporting Periods**: Fiscal periods for date selection
- **Budgets**: Budget headers and line items
- **Locations/Departments**: Dimension data for filtering

### Required Intacct Permissions

Your Web Services user needs read access to:
- General Ledger (accounts, balances, details)
- Reporting Periods
- Locations and Departments
- Budgets (if using budget features)

## Configuration

### Fiscal Year
Set your fiscal year start month in Settings > Preferences.

### Locations
The dashboard automatically syncs locations from Intacct. Configure your default location in Settings.

### Payer Contracts
Add payer contract information in the database to enable margin analysis by payer.

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Database Migrations
```bash
npx prisma migrate dev
```

### Generate Prisma Client
```bash
npx prisma generate
```

## License

Private - All rights reserved.
