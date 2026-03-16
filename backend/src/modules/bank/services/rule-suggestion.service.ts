import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { RuleMatchType, SourceTransactionStatus } from '@prisma/client';

/**
 * Known merchant patterns mapped to expense categories
 * Used for AI-powered rule suggestions
 */
const MERCHANT_PATTERNS: Array<{
  patterns: string[];
  category: string;
  suggestedAccountTypes: string[];
  matchType: RuleMatchType;
}> = [
  // Gas Stations
  {
    patterns: ['shell', 'chevron', 'exxon', 'mobil', 'bp ', 'arco', 'conoco', '76 ', 'texaco', 'citgo', 'sinclair', 'marathon', 'valero', 'murphy usa', 'racetrac', 'quiktrip', 'wawa', 'sheetz', 'speedway', 'casey', 'pilot', 'flying j', 'love', 'ta ', 'petro'],
    category: 'Gas & Fuel',
    suggestedAccountTypes: ['6200', '6210', 'Auto', 'Vehicle', 'Gas', 'Fuel', 'Transportation'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Meals & Entertainment - Fast Food
  {
    patterns: ['mcdonald', 'burger king', 'wendy', 'taco bell', 'chick-fil-a', 'chickfila', 'chipotle', 'subway', 'five guys', 'panda express', 'panera', 'jimmy john', 'jersey mike', 'firehouse sub', 'popeye', 'kfc', 'arbys', 'sonic drive', 'jack in the box', 'carl\'s jr', 'hardee', 'dairy queen', 'whataburger', 'in-n-out', 'shake shack', 'culver', 'wingstop', 'buffalo wild wings', 'noodles', 'qdoba', 'el pollo loco', 'del taco', 'pizza hut', 'domino', 'papa john', 'little caesar'],
    category: 'Meals & Entertainment',
    suggestedAccountTypes: ['6300', '6310', 'Meals', 'Entertainment', 'Food', 'Dining'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Meals & Entertainment - Restaurants
  {
    patterns: ['restaurant', 'grill', 'steakhouse', 'bistro', 'cafe', 'diner', 'eatery', 'kitchen', 'tavern', 'pub ', 'bar & ', 'brewery', 'chophouse'],
    category: 'Meals & Entertainment',
    suggestedAccountTypes: ['6300', '6310', 'Meals', 'Entertainment', 'Food', 'Dining'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Coffee Shops
  {
    patterns: ['starbucks', 'dunkin', 'peet\'s coffee', 'caribou coffee', 'dutch bros', 'tim horton', 'coffee bean', 'blue bottle'],
    category: 'Meals & Entertainment',
    suggestedAccountTypes: ['6300', '6310', 'Meals', 'Entertainment', 'Coffee'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Grocery Stores
  {
    patterns: ['walmart', 'target', 'costco', 'sam\'s club', 'kroger', 'safeway', 'albertson', 'publix', 'aldi', 'trader joe', 'whole foods', 'h-e-b', 'heb ', 'wegman', 'food lion', 'giant eagle', 'meijer', 'winco', 'sprouts', 'harris teeter', 'stop & shop', 'shaw\'s', 'market basket', 'grocery outlet', 'food 4 less', 'smart & final'],
    category: 'Groceries',
    suggestedAccountTypes: ['5000', '5100', 'Supplies', 'Groceries', 'Food'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Pharmacies / Drug Stores
  {
    patterns: ['cvs', 'walgreens', 'rite aid', 'duane reade', 'pharmacy'],
    category: 'Medical & Pharmacy',
    suggestedAccountTypes: ['6400', 'Medical', 'Health', 'Pharmacy'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Office Supplies
  {
    patterns: ['office depot', 'staples', 'officemax', 'office supply'],
    category: 'Office Supplies',
    suggestedAccountTypes: ['6100', 'Office', 'Supplies'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Software & Technology
  {
    patterns: ['adobe', 'microsoft', 'google cloud', 'aws', 'amazon web services', 'digitalocean', 'heroku', 'github', 'gitlab', 'atlassian', 'jira', 'confluence', 'slack', 'zoom', 'dropbox', 'salesforce', 'hubspot', 'mailchimp', 'sendgrid', 'twilio', 'stripe fee', 'square fee', 'shopify', 'quickbooks', 'xero', 'freshbooks', 'gusto', 'rippling', 'notion', 'asana', 'monday.com', 'trello', 'figma', 'canva', 'openai', 'anthropic', 'vercel', 'netlify', 'cloudflare'],
    category: 'Software & Subscriptions',
    suggestedAccountTypes: ['6500', 'Software', 'Subscription', 'Technology', 'SaaS'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Shipping & Freight
  {
    patterns: ['usps', 'ups ', 'fedex', 'dhl', 'postal service', 'stamps.com', 'shipstation', 'pirate ship', 'easypost'],
    category: 'Shipping & Postage',
    suggestedAccountTypes: ['6150', 'Shipping', 'Postage', 'Freight'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Travel - Airlines
  {
    patterns: ['united airlines', 'american airlines', 'delta air', 'southwest', 'jetblue', 'alaska air', 'frontier', 'spirit air', 'hawaiian air', 'allegiant'],
    category: 'Travel - Airfare',
    suggestedAccountTypes: ['6250', 'Travel', 'Airfare'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Travel - Hotels
  {
    patterns: ['marriott', 'hilton', 'hyatt', 'ihg ', 'holiday inn', 'hampton inn', 'best western', 'wyndham', 'radisson', 'sheraton', 'westin', 'courtyard', 'fairfield inn', 'residence inn', 'springhill', 'la quinta', 'comfort inn', 'doubletree', 'embassy suite', 'homewood suite', 'airbnb', 'vrbo', 'booking.com', 'hotels.com', 'expedia'],
    category: 'Travel - Lodging',
    suggestedAccountTypes: ['6260', 'Travel', 'Lodging', 'Hotel'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Travel - Car Rental
  {
    patterns: ['hertz', 'enterprise rent', 'avis', 'budget rent', 'national car', 'alamo rent', 'sixt', 'dollar rent', 'thrifty', 'turo'],
    category: 'Travel - Car Rental',
    suggestedAccountTypes: ['6270', 'Travel', 'Car Rental', 'Auto'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Rideshare & Transportation
  {
    patterns: ['uber', 'lyft', 'taxi', 'cab '],
    category: 'Transportation',
    suggestedAccountTypes: ['6280', 'Transportation', 'Travel', 'Rideshare'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Utilities
  {
    patterns: ['electric', 'power company', 'energy', 'gas company', 'water bill', 'sewer', 'trash', 'waste management', 'republic services', 'comcast', 'xfinity', 'spectrum', 'at&t', 'verizon', 't-mobile', 'sprint', 'internet', 'broadband'],
    category: 'Utilities',
    suggestedAccountTypes: ['6600', 'Utilities', 'Electric', 'Phone'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Insurance
  {
    patterns: ['insurance', 'geico', 'progressive', 'state farm', 'allstate', 'liberty mutual', 'nationwide', 'farmers ins', 'usaa', 'travelers'],
    category: 'Insurance',
    suggestedAccountTypes: ['6700', 'Insurance'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Professional Services
  {
    patterns: ['attorney', 'lawyer', 'legal', 'accountant', 'cpa ', 'consultant', 'consulting'],
    category: 'Professional Services',
    suggestedAccountTypes: ['6800', 'Professional', 'Legal', 'Accounting', 'Consulting'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Hardware Stores
  {
    patterns: ['home depot', 'lowes', 'menards', 'ace hardware', 'true value', 'harbor freight'],
    category: 'Repairs & Maintenance',
    suggestedAccountTypes: ['6900', 'Repairs', 'Maintenance', 'Supplies'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Advertising & Marketing
  {
    patterns: ['facebook ads', 'meta ads', 'google ads', 'linkedin ads', 'twitter ads', 'tiktok ads', 'bing ads', 'advertising', 'marketing'],
    category: 'Advertising',
    suggestedAccountTypes: ['6050', 'Advertising', 'Marketing'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Parking
  {
    patterns: ['parking', 'parkwhiz', 'spothero', 'parkme'],
    category: 'Parking',
    suggestedAccountTypes: ['6220', 'Parking', 'Auto', 'Transportation'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Bank Fees
  {
    patterns: ['bank fee', 'service charge', 'monthly fee', 'overdraft', 'wire fee', 'atm fee'],
    category: 'Bank Fees',
    suggestedAccountTypes: ['6950', 'Bank', 'Fee', 'Charges'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
  // Payroll
  {
    patterns: ['payroll', 'gusto', 'adp', 'paychex', 'rippling', 'justworks'],
    category: 'Payroll',
    suggestedAccountTypes: ['6000', 'Payroll', 'Wages', 'Salaries'],
    matchType: RuleMatchType.CONTAINS_TEXT,
  },
];

export interface RuleSuggestion {
  transactionId: string;
  merchantName: string | null;
  transactionName: string;
  amount: number;
  suggestedCategory: string;
  suggestedAccountId: string | null;
  suggestedAccountCode: string | null;
  suggestedAccountName: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matchedPattern: string;
  suggestedRule: {
    name: string;
    matchType: RuleMatchType;
    pattern: string;
    autoPost: boolean;
  } | null;
  existingRule: {
    id: string;
    name: string;
  } | null;
}

@Injectable()
export class RuleSuggestionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Analyze transactions and suggest rules for unmatched ones
   */
  async getSuggestionsForTransactions(
    transactionIds: string[],
    orgId: string,
  ): Promise<RuleSuggestion[]> {
    const transactions = await this.prisma.sourceTransaction.findMany({
      where: {
        id: { in: transactionIds },
        orgId,
      },
    });

    // Get all GL accounts for the org to find best matches
    const accounts = await this.prisma.account.findMany({
      where: { orgId },
      select: { id: true, accountCode: true, title: true },
    });

    // Get existing rules to avoid suggesting duplicates
    const existingRules = await this.prisma.bankFeedRule.findMany({
      where: { orgId },
      select: { id: true, name: true, merchantPattern: true, descriptionPattern: true },
    });

    const suggestions: RuleSuggestion[] = [];

    for (const tx of transactions) {
      const suggestion = await this.analyzeTransaction(tx, accounts, existingRules);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Get suggestions for all unmatched transactions
   */
  async getSuggestionsForUnmatchedTransactions(
    orgId: string,
    limit: number = 50,
  ): Promise<RuleSuggestion[]> {
    const transactions = await this.prisma.sourceTransaction.findMany({
      where: {
        orgId,
        matchedRuleId: null,
        status: SourceTransactionStatus.PENDING,
      },
      take: limit,
      orderBy: { date: 'desc' },
    });

    const accounts = await this.prisma.account.findMany({
      where: { orgId },
      select: { id: true, accountCode: true, title: true },
    });

    const existingRules = await this.prisma.bankFeedRule.findMany({
      where: { orgId },
      select: { id: true, name: true, merchantPattern: true, descriptionPattern: true },
    });

    const suggestions: RuleSuggestion[] = [];

    for (const tx of transactions) {
      const suggestion = await this.analyzeTransaction(tx, accounts, existingRules);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Analyze a single transaction and suggest a rule
   */
  private async analyzeTransaction(
    tx: any,
    accounts: Array<{ id: string; accountCode: string; title: string }>,
    existingRules: Array<{ id: string; name: string; merchantPattern: string | null; descriptionPattern: string | null }>,
  ): Promise<RuleSuggestion | null> {
    const merchantName = tx.merchantName?.toLowerCase() || '';
    const transactionName = tx.name?.toLowerCase() || '';
    const searchText = `${merchantName} ${transactionName}`;

    // Find matching pattern
    let matchedPatternConfig: (typeof MERCHANT_PATTERNS)[0] | null = null;
    let matchedPattern: string = '';

    for (const patternConfig of MERCHANT_PATTERNS) {
      for (const pattern of patternConfig.patterns) {
        if (searchText.includes(pattern.toLowerCase())) {
          matchedPatternConfig = patternConfig;
          matchedPattern = pattern;
          break;
        }
      }
      if (matchedPatternConfig) break;
    }

    if (!matchedPatternConfig) {
      // Try Plaid categories if no merchant pattern matched
      // Handle category being a string, array, JSON string, or null
      let plaidCategories: string[] = [];
      if (tx.category) {
        if (Array.isArray(tx.category)) {
          plaidCategories = tx.category;
        } else if (typeof tx.category === 'string') {
          try {
            const parsed = JSON.parse(tx.category);
            plaidCategories = Array.isArray(parsed) ? parsed : [tx.category];
          } catch {
            plaidCategories = [tx.category];
          }
        }
      }

      if (plaidCategories.length > 0) {
        const categoryStr = plaidCategories.join(' > ');
        return {
          transactionId: tx.id,
          merchantName: tx.merchantName,
          transactionName: tx.name,
          amount: parseFloat(tx.amount.toString()),
          suggestedCategory: categoryStr,
          suggestedAccountId: null,
          suggestedAccountCode: null,
          suggestedAccountName: null,
          confidence: 'LOW',
          matchedPattern: `Plaid category: ${categoryStr}`,
          suggestedRule: null,
          existingRule: null,
        };
      }
      return null;
    }

    // Check if rule already exists for this pattern
    const existingRule = existingRules.find((rule) => {
      const rulePattern = (rule.merchantPattern || rule.descriptionPattern || '').toLowerCase();
      return rulePattern.includes(matchedPattern.toLowerCase()) || matchedPattern.toLowerCase().includes(rulePattern);
    });

    // Find best matching account
    const suggestedAccount = this.findBestAccount(accounts, matchedPatternConfig.suggestedAccountTypes);

    // Determine confidence based on match quality
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (merchantName && matchedPattern.length >= 4) {
      confidence = 'HIGH';
    } else if (matchedPattern.length < 3) {
      confidence = 'LOW';
    }

    // Generate suggested rule name
    const displayName = tx.merchantName || matchedPattern.charAt(0).toUpperCase() + matchedPattern.slice(1);
    const ruleName = `Auto: ${displayName} → ${matchedPatternConfig.category}`;

    return {
      transactionId: tx.id,
      merchantName: tx.merchantName,
      transactionName: tx.name,
      amount: parseFloat(tx.amount.toString()),
      suggestedCategory: matchedPatternConfig.category,
      suggestedAccountId: suggestedAccount?.id || null,
      suggestedAccountCode: suggestedAccount?.accountCode || null,
      suggestedAccountName: suggestedAccount?.title || null,
      confidence,
      matchedPattern,
      suggestedRule: existingRule ? null : {
        name: ruleName,
        matchType: matchedPatternConfig.matchType,
        pattern: matchedPattern,
        autoPost: confidence === 'HIGH',
      },
      existingRule: existingRule ? { id: existingRule.id, name: existingRule.name } : null,
    };
  }

  /**
   * Find the best matching account based on account types/keywords
   */
  private findBestAccount(
    accounts: Array<{ id: string; accountCode: string; title: string }>,
    suggestedTypes: string[],
  ): { id: string; accountCode: string; title: string } | null {
    // Try to match by account code prefix first
    for (const type of suggestedTypes) {
      if (/^\d+$/.test(type)) {
        const match = accounts.find((a) => a.accountCode.startsWith(type));
        if (match) return match;
      }
    }

    // Try to match by title keywords
    for (const type of suggestedTypes) {
      const keyword = type.toLowerCase();
      const match = accounts.find((a) => a.title.toLowerCase().includes(keyword));
      if (match) return match;
    }

    return null;
  }

  /**
   * Create a rule from a suggestion
   */
  async createRuleFromSuggestion(
    suggestion: RuleSuggestion,
    orgId: string,
    accountId?: string,
    autoPost?: boolean,
  ): Promise<any> {
    if (!suggestion.suggestedRule) {
      throw new Error('No suggested rule available for this transaction');
    }

    const targetAccountId = accountId || suggestion.suggestedAccountId;
    if (!targetAccountId) {
      throw new Error('No account specified for the rule');
    }

    // Find highest priority to set new rule priority higher
    const highestPriorityRule = await this.prisma.bankFeedRule.findFirst({
      where: { orgId },
      orderBy: { priority: 'desc' },
      select: { priority: true },
    });

    const newPriority = (highestPriorityRule?.priority || 0) + 10;

    return this.prisma.bankFeedRule.create({
      data: {
        orgId,
        name: suggestion.suggestedRule.name,
        matchType: suggestion.suggestedRule.matchType,
        descriptionPattern: suggestion.suggestedRule.pattern,
        assignToAccountId: targetAccountId,
        autoPost: autoPost ?? suggestion.suggestedRule.autoPost,
        priority: newPriority,
        isActive: true,
      },
    });
  }
}
