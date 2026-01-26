/**
 * Sage Intacct XML Request Builder
 * Builds properly formatted XML requests for the Intacct Web Services API
 */

export interface IntacctCredentials {
  senderId: string;
  senderPassword: string;
  companyId: string;
  userId: string;
  userPassword: string;
  sessionId?: string;
}

export interface QueryOptions {
  object: string;
  fields?: string[];
  filters?: QueryFilter[];
  orderBy?: { field: string; descending?: boolean }[];
  pageSize?: number;
  offset?: number;
}

export interface QueryFilter {
  field: string;
  operator: "=" | "!=" | "<" | "<=" | ">" | ">=" | "like" | "in" | "between";
  value: string | string[] | number | number[];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildControlBlock(credentials: IntacctCredentials, controlId?: string): string {
  const id = controlId || `ctrl-${Date.now()}`;
  return `
    <control>
      <senderid>${escapeXml(credentials.senderId)}</senderid>
      <password>${escapeXml(credentials.senderPassword)}</password>
      <controlid>${escapeXml(id)}</controlid>
      <uniqueid>false</uniqueid>
      <dtdversion>3.0</dtdversion>
      <includewhitespace>false</includewhitespace>
    </control>
  `;
}

function buildAuthenticationBlock(credentials: IntacctCredentials): string {
  if (credentials.sessionId) {
    return `
      <authentication>
        <sessionid>${escapeXml(credentials.sessionId)}</sessionid>
      </authentication>
    `;
  }

  return `
    <authentication>
      <login>
        <userid>${escapeXml(credentials.userId)}</userid>
        <companyid>${escapeXml(credentials.companyId)}</companyid>
        <password>${escapeXml(credentials.userPassword)}</password>
      </login>
    </authentication>
  `;
}

function buildFilterExpression(filters: QueryFilter[]): string {
  if (filters.length === 0) return "";

  const filterXml = filters
    .map((filter) => {
      const { field, operator, value } = filter;

      switch (operator) {
        case "=":
          return `<equalto><field>${field}</field><value>${escapeXml(String(value))}</value></equalto>`;
        case "!=":
          return `<notequalto><field>${field}</field><value>${escapeXml(String(value))}</value></notequalto>`;
        case "<":
          return `<lessthan><field>${field}</field><value>${escapeXml(String(value))}</value></lessthan>`;
        case "<=":
          return `<lessthanorequalto><field>${field}</field><value>${escapeXml(String(value))}</value></lessthanorequalto>`;
        case ">":
          return `<greaterthan><field>${field}</field><value>${escapeXml(String(value))}</value></greaterthan>`;
        case ">=":
          return `<greaterthanorequalto><field>${field}</field><value>${escapeXml(String(value))}</value></greaterthanorequalto>`;
        case "like":
          return `<like><field>${field}</field><value>${escapeXml(String(value))}</value></like>`;
        case "in":
          const values = Array.isArray(value) ? value : [value];
          const inValues = values.map((v) => `<value>${escapeXml(String(v))}</value>`).join("");
          return `<in><field>${field}</field>${inValues}</in>`;
        case "between":
          const [min, max] = value as [string | number, string | number];
          return `<between><field>${field}</field><value>${escapeXml(String(min))}</value><value>${escapeXml(String(max))}</value></between>`;
        default:
          return "";
      }
    })
    .join("");

  if (filters.length === 1) {
    return `<filter>${filterXml}</filter>`;
  }

  return `<filter><and>${filterXml}</and></filter>`;
}

export function buildGetApiSessionRequest(credentials: IntacctCredentials): string {
  const control = buildControlBlock(credentials);
  const auth = buildAuthenticationBlock(credentials);

  return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  ${control}
  <operation>
    ${auth}
    <content>
      <function controlid="getSession">
        <getAPISession />
      </function>
    </content>
  </operation>
</request>`;
}

export function buildQueryRequest(
  credentials: IntacctCredentials,
  options: QueryOptions
): string {
  const control = buildControlBlock(credentials);
  const auth = buildAuthenticationBlock(credentials);

  const fields = options.fields?.join(", ") || "*";
  const filter = options.filters ? buildFilterExpression(options.filters) : "";
  const pageSize = options.pageSize || 1000;
  const offset = options.offset || 0;

  const orderBy = options.orderBy
    ?.map((o) => `<order><field>${o.field}</field>${o.descending ? "<descending />" : "<ascending />"}</order>`)
    .join("") || "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  ${control}
  <operation>
    ${auth}
    <content>
      <function controlid="query-${options.object}">
        <query>
          <object>${options.object}</object>
          <select>
            ${fields.split(",").map((f) => `<field>${f.trim()}</field>`).join("")}
          </select>
          ${filter}
          ${orderBy ? `<orderby>${orderBy}</orderby>` : ""}
          <pagesize>${pageSize}</pagesize>
          <offset>${offset}</offset>
        </query>
      </function>
    </content>
  </operation>
</request>`;
}

export function buildReadByQueryRequest(
  credentials: IntacctCredentials,
  object: string,
  query: string,
  fields: string[] = ["*"],
  pageSize: number = 1000
): string {
  const control = buildControlBlock(credentials);
  const auth = buildAuthenticationBlock(credentials);

  return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  ${control}
  <operation>
    ${auth}
    <content>
      <function controlid="readByQuery-${object}">
        <readByQuery>
          <object>${object}</object>
          <fields>${fields.join(",")}</fields>
          <query>${escapeXml(query)}</query>
          <pagesize>${pageSize}</pagesize>
        </readByQuery>
      </function>
    </content>
  </operation>
</request>`;
}

export function buildReadRequest(
  credentials: IntacctCredentials,
  object: string,
  keys: string[],
  fields: string[] = ["*"]
): string {
  const control = buildControlBlock(credentials);
  const auth = buildAuthenticationBlock(credentials);

  return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  ${control}
  <operation>
    ${auth}
    <content>
      <function controlid="read-${object}">
        <read>
          <object>${object}</object>
          <keys>${keys.join(",")}</keys>
          <fields>${fields.join(",")}</fields>
        </read>
      </function>
    </content>
  </operation>
</request>`;
}

export function buildLegacyGetAccountBalancesRequest(
  credentials: IntacctCredentials,
  options: {
    reportingPeriodName: string;
    glAccountNo?: string;
    departmentId?: string;
    locationId?: string;
    showZeroBalances?: boolean;
  }
): string {
  const control = buildControlBlock(credentials);
  const auth = buildAuthenticationBlock(credentials);

  return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  ${control}
  <operation>
    ${auth}
    <content>
      <function controlid="getAccountBalances">
        <get_accountbalances>
          <reportingperiodname>${escapeXml(options.reportingPeriodName)}</reportingperiodname>
          ${options.glAccountNo ? `<glaccountno>${escapeXml(options.glAccountNo)}</glaccountno>` : ""}
          ${options.departmentId ? `<departmentid>${escapeXml(options.departmentId)}</departmentid>` : ""}
          ${options.locationId ? `<locationid>${escapeXml(options.locationId)}</locationid>` : ""}
          <showzerobalances>${options.showZeroBalances ? "true" : "false"}</showzerobalances>
        </get_accountbalances>
      </function>
    </content>
  </operation>
</request>`;
}

export function buildGetReportingPeriodsRequest(credentials: IntacctCredentials): string {
  return buildQueryRequest(credentials, {
    object: "REPORTINGPERIOD",
    fields: ["RECORDNO", "NAME", "HEADER1", "START_DATE", "END_DATE", "BUDGETING", "STATUS"],
    filters: [{ field: "STATUS", operator: "=", value: "active" }],
    orderBy: [{ field: "START_DATE", descending: true }],
    pageSize: 100,
  });
}
