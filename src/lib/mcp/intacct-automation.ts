/**
 * Sage Intacct Browser Automation
 *
 * Automates common tasks in Sage Intacct via Chrome MCP:
 * - Login
 * - Navigate to credit card configuration
 * - Create credit card templates
 * - Create matching rules
 */

import { getMCPClient, MCPResponse } from "./chrome-client";

export interface IntacctCredentials {
  companyId: string;
  userId: string;
  password: string;
}

export interface CreditCardTemplate {
  name: string;
  description?: string;
  bankAccountId: string;
  defaultGLAccount: string;
  defaultDepartment?: string;
  defaultLocation?: string;
}

export interface MatchingRule {
  name: string;
  description?: string;
  priority: number;
  conditions: MatchingCondition[];
  actions: MatchingAction[];
}

export interface MatchingCondition {
  field: "description" | "amount" | "vendor" | "date";
  operator: "contains" | "equals" | "startsWith" | "endsWith" | "regex" | "greaterThan" | "lessThan";
  value: string;
}

export interface MatchingAction {
  type: "setVendor" | "setGLAccount" | "setDepartment" | "setLocation" | "setClass" | "setMemo";
  value: string;
}

export interface AutomationResult {
  success: boolean;
  message: string;
  screenshot?: string;
  error?: string;
}

// Intacct URL patterns
const INTACCT_URLS = {
  login: "https://www.intacct.com/ia/acct/login.phtml",
  dashboard: "https://www.intacct.com/ia/acct/dashboard.phtml",
  cashManagement: "https://www.intacct.com/ia/acct/cm.phtml",
  creditCardConfig: "https://www.intacct.com/ia/acct/cm/creditcard_configuration.phtml",
  matchingRules: "https://www.intacct.com/ia/acct/cm/matching_rules.phtml",
};

// Selectors for Intacct UI elements
const SELECTORS = {
  login: {
    companyId: "#company",
    userId: "#login",
    password: "#passwd",
    submitButton: "#submitbtn",
    loginError: ".login-error, .error-message",
  },
  creditCard: {
    newTemplateButton: 'button[contains(text(), "New")]',
    templateNameInput: "#template_name",
    templateDescInput: "#template_description",
    bankAccountSelect: "#bank_account",
    defaultGLSelect: "#default_gl_account",
    defaultDeptSelect: "#default_department",
    defaultLocSelect: "#default_location",
    saveButton: "#save_button",
  },
  matchingRules: {
    newRuleButton: 'button[contains(text(), "Add Rule")]',
    ruleNameInput: "#rule_name",
    ruleDescInput: "#rule_description",
    priorityInput: "#rule_priority",
    addConditionButton: "#add_condition",
    conditionField: ".condition-field-select",
    conditionOperator: ".condition-operator-select",
    conditionValue: ".condition-value-input",
    addActionButton: "#add_action",
    actionType: ".action-type-select",
    actionValue: ".action-value-input",
    saveRuleButton: "#save_rule",
  },
};

class IntacctAutomation {
  private isLoggedIn = false;

