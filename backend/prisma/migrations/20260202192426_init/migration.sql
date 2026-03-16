-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'accountant', 'viewer');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ClosingType" AS ENUM ('CLOSING', 'NON_CLOSING');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ACCOUNT_CREATED', 'ACCOUNT_UPDATED', 'JOURNAL_CREATED', 'JOURNAL_UPDATED', 'JOURNAL_POSTED', 'JOURNAL_REVERSED', 'PERIOD_CLOSED', 'PERIOD_REOPENED', 'RECONCILIATION_FINALIZED');

-- CreateTable
CREATE TABLE "orgs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "normal_balance" "NormalBalance" NOT NULL,
    "closing_type" "ClosingType" NOT NULL,
    "close_into_account_id" TEXT,
    "parent_account_id" TEXT,
    "category" TEXT,
    "disallow_direct_posting" BOOLEAN NOT NULL DEFAULT false,
    "is_bank_account" BOOLEAN NOT NULL DEFAULT false,
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "bank_routing_number" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_types" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_values" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "dimension_type_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_required_dimensions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "dimension_type_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_required_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periods" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_types" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system_type" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_batches" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "posted_at" TIMESTAMP(3),
    "posted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "journal_type_id" TEXT NOT NULL,
    "journal_batch_id" TEXT,
    "period_id" TEXT NOT NULL,
    "entry_number" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "posted_at" TIMESTAMP(3),
    "posted_by" TEXT,
    "reversed_at" TIMESTAMP(3),
    "reversed_by" TEXT,
    "reversal_entry_id" TEXT,
    "is_adjusting" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "account_id" TEXT NOT NULL,
    "description" TEXT,
    "debit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_line_dimensions" (
    "id" TEXT NOT NULL,
    "journal_line_id" TEXT NOT NULL,
    "dimension_type_id" TEXT NOT NULL,
    "dimension_value_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_line_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_postings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "posting_date" TIMESTAMP(3) NOT NULL,
    "debit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "running_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "previous_data" JSONB,
    "new_data" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaid_items" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "plaid_item_id" TEXT NOT NULL,
    "plaid_access_token" TEXT NOT NULL,
    "plaid_institution_id" TEXT NOT NULL,
    "plaid_institution_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaid_accounts" (
    "id" TEXT NOT NULL,
    "plaid_item_id" TEXT NOT NULL,
    "plaid_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "official_name" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "mask" TEXT,
    "current_balance" DECIMAL(19,4),
    "available_balance" DECIMAL(19,4),
    "iso_currency_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_transactions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "plaid_account_id" TEXT,
    "plaid_transaction_id" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "merchant_name" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "payment_channel" TEXT,
    "account_id" TEXT,
    "memo" TEXT,
    "categorized_at" TIMESTAMP(3),
    "categorized_by" TEXT,
    "journal_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_to_journal_lines" (
    "id" TEXT NOT NULL,
    "source_transaction_id" TEXT NOT NULL,
    "journal_line_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_to_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recon_sessions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "statement_beginning_balance" DECIMAL(19,4) NOT NULL,
    "statement_ending_balance" DECIMAL(19,4) NOT NULL,
    "statement_end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "finalized_at" TIMESTAMP(3),
    "finalized_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recon_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recon_matches" (
    "id" TEXT NOT NULL,
    "recon_session_id" TEXT NOT NULL,
    "source_transaction_id" TEXT,
    "journal_line_id" TEXT,
    "matchType" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recon_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_org_id_idx" ON "user_roles"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_org_id_key" ON "user_roles"("user_id", "org_id");

-- CreateIndex
CREATE INDEX "accounts_org_id_idx" ON "accounts"("org_id");

-- CreateIndex
CREATE INDEX "accounts_account_type_idx" ON "accounts"("account_type");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_org_id_account_code_key" ON "accounts"("org_id", "account_code");

-- CreateIndex
CREATE INDEX "dimension_types_org_id_idx" ON "dimension_types"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "dimension_types_org_id_code_key" ON "dimension_types"("org_id", "code");

-- CreateIndex
CREATE INDEX "dimension_values_org_id_idx" ON "dimension_values"("org_id");

-- CreateIndex
CREATE INDEX "dimension_values_dimension_type_id_idx" ON "dimension_values"("dimension_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "dimension_values_dimension_type_id_code_key" ON "dimension_values"("dimension_type_id", "code");

-- CreateIndex
CREATE INDEX "account_required_dimensions_account_id_idx" ON "account_required_dimensions"("account_id");

-- CreateIndex
CREATE INDEX "account_required_dimensions_dimension_type_id_idx" ON "account_required_dimensions"("dimension_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_required_dimensions_account_id_dimension_type_id_key" ON "account_required_dimensions"("account_id", "dimension_type_id");

-- CreateIndex
CREATE INDEX "periods_org_id_idx" ON "periods"("org_id");

-- CreateIndex
CREATE INDEX "periods_start_date_end_date_idx" ON "periods"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "periods_org_id_name_key" ON "periods"("org_id", "name");

-- CreateIndex
CREATE INDEX "journal_types_org_id_idx" ON "journal_types"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_types_org_id_code_key" ON "journal_types"("org_id", "code");

-- CreateIndex
CREATE INDEX "journal_batches_org_id_idx" ON "journal_batches"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_batches_org_id_batch_number_key" ON "journal_batches"("org_id", "batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversal_entry_id_key" ON "journal_entries"("reversal_entry_id");

-- CreateIndex
CREATE INDEX "journal_entries_org_id_idx" ON "journal_entries"("org_id");

-- CreateIndex
CREATE INDEX "journal_entries_journal_type_id_idx" ON "journal_entries"("journal_type_id");

-- CreateIndex
CREATE INDEX "journal_entries_period_id_idx" ON "journal_entries"("period_id");

-- CreateIndex
CREATE INDEX "journal_entries_entry_date_idx" ON "journal_entries"("entry_date");

-- CreateIndex
CREATE INDEX "journal_entries_status_idx" ON "journal_entries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_org_id_entry_number_key" ON "journal_entries"("org_id", "entry_number");

-- CreateIndex
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_lines_account_id_idx" ON "journal_lines"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_lines_journal_entry_id_line_number_key" ON "journal_lines"("journal_entry_id", "line_number");

-- CreateIndex
CREATE INDEX "journal_line_dimensions_journal_line_id_idx" ON "journal_line_dimensions"("journal_line_id");

-- CreateIndex
CREATE INDEX "journal_line_dimensions_dimension_value_id_idx" ON "journal_line_dimensions"("dimension_value_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_line_dimensions_journal_line_id_dimension_type_id_key" ON "journal_line_dimensions"("journal_line_id", "dimension_type_id");

-- CreateIndex
CREATE INDEX "ledger_postings_org_id_idx" ON "ledger_postings"("org_id");

-- CreateIndex
CREATE INDEX "ledger_postings_account_id_idx" ON "ledger_postings"("account_id");

-- CreateIndex
CREATE INDEX "ledger_postings_journal_entry_id_idx" ON "ledger_postings"("journal_entry_id");

-- CreateIndex
CREATE INDEX "ledger_postings_posting_date_idx" ON "ledger_postings"("posting_date");

-- CreateIndex
CREATE INDEX "audit_events_org_id_idx" ON "audit_events"("org_id");

-- CreateIndex
CREATE INDEX "audit_events_user_id_idx" ON "audit_events"("user_id");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_idx" ON "audit_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- CreateIndex
CREATE INDEX "plaid_items_org_id_idx" ON "plaid_items"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_items_org_id_plaid_item_id_key" ON "plaid_items"("org_id", "plaid_item_id");

-- CreateIndex
CREATE INDEX "plaid_accounts_plaid_item_id_idx" ON "plaid_accounts"("plaid_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_accounts_plaid_item_id_plaid_account_id_key" ON "plaid_accounts"("plaid_item_id", "plaid_account_id");

-- CreateIndex
CREATE INDEX "source_transactions_org_id_idx" ON "source_transactions"("org_id");

-- CreateIndex
CREATE INDEX "source_transactions_plaid_account_id_idx" ON "source_transactions"("plaid_account_id");

-- CreateIndex
CREATE INDEX "source_transactions_date_idx" ON "source_transactions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "source_transactions_org_id_plaid_transaction_id_key" ON "source_transactions"("org_id", "plaid_transaction_id");

-- CreateIndex
CREATE INDEX "source_to_journal_lines_source_transaction_id_idx" ON "source_to_journal_lines"("source_transaction_id");

-- CreateIndex
CREATE INDEX "source_to_journal_lines_journal_line_id_idx" ON "source_to_journal_lines"("journal_line_id");

-- CreateIndex
CREATE INDEX "recon_sessions_org_id_idx" ON "recon_sessions"("org_id");

-- CreateIndex
CREATE INDEX "recon_sessions_account_id_idx" ON "recon_sessions"("account_id");

-- CreateIndex
CREATE INDEX "recon_sessions_statement_end_date_idx" ON "recon_sessions"("statement_end_date");

-- CreateIndex
CREATE INDEX "recon_matches_recon_session_id_idx" ON "recon_matches"("recon_session_id");

-- CreateIndex
CREATE INDEX "recon_matches_source_transaction_id_idx" ON "recon_matches"("source_transaction_id");

-- CreateIndex
CREATE INDEX "recon_matches_journal_line_id_idx" ON "recon_matches"("journal_line_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_close_into_account_id_fkey" FOREIGN KEY ("close_into_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_values" ADD CONSTRAINT "dimension_values_dimension_type_id_fkey" FOREIGN KEY ("dimension_type_id") REFERENCES "dimension_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_required_dimensions" ADD CONSTRAINT "account_required_dimensions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_required_dimensions" ADD CONSTRAINT "account_required_dimensions_dimension_type_id_fkey" FOREIGN KEY ("dimension_type_id") REFERENCES "dimension_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_journal_type_id_fkey" FOREIGN KEY ("journal_type_id") REFERENCES "journal_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_journal_batch_id_fkey" FOREIGN KEY ("journal_batch_id") REFERENCES "journal_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_entry_id_fkey" FOREIGN KEY ("reversal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_line_dimensions" ADD CONSTRAINT "journal_line_dimensions_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "journal_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_line_dimensions" ADD CONSTRAINT "journal_line_dimensions_dimension_type_id_fkey" FOREIGN KEY ("dimension_type_id") REFERENCES "dimension_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_line_dimensions" ADD CONSTRAINT "journal_line_dimensions_dimension_value_id_fkey" FOREIGN KEY ("dimension_value_id") REFERENCES "dimension_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_accounts" ADD CONSTRAINT "plaid_accounts_plaid_item_id_fkey" FOREIGN KEY ("plaid_item_id") REFERENCES "plaid_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_transactions" ADD CONSTRAINT "source_transactions_plaid_account_id_fkey" FOREIGN KEY ("plaid_account_id") REFERENCES "plaid_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_transactions" ADD CONSTRAINT "source_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_transactions" ADD CONSTRAINT "source_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_to_journal_lines" ADD CONSTRAINT "source_to_journal_lines_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "source_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_to_journal_lines" ADD CONSTRAINT "source_to_journal_lines_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "journal_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recon_sessions" ADD CONSTRAINT "recon_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recon_matches" ADD CONSTRAINT "recon_matches_recon_session_id_fkey" FOREIGN KEY ("recon_session_id") REFERENCES "recon_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recon_matches" ADD CONSTRAINT "recon_matches_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "source_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recon_matches" ADD CONSTRAINT "recon_matches_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "journal_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
