/**
 * Chrome MCP Client
 *
 * This client communicates with a Chrome MCP server to automate
 * browser interactions with Sage Intacct.
 *
 * The MCP server should be running locally and expose endpoints for:
 * - Browser navigation
 * - Element interaction (click, type, select)
 * - Screenshot capture
 * - Page content extraction
 */

export interface MCPConfig {
  serverUrl: string;
  timeout?: number;
}

export interface MCPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  screenshot?: string;
}

export interface NavigateParams {
  url: string;
  waitForSelector?: string;
  timeout?: number;
  [key: string]: unknown;
}

export interface ClickParams {
  selector: string;
  waitForNavigation?: boolean;
  timeout?: number;
  [key: string]: unknown;
}

export interface TypeParams {
  selector: string;
  text: string;
  clearFirst?: boolean;
  delay?: number;
  [key: string]: unknown;
}

export interface SelectParams {
  selector: string;
  value: string;
  [key: string]: unknown;
}

export interface WaitParams {
  selector?: string;
  timeout?: number;
  state?: "visible" | "hidden" | "attached" | "detached";
  [key: string]: unknown;
}

export interface ExtractParams {
  selector: string;
  attribute?: string;
  multiple?: boolean;
  [key: string]: unknown;
}

export interface ScreenshotParams {
  fullPage?: boolean;
  selector?: string;
  [key: string]: unknown;
}

class ChromeMCPClient {
  private config: MCPConfig;
  private sessionId: string | null = null;

  constructor(config: MCPConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  private async callMCP<T>(
    tool: string,
    params: Record<string, unknown>
  ): Promise<MCPResponse<T>> {
    try {
      const response = await fetch(`${this.config.serverUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool,
          params: {
            ...params,
            sessionId: this.sessionId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP request failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Store session ID if returned
      if (result.sessionId) {
        this.sessionId = result.sessionId;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Initialize a new browser session
   */
  async initSession(): Promise<MCPResponse<{ sessionId: string }>> {
    const result = await this.callMCP<{ sessionId: string }>("browser_init", {
      headless: false, // We want to see the browser for debugging
    });

    if (result.success && result.data?.sessionId) {
      this.sessionId = result.data.sessionId;
    }

    return result;
  }

  /**
   * Navigate to a URL
   */
  async navigate(params: NavigateParams): Promise<MCPResponse> {
    return this.callMCP("browser_navigate", params);
  }

  /**
   * Click an element
   */
  async click(params: ClickParams): Promise<MCPResponse> {
    return this.callMCP("browser_click", params);
  }

  /**
   * Type text into an element
   */
  async type(params: TypeParams): Promise<MCPResponse> {
    return this.callMCP("browser_type", params);
  }

  /**
   * Select an option from a dropdown
   */
  async select(params: SelectParams): Promise<MCPResponse> {
    return this.callMCP("browser_select", params);
  }

  /**
   * Wait for an element or condition
   */
  async wait(params: WaitParams): Promise<MCPResponse> {
    return this.callMCP("browser_wait", params);
  }

  /**
   * Extract content from elements
   */
  async extract<T = string | string[]>(
    params: ExtractParams
  ): Promise<MCPResponse<T>> {
    return this.callMCP<T>("browser_extract", params);
  }

  /**
   * Take a screenshot
   */
  async screenshot(params?: ScreenshotParams): Promise<MCPResponse<{ base64: string }>> {
    return this.callMCP("browser_screenshot", params || {});
  }

  /**
   * Execute JavaScript in the page context
   */
  async evaluate<T>(script: string): Promise<MCPResponse<T>> {
    return this.callMCP<T>("browser_evaluate", { script });
  }

  /**
   * Get current page URL
   */
  async getUrl(): Promise<MCPResponse<{ url: string }>> {
    return this.callMCP("browser_get_url", {});
  }

  /**
   * Close the browser session
   */
  async close(): Promise<MCPResponse> {
    const result = await this.callMCP("browser_close", {});
    this.sessionId = null;
    return result;
  }

  /**
   * Check if we have an active session
   */
  hasSession(): boolean {
    return this.sessionId !== null;
  }
}

// Create a singleton instance
let mcpClient: ChromeMCPClient | null = null;

export function getMCPClient(): ChromeMCPClient {
  if (!mcpClient) {
    mcpClient = new ChromeMCPClient({
      serverUrl: process.env.CHROME_MCP_URL || "http://localhost:3001",
    });
  }
  return mcpClient;
}

export { ChromeMCPClient };
