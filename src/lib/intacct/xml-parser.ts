/**
 * Sage Intacct XML Response Parser
 * Parses XML responses from the Intacct Web Services API
 */

import { parseStringPromise } from "xml2js";

export interface IntacctResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    detail?: string;
  };
  controlId?: string;
  totalCount?: number;
  numRemaining?: number;
}

export interface SessionData {
  sessionId: string;
  endpoint: string;
}

interface ParsedXml {
  response?: {
    control?: Array<{
      status?: string[];
      controlid?: string[];
    }>;
    operation?: Array<{
      authentication?: Array<{
        status?: string[];
        sessiontimeout?: string[];
      }>;
      result?: Array<{
        status?: string[];
        function?: string[];
        controlid?: string[];
        data?: Array<{
          $?: { listtype?: string; count?: string; totalcount?: string; numremaining?: string };
          api?: Array<{
            sessionid?: string[];
            endpoint?: string[];
          }>;
          [key: string]: unknown;
        }>;
        errormessage?: Array<{
          error?: Array<{
            errorno?: string[];
            description?: string[];
            description2?: string[];
            correction?: string[];
          }>;
        }>;
      }>;
    }>;
    errormessage?: Array<{
      error?: Array<{
        errorno?: string[];
        description?: string[];
        description2?: string[];
      }>;
    }>;
  };
}

export async function parseIntacctResponse<T>(
  xmlString: string
): Promise<IntacctResponse<T>> {
  try {
    const parsed: ParsedXml = await parseStringPromise(xmlString, {
      explicitArray: true,
      ignoreAttrs: false,
    });

    // Check for top-level errors
    if (parsed.response?.errormessage) {
      const errorMsg = parsed.response.errormessage[0];
      const error = errorMsg.error?.[0];
      return {
        success: false,
        error: {
          code: error?.errorno?.[0] || "UNKNOWN",
          message: error?.description?.[0] || "Unknown error",
          detail: error?.description2?.[0],
        },
      };
    }

    const operation = parsed.response?.operation?.[0];
    const result = operation?.result?.[0];

    if (!result) {
      return {
        success: false,
        error: {
          code: "NO_RESULT",
          message: "No result in response",
        },
      };
    }

    // Check result status
    if (result.status?.[0] !== "success") {
      const errorMsg = result.errormessage?.[0];
      const error = errorMsg?.error?.[0];
      return {
        success: false,
        error: {
          code: error?.errorno?.[0] || "OPERATION_FAILED",
          message: error?.description?.[0] || "Operation failed",
          detail: error?.description2?.[0] || error?.correction?.[0],
        },
        controlId: result.controlid?.[0],
      };
    }

    const data = result.data?.[0];
    const attrs = data?.$;

    return {
      success: true,
      data: data as T,
      controlId: result.controlid?.[0],
      totalCount: attrs?.totalcount ? parseInt(attrs.totalcount) : undefined,
      numRemaining: attrs?.numremaining ? parseInt(attrs.numremaining) : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: "PARSE_ERROR",
        message: "Failed to parse XML response",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export async function parseSessionResponse(
  xmlString: string
): Promise<IntacctResponse<SessionData>> {
  const response = await parseIntacctResponse<{
    api?: Array<{
      sessionid?: string[];
      endpoint?: string[];
    }>;
  }>(xmlString);

  if (!response.success || !response.data) {
    return response as IntacctResponse<SessionData>;
  }

  const api = response.data.api?.[0];
  if (!api?.sessionid?.[0] || !api?.endpoint?.[0]) {
    return {
      success: false,
      error: {
        code: "INVALID_SESSION",
        message: "Session data not found in response",
      },
    };
  }

  return {
    success: true,
    data: {
      sessionId: api.sessionid[0],
      endpoint: api.endpoint[0],
    },
  };
}

export function extractRecords<T>(
  data: Record<string, unknown>,
  objectName: string
): T[] {
  // Handle different response formats
  // Format 1: { GLACCOUNT: [{...}, {...}] }
  // Format 2: { glaccount: [{...}, {...}] }
  // Format 3: Direct array

  const key = Object.keys(data).find(
    (k) => k.toLowerCase() === objectName.toLowerCase() && k !== "$" && k !== "api"
  );

  if (key && Array.isArray(data[key])) {
    return (data[key] as Array<Record<string, unknown>>).map((record) =>
      flattenRecord(record)
    ) as T[];
  }

  // If no matching key, try to extract from root
  const records: T[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k !== "$" && k !== "api" && Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "object" && item !== null) {
          records.push(flattenRecord(item) as T);
        }
      }
    }
  }

  return records;
}

function flattenRecord(record: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === "$") continue; // Skip attributes

    if (Array.isArray(value) && value.length === 1) {
      // Single-element array - extract the value
      const val = value[0];
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        // Nested object - check if it's a simple value wrapper
        const keys = Object.keys(val);
        if (keys.length === 0) {
          flat[key] = "";
        } else if (keys.length === 1 && keys[0] === "_") {
          flat[key] = (val as Record<string, unknown>)["_"];
        } else {
          flat[key] = flattenRecord(val as Record<string, unknown>);
        }
      } else {
        flat[key] = val;
      }
    } else if (Array.isArray(value)) {
      flat[key] = value.map((v) =>
        typeof v === "object" && v !== null ? flattenRecord(v as Record<string, unknown>) : v
      );
    } else {
      flat[key] = value;
    }
  }

  return flat;
}

export function parseNumericField(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/,/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function parseBooleanField(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "t";
  }
  return false;
}
