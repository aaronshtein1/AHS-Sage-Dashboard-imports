/**
 * State Store for ADP-to-Intacct Payroll Automation
 * Uses SQLite (better-sqlite3) for local state management
 * Tracks processed entries for idempotent processing
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Types for payroll entries
export interface PayrollEntry {
  id: number;
  payrollDate: string;
  batchId: string;
  entryType: 'payroll' | 'taxes' | 'benefits' | 'deductions';
  downloadedFile: string | null;
  downloadedAt: string | null;
  transformedFile: string | null;
  uploadedAt: string | null;
  uploadStatus: 'pending' | 'uploaded' | 'failed' | 'skipped';
  intacctEntryId: string | null;
  errors: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadRecord {
  payrollDate: string;
  batchId: string;
  entryType: PayrollEntry['entryType'];
  downloadedFile: string;
}

export interface UploadRecord {
  batchId: string;
  transformedFile: string;
  intacctEntryId: string;
  uploadStatus: 'uploaded' | 'failed';
  errors?: string;
}

export interface StateStoreConfig {
  dbPath?: string;
}

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'payroll-state.db');

export class StateStore {
  private db: Database.Database;
  private dbPath: string;

  constructor(config: StateStoreConfig = {}) {
    this.dbPath = config.dbPath || DEFAULT_DB_PATH;

    // Ensure data directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payroll_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payroll_date TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('payroll', 'taxes', 'benefits', 'deductions')),
        downloaded_file TEXT,
        downloaded_at TEXT,
        transformed_file TEXT,
        uploaded_at TEXT,
        upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'failed', 'skipped')),
        intacct_entry_id TEXT,
        errors TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(batch_id, entry_type)
      );

      CREATE INDEX IF NOT EXISTS idx_payroll_date ON payroll_entries(payroll_date);
      CREATE INDEX IF NOT EXISTS idx_batch_id ON payroll_entries(batch_id);
      CREATE INDEX IF NOT EXISTS idx_upload_status ON payroll_entries(upload_status);

      CREATE TRIGGER IF NOT EXISTS update_timestamp
      AFTER UPDATE ON payroll_entries
      BEGIN
        UPDATE payroll_entries SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  }

  /**
   * Record a successful download from ADP
   */
  recordDownload(record: DownloadRecord): PayrollEntry {
    const stmt = this.db.prepare(`
      INSERT INTO payroll_entries (payroll_date, batch_id, entry_type, downloaded_file, downloaded_at, upload_status)
      VALUES (?, ?, ?, ?, datetime('now'), 'pending')
      ON CONFLICT(batch_id, entry_type) DO UPDATE SET
        downloaded_file = excluded.downloaded_file,
        downloaded_at = datetime('now'),
        updated_at = datetime('now')
      RETURNING *
    `);

    const row = stmt.get(
      record.payrollDate,
      record.batchId,
      record.entryType,
      record.downloadedFile
    ) as Record<string, unknown>;

    return this.mapRowToEntry(row);
  }

  /**
   * Record transformation of downloaded file
   */
  recordTransformation(batchId: string, entryType: PayrollEntry['entryType'], transformedFile: string): PayrollEntry | null {
    const stmt = this.db.prepare(`
      UPDATE payroll_entries
      SET transformed_file = ?, updated_at = datetime('now')
      WHERE batch_id = ? AND entry_type = ?
      RETURNING *
    `);

    const row = stmt.get(transformedFile, batchId, entryType) as Record<string, unknown> | undefined;
    return row ? this.mapRowToEntry(row) : null;
  }

  /**
   * Record a successful or failed upload to Intacct
   */
  recordUpload(record: UploadRecord): PayrollEntry | null {
    const stmt = this.db.prepare(`
      UPDATE payroll_entries
      SET
        uploaded_at = CASE WHEN ? = 'uploaded' THEN datetime('now') ELSE uploaded_at END,
        upload_status = ?,
        intacct_entry_id = ?,
        errors = ?,
        updated_at = datetime('now')
      WHERE batch_id = ?
      RETURNING *
    `);

    const row = stmt.get(
      record.uploadStatus,
      record.uploadStatus,
      record.intacctEntryId,
      record.errors || null,
      record.batchId
    ) as Record<string, unknown> | undefined;

    return row ? this.mapRowToEntry(row) : null;
  }

  /**
   * Check if an entry has already been uploaded (for idempotency)
   */
  isAlreadyUploaded(batchId: string, entryType?: PayrollEntry['entryType']): boolean {
    let stmt;
    let row;

    if (entryType) {
      stmt = this.db.prepare(`
        SELECT upload_status FROM payroll_entries
        WHERE batch_id = ? AND entry_type = ? AND upload_status = 'uploaded'
      `);
      row = stmt.get(batchId, entryType);
    } else {
      stmt = this.db.prepare(`
        SELECT upload_status FROM payroll_entries
        WHERE batch_id = ? AND upload_status = 'uploaded'
      `);
      row = stmt.get(batchId);
    }

    return !!row;
  }

  /**
   * Get all failed entries for retry
   */
  getFailedEntries(): PayrollEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM payroll_entries
      WHERE upload_status = 'failed'
      ORDER BY payroll_date DESC, created_at DESC
    `);

    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntry(row));
  }

  /**
   * Get entries pending upload
   */
  getPendingEntries(): PayrollEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM payroll_entries
      WHERE upload_status = 'pending' AND transformed_file IS NOT NULL
      ORDER BY payroll_date DESC, created_at DESC
    `);

    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntry(row));
  }

  /**
   * Mark an entry for re-upload (reset status to pending)
   */
  markForReupload(batchId: string, entryType?: PayrollEntry['entryType']): number {
    let stmt;
    let result;

    if (entryType) {
      stmt = this.db.prepare(`
        UPDATE payroll_entries
        SET upload_status = 'pending', errors = NULL, uploaded_at = NULL, intacct_entry_id = NULL, updated_at = datetime('now')
        WHERE batch_id = ? AND entry_type = ?
      `);
      result = stmt.run(batchId, entryType);
    } else {
      stmt = this.db.prepare(`
        UPDATE payroll_entries
        SET upload_status = 'pending', errors = NULL, uploaded_at = NULL, intacct_entry_id = NULL, updated_at = datetime('now')
        WHERE batch_id = ?
      `);
      result = stmt.run(batchId);
    }

    return result.changes;
  }

  /**
   * Force re-upload of an already uploaded entry
   */
  forceReupload(batchId: string): number {
    const stmt = this.db.prepare(`
      UPDATE payroll_entries
      SET upload_status = 'pending', uploaded_at = NULL, intacct_entry_id = NULL, updated_at = datetime('now')
      WHERE batch_id = ?
    `);

    const result = stmt.run(batchId);
    return result.changes;
  }

  /**
   * Get entry by batch ID
   */
  getEntryByBatchId(batchId: string, entryType?: PayrollEntry['entryType']): PayrollEntry | null {
    let stmt;
    let row;

    if (entryType) {
      stmt = this.db.prepare(`SELECT * FROM payroll_entries WHERE batch_id = ? AND entry_type = ?`);
      row = stmt.get(batchId, entryType) as Record<string, unknown> | undefined;
    } else {
      stmt = this.db.prepare(`SELECT * FROM payroll_entries WHERE batch_id = ?`);
      row = stmt.get(batchId) as Record<string, unknown> | undefined;
    }

    return row ? this.mapRowToEntry(row) : null;
  }

  /**
   * Get entries by payroll date
   */
  getEntriesByDate(payrollDate: string): PayrollEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM payroll_entries
      WHERE payroll_date = ?
      ORDER BY entry_type
    `);

    const rows = stmt.all(payrollDate) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntry(row));
  }

  /**
   * Get entries within a date range
   */
  getEntriesByDateRange(startDate: string, endDate: string): PayrollEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM payroll_entries
      WHERE payroll_date >= ? AND payroll_date <= ?
      ORDER BY payroll_date DESC, entry_type
    `);

    const rows = stmt.all(startDate, endDate) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntry(row));
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    total: number;
    pending: number;
    uploaded: number;
    failed: number;
    skipped: number;
  } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN upload_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN upload_status = 'uploaded' THEN 1 ELSE 0 END) as uploaded,
        SUM(CASE WHEN upload_status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN upload_status = 'skipped' THEN 1 ELSE 0 END) as skipped
      FROM payroll_entries
    `);

    const row = stmt.get() as Record<string, number>;
    return {
      total: row.total || 0,
      pending: row.pending || 0,
      uploaded: row.uploaded || 0,
      failed: row.failed || 0,
      skipped: row.skipped || 0,
    };
  }

  /**
   * Clear all entries (use with caution, mainly for testing)
   */
  clearAll(): void {
    this.db.exec('DELETE FROM payroll_entries');
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  private mapRowToEntry(row: Record<string, unknown>): PayrollEntry {
    return {
      id: row.id as number,
      payrollDate: row.payroll_date as string,
      batchId: row.batch_id as string,
      entryType: row.entry_type as PayrollEntry['entryType'],
      downloadedFile: row.downloaded_file as string | null,
      downloadedAt: row.downloaded_at as string | null,
      transformedFile: row.transformed_file as string | null,
      uploadedAt: row.uploaded_at as string | null,
      uploadStatus: row.upload_status as PayrollEntry['uploadStatus'],
      intacctEntryId: row.intacct_entry_id as string | null,
      errors: row.errors as string | null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

// Singleton instance
let stateStoreInstance: StateStore | null = null;

export function getStateStore(config?: StateStoreConfig): StateStore {
  if (!stateStoreInstance) {
    stateStoreInstance = new StateStore(config);
  }
  return stateStoreInstance;
}

export function closeStateStore(): void {
  if (stateStoreInstance) {
    stateStoreInstance.close();
    stateStoreInstance = null;
  }
}
