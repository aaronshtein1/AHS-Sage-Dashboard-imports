-- CreateEnum
CREATE TYPE "SourceTransactionStatus" AS ENUM ('PENDING', 'MATCHED', 'CATEGORIZED', 'POSTED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "RuleMatchType" AS ENUM ('EXACT_MERCHANT', 'CONTAINS_TEXT', 'REGEX_PATTERN', 'AMOUNT_RANGE', 'CATEGORY_MATCH', 'COMBINED');

-- CreateEnum
CREATE TYPE "MatchConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "source_transactions" ADD COLUMN     "match_confidence" "MatchConfidence",
ADD COLUMN     "matched_rule_id" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_user_id" TEXT,
ADD COLUMN     "status" "SourceTransactionStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "bank_feed_rules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "match_type" "RuleMatchType" NOT NULL,
    "merchant_pattern" TEXT,
    "description_pattern" TEXT,
    "category_patterns" TEXT[],
    "amount_min" DECIMAL(19,4),
    "amount_max" DECIMAL(19,4),
    "assign_to_account_id" TEXT NOT NULL,
    "default_memo" TEXT,
    "auto_post" BOOLEAN NOT NULL DEFAULT false,
    "dimension_values" TEXT,
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "last_matched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_feed_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account_mappings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "plaid_account_id" TEXT NOT NULL,
    "gl_account_id" TEXT NOT NULL,
    "enable_auto_posting" BOOLEAN NOT NULL DEFAULT false,
    "default_offset_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_matches" (
    "id" TEXT NOT NULL,
    "source_transaction_id" TEXT NOT NULL,
    "suggested_account_id" TEXT NOT NULL,
    "confidence" "MatchConfidence" NOT NULL,
    "match_reason" TEXT NOT NULL,
    "rule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_feed_rules_org_id_idx" ON "bank_feed_rules"("org_id");

-- CreateIndex
CREATE INDEX "bank_feed_rules_org_id_is_active_idx" ON "bank_feed_rules"("org_id", "is_active");

-- CreateIndex
CREATE INDEX "bank_feed_rules_org_id_priority_idx" ON "bank_feed_rules"("org_id", "priority");

-- CreateIndex
CREATE INDEX "bank_account_mappings_org_id_idx" ON "bank_account_mappings"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_account_mappings_org_id_plaid_account_id_key" ON "bank_account_mappings"("org_id", "plaid_account_id");

-- CreateIndex
CREATE INDEX "transaction_matches_source_transaction_id_idx" ON "transaction_matches"("source_transaction_id");

-- CreateIndex
CREATE INDEX "source_transactions_org_id_status_idx" ON "source_transactions"("org_id", "status");

-- CreateIndex
CREATE INDEX "source_transactions_matched_rule_id_idx" ON "source_transactions"("matched_rule_id");

-- AddForeignKey
ALTER TABLE "source_transactions" ADD CONSTRAINT "source_transactions_matched_rule_id_fkey" FOREIGN KEY ("matched_rule_id") REFERENCES "bank_feed_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_feed_rules" ADD CONSTRAINT "bank_feed_rules_assign_to_account_id_fkey" FOREIGN KEY ("assign_to_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_mappings" ADD CONSTRAINT "bank_account_mappings_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_mappings" ADD CONSTRAINT "bank_account_mappings_default_offset_account_id_fkey" FOREIGN KEY ("default_offset_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_matches" ADD CONSTRAINT "transaction_matches_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "source_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_matches" ADD CONSTRAINT "transaction_matches_suggested_account_id_fkey" FOREIGN KEY ("suggested_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