  /**
   * Login to Sage Intacct
   */
  async login(credentials: IntacctCredentials): Promise<AutomationResult> {
    const mcp = getMCPClient();

    try {
      // Initialize browser session if not already
      if (!mcp.hasSession()) {
        const initResult = await mcp.initSession();
        if (!initResult.success) {
          return {
            success: false,
            message: "Failed to initialize browser session",
            error: initResult.error,
          };
        }
      }

      // Navigate to login page
      const navResult = await mcp.navigate({
        url: INTACCT_URLS.login,
        waitForSelector: SELECTORS.login.companyId,
        timeout: 30000,
      });

      if (!navResult.success) {
        return {
          success: false,
          message: "Failed to navigate to login page",
          error: navResult.error,
        };
      }

      // Enter company ID
      await mcp.type({
        selector: SELECTORS.login.companyId,
        text: credentials.companyId,
        clearFirst: true,
      });

      // Enter user ID
      await mcp.type({
        selector: SELECTORS.login.userId,
        text: credentials.userId,
        clearFirst: true,
      });

      // Enter password
      await mcp.type({
        selector: SELECTORS.login.password,
        text: credentials.password,
        clearFirst: true,
      });

      // Click login button
      await mcp.click({
        selector: SELECTORS.login.submitButton,
        waitForNavigation: true,
      });

      // Wait for dashboard or error
      await mcp.wait({
        timeout: 10000,
      });

      // Check if login was successful by looking for dashboard elements
      const urlResult = await mcp.getUrl();
      if (
        urlResult.success &&
        urlResult.data?.url?.includes("dashboard")
      ) {
        this.isLoggedIn = true;

        // Take a screenshot for confirmation
        const screenshot = await mcp.screenshot();

        return {
          success: true,
          message: "Successfully logged into Sage Intacct",
          screenshot: screenshot.data?.base64,
        };
      }

      // Check for error message
      const errorResult = await mcp.extract({
        selector: SELECTORS.login.loginError,
      });

      return {
        success: false,
        message: "Login failed",
        error: errorResult.data as string || "Invalid credentials or login error",
      };
    } catch (error) {
      return {
        success: false,
        message: "Login automation failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Navigate to Credit Card Configuration
   */
  async navigateToCreditCardConfig(): Promise<AutomationResult> {
    const mcp = getMCPClient();

    if (!this.isLoggedIn) {
      return {
        success: false,
        message: "Not logged in. Please login first.",
      };
    }

    try {
      // Navigate to Cash Management
      await mcp.navigate({
        url: INTACCT_URLS.cashManagement,
        timeout: 20000,
      });

      // Wait for page to load
      await mcp.wait({ timeout: 3000 });

      // Click on Credit Card Configuration menu item
      // The exact navigation depends on Intacct UI version
      await mcp.click({
        selector: 'a[href*="creditcard"], .menu-item:contains("Credit Card")',
      });

      await mcp.wait({ timeout: 3000 });

      const screenshot = await mcp.screenshot();

      return {
        success: true,
        message: "Navigated to Credit Card Configuration",
        screenshot: screenshot.data?.base64,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to navigate to Credit Card Configuration",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create a new credit card template
   */
  async createCreditCardTemplate(
    template: CreditCardTemplate
  ): Promise<AutomationResult> {
    const mcp = getMCPClient();

    if (!this.isLoggedIn) {
      return {
        success: false,
        message: "Not logged in. Please login first.",
      };
    }

    try {
      // Navigate to credit card config first
      await this.navigateToCreditCardConfig();

      // Click "New Template" button
      await mcp.click({
        selector: SELECTORS.creditCard.newTemplateButton,
      });

      await mcp.wait({ timeout: 2000 });

      // Fill in template details
      await mcp.type({
        selector: SELECTORS.creditCard.templateNameInput,
        text: template.name,
        clearFirst: true,
      });

      if (template.description) {
        await mcp.type({
          selector: SELECTORS.creditCard.templateDescInput,
          text: template.description,
          clearFirst: true,
        });
      }

      // Select bank account
      await mcp.select({
        selector: SELECTORS.creditCard.bankAccountSelect,
        value: template.bankAccountId,
      });

      // Select default GL account
      await mcp.select({
        selector: SELECTORS.creditCard.defaultGLSelect,
        value: template.defaultGLAccount,
      });

      // Select default department if provided
      if (template.defaultDepartment) {
        await mcp.select({
          selector: SELECTORS.creditCard.defaultDeptSelect,
          value: template.defaultDepartment,
        });
      }

      // Select default location if provided
      if (template.defaultLocation) {
        await mcp.select({
          selector: SELECTORS.creditCard.defaultLocSelect,
          value: template.defaultLocation,
        });
      }

      // Save template
      await mcp.click({
        selector: SELECTORS.creditCard.saveButton,
        waitForNavigation: true,
      });

      await mcp.wait({ timeout: 3000 });

      const screenshot = await mcp.screenshot();

      return {
        success: true,
        message: `Credit card template "${template.name}" created successfully`,
        screenshot: screenshot.data?.base64,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to create credit card template",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Navigate to Matching Rules configuration
   */
  async navigateToMatchingRules(): Promise<AutomationResult> {
    const mcp = getMCPClient();

    if (!this.isLoggedIn) {
      return {
        success: false,
        message: "Not logged in. Please login first.",
      };
    }

    try {
      // Navigate to matching rules page
      await mcp.navigate({
        url: INTACCT_URLS.matchingRules,
        timeout: 20000,
      });

      await mcp.wait({ timeout: 3000 });

      const screenshot = await mcp.screenshot();

      return {
        success: true,
        message: "Navigated to Matching Rules",
        screenshot: screenshot.data?.base64,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to navigate to Matching Rules",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create a new matching rule
   */
  async createMatchingRule(rule: MatchingRule): Promise<AutomationResult> {
    const mcp = getMCPClient();

    if (!this.isLoggedIn) {
      return {
        success: false,
        message: "Not logged in. Please login first.",
      };
    }

    try {
      // Navigate to matching rules first
      await this.navigateToMatchingRules();

      // Click "Add Rule" button
      await mcp.click({
        selector: SELECTORS.matchingRules.newRuleButton,
      });

      await mcp.wait({ timeout: 2000 });

      // Fill in rule name
      await mcp.type({
        selector: SELECTORS.matchingRules.ruleNameInput,
        text: rule.name,
        clearFirst: true,
      });

      // Fill in description
      if (rule.description) {
        await mcp.type({
          selector: SELECTORS.matchingRules.ruleDescInput,
          text: rule.description,
          clearFirst: true,
        });
      }

      // Set priority
      await mcp.type({
        selector: SELECTORS.matchingRules.priorityInput,
        text: rule.priority.toString(),
        clearFirst: true,
      });

      // Add conditions
      for (let i = 0; i < rule.conditions.length; i++) {
        const condition = rule.conditions[i];

        if (i > 0) {
          // Click "Add Condition" for additional conditions
          await mcp.click({
            selector: SELECTORS.matchingRules.addConditionButton,
          });
          await mcp.wait({ timeout: 1000 });
        }

        // Select field
        await mcp.select({
          selector: `${SELECTORS.matchingRules.conditionField}:nth-child(${i + 1})`,
          value: condition.field,
        });

        // Select operator
        await mcp.select({
          selector: `${SELECTORS.matchingRules.conditionOperator}:nth-child(${i + 1})`,
          value: condition.operator,
        });

        // Enter value
        await mcp.type({
          selector: `${SELECTORS.matchingRules.conditionValue}:nth-child(${i + 1})`,
          text: condition.value,
          clearFirst: true,
        });
      }

      // Add actions
      for (let i = 0; i < rule.actions.length; i++) {
        const action = rule.actions[i];

        if (i > 0) {
          // Click "Add Action" for additional actions
          await mcp.click({
            selector: SELECTORS.matchingRules.addActionButton,
          });
          await mcp.wait({ timeout: 1000 });
        }

        // Select action type
        await mcp.select({
          selector: `${SELECTORS.matchingRules.actionType}:nth-child(${i + 1})`,
          value: action.type,
        });

        // Enter action value
        await mcp.type({
          selector: `${SELECTORS.matchingRules.actionValue}:nth-child(${i + 1})`,
          text: action.value,
          clearFirst: true,
        });
      }

      // Save rule
      await mcp.click({
        selector: SELECTORS.matchingRules.saveRuleButton,
        waitForNavigation: true,
      });

      await mcp.wait({ timeout: 3000 });

      const screenshot = await mcp.screenshot();

      return {
        success: true,
        message: `Matching rule "${rule.name}" created successfully`,
        screenshot: screenshot.data?.base64,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to create matching rule",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Close the browser session
   */
  async close(): Promise<AutomationResult> {
    const mcp = getMCPClient();

    try {
      await mcp.close();
      this.isLoggedIn = false;

      return {
        success: true,
        message: "Browser session closed",
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to close browser session",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if currently logged in
   */
  isAuthenticated(): boolean {
    return this.isLoggedIn;
  }
}

// Export singleton instance
export const intacctAutomation = new IntacctAutomation();
