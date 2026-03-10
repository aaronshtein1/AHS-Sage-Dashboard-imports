/**
 * Screenshot Capture Utility for ADP-to-Intacct Payroll Automation
 *
 * Features:
 * - Save screenshots to /screenshots/{timestamp}_{step}.png
 * - Capture on success and failure
 * - Include step name in filename
 * - Support for Playwright Page objects
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from './logger';

const logger = createLogger('screenshots');

// ==================== TYPES ====================

export interface ScreenshotOptions {
  /** Step name to include in filename */
  step: string;
  /** Whether this is a failure screenshot */
  isFailure?: boolean;
  /** Full page screenshot (vs viewport only) */
  fullPage?: boolean;
  /** Additional metadata to include in filename */
  metadata?: string;
  /** Custom directory (overrides default) */
  directory?: string;
}

export interface ScreenshotResult {
  /** Whether the screenshot was saved successfully */
  success: boolean;
  /** Full path to the saved screenshot */
  filePath: string;
  /** Filename only */
  filename: string;
  /** Timestamp when screenshot was taken */
  timestamp: Date;
  /** Step name */
  step: string;
  /** Error message if failed */
  error?: string;
}

export interface ScreenshotConfig {
  /** Base directory for screenshots */
  baseDir: string;
  /** File format */
  format: 'png' | 'jpeg';
  /** JPEG quality (1-100) */
  quality: number;
  /** Maximum screenshots to keep (0 = unlimited) */
  maxScreenshots: number;
  /** Enable/disable screenshot capture */
  enabled: boolean;
}

// ==================== CONSTANTS ====================

const DEFAULT_CONFIG: ScreenshotConfig = {
  baseDir: path.join(process.cwd(), 'screenshots'),
  format: 'png',
  quality: 80,
  maxScreenshots: 100,
  enabled: true,
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Sanitize a string for use in a filename
 */
function sanitizeFilename(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    .slice(0, 50);
}

/**
 * Format timestamp for filename
 */
function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}_${ms}`;
}

/**
 * Ensure directory exists
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ==================== SCREENSHOT MANAGER CLASS ====================

export class ScreenshotManager {
  private config: ScreenshotConfig;

  constructor(config: Partial<ScreenshotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Allow environment variable to disable screenshots
    if (process.env.DISABLE_SCREENSHOTS === 'true') {
      this.config.enabled = false;
    }

    // Ensure base directory exists
    if (this.config.enabled) {
      ensureDir(this.config.baseDir);
    }
  }

  /**
   * Generate a screenshot filename
   */
  generateFilename(options: ScreenshotOptions): string {
    const timestamp = formatTimestamp(new Date());
    const step = sanitizeFilename(options.step);
    const failure = options.isFailure ? '_FAILURE' : '';
    const metadata = options.metadata ? `_${sanitizeFilename(options.metadata)}` : '';

    return `${timestamp}_${step}${metadata}${failure}.${this.config.format}`;
  }

  /**
   * Get the full path for a screenshot
   */
  getFilePath(filename: string, directory?: string): string {
    const dir = directory || this.config.baseDir;
    ensureDir(dir);
    return path.join(dir, filename);
  }

  /**
   * Capture a screenshot from a Playwright page
   */
  async captureFromPage(
    page: { screenshot: (options: { path: string; fullPage?: boolean; type?: string; quality?: number }) => Promise<Buffer> },
    options: ScreenshotOptions
  ): Promise<ScreenshotResult> {
    const timestamp = new Date();

    if (!this.config.enabled) {
      logger.debug('Screenshots disabled, skipping capture', { step: options.step });
      return {
        success: false,
        filePath: '',
        filename: '',
        timestamp,
        step: options.step,
        error: 'Screenshots disabled',
      };
    }

    const filename = this.generateFilename(options);
    const filePath = this.getFilePath(filename, options.directory);

    try {
      await page.screenshot({
        path: filePath,
        fullPage: options.fullPage ?? false,
        type: this.config.format,
        ...(this.config.format === 'jpeg' && { quality: this.config.quality }),
      });

      logger.info(`Screenshot captured: ${filename}`, {
        step: options.step,
        isFailure: options.isFailure,
        path: filePath,
      });

      // Clean up old screenshots if max limit is set
      if (this.config.maxScreenshots > 0) {
        this.cleanupOldScreenshots();
      }

      return {
        success: true,
        filePath,
        filename,
        timestamp,
        step: options.step,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to capture screenshot', error as Error, { step: options.step });

      return {
        success: false,
        filePath,
        filename,
        timestamp,
        step: options.step,
        error: errorMessage,
      };
    }
  }

  /**
   * Save a buffer as a screenshot
   */
  async saveBuffer(buffer: Buffer, options: ScreenshotOptions): Promise<ScreenshotResult> {
    const timestamp = new Date();

    if (!this.config.enabled) {
      return {
        success: false,
        filePath: '',
        filename: '',
        timestamp,
        step: options.step,
        error: 'Screenshots disabled',
      };
    }

    const filename = this.generateFilename(options);
    const filePath = this.getFilePath(filename, options.directory);

    try {
      fs.writeFileSync(filePath, buffer);

      logger.info(`Screenshot saved: ${filename}`, {
        step: options.step,
        isFailure: options.isFailure,
      });

      return {
        success: true,
        filePath,
        filename,
        timestamp,
        step: options.step,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to save screenshot', error as Error);

      return {
        success: false,
        filePath,
        filename,
        timestamp,
        step: options.step,
        error: errorMessage,
      };
    }
  }

  /**
   * Clean up old screenshots to stay within limit
   */
  private cleanupOldScreenshots(): void {
    try {
      const files = fs
        .readdirSync(this.config.baseDir)
        .filter((f) => f.endsWith(`.${this.config.format}`))
        .map((f) => ({
          name: f,
          path: path.join(this.config.baseDir, f),
          time: fs.statSync(path.join(this.config.baseDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > this.config.maxScreenshots) {
        const toDelete = files.slice(this.config.maxScreenshots);
        for (const file of toDelete) {
          fs.unlinkSync(file.path);
          logger.debug(`Cleaned up old screenshot: ${file.name}`);
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup old screenshots', { error });
    }
  }

  /**
   * Get list of all screenshots
   */
  listScreenshots(): Array<{ filename: string; path: string; timestamp: Date }> {
    try {
      const files = fs
        .readdirSync(this.config.baseDir)
        .filter((f) => f.endsWith(`.${this.config.format}`))
        .map((f) => ({
          filename: f,
          path: path.join(this.config.baseDir, f),
          timestamp: fs.statSync(path.join(this.config.baseDir, f)).mtime,
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return files;
    } catch (error) {
      logger.error('Failed to list screenshots', error as Error);
      return [];
    }
  }

  /**
   * Delete all screenshots
   */
  clearAll(): number {
    try {
      const files = fs
        .readdirSync(this.config.baseDir)
        .filter((f) => f.endsWith(`.${this.config.format}`));

      for (const file of files) {
        fs.unlinkSync(path.join(this.config.baseDir, file));
      }

      logger.info(`Cleared ${files.length} screenshots`);
      return files.length;
    } catch (error) {
      logger.error('Failed to clear screenshots', error as Error);
      return 0;
    }
  }
}

// ==================== SINGLETON INSTANCE ====================

let screenshotManagerInstance: ScreenshotManager | null = null;

export function getScreenshotManager(config?: Partial<ScreenshotConfig>): ScreenshotManager {
  if (!screenshotManagerInstance) {
    screenshotManagerInstance = new ScreenshotManager(config);
  }
  return screenshotManagerInstance;
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Capture a screenshot from a Playwright page (convenience function)
 */
export async function captureScreenshot(
  page: { screenshot: (options: { path: string; fullPage?: boolean; type?: string; quality?: number }) => Promise<Buffer> },
  step: string,
  options?: Partial<ScreenshotOptions>
): Promise<ScreenshotResult> {
  const manager = getScreenshotManager();
  return manager.captureFromPage(page, { step, ...options });
}

/**
 * Capture a failure screenshot (convenience function)
 */
export async function captureFailureScreenshot(
  page: { screenshot: (options: { path: string; fullPage?: boolean; type?: string; quality?: number }) => Promise<Buffer> },
  step: string,
  errorContext?: string
): Promise<ScreenshotResult> {
  const manager = getScreenshotManager();
  return manager.captureFromPage(page, {
    step,
    isFailure: true,
    fullPage: true,
    metadata: errorContext,
  });
}

export default ScreenshotManager;
