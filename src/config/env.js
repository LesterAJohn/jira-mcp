import dotenv from "dotenv";

dotenv.config();

const TRANSPORT_MODES = new Set(["stdio", "http", "both"]);
const HTTP_AUTH_MODES = new Set(["token"]);
const JIRA_AUTH_MODES = new Set(["none", "bearer", "basic"]);

function enumValue(name, fallback, allowedValues) {
  const value = String(process.env[name] ?? fallback).toLowerCase();
  if (!allowedValues.has(value)) {
    throw new Error(
      `Environment variable ${name} must be one of: ${Array.from(allowedValues).join(", ")}`
    );
  }
  return value;
}

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative number`);
  }
  return value;
}

function portNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Environment variable ${name} must be an integer between 1 and 65535`);
  }
  return value;
}

function parseCsv(name, fallback = "") {
  return String(process.env[name] ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function booleanValue(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = String(raw).toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  throw new Error(`Environment variable ${name} must be either true or false`);
}

function normalizeAppName(value, fallback = "skeleton") {
  return String(value ?? fallback).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") || fallback;
}

const transportMode = enumValue("MCP_TRANSPORT_MODE", "stdio", TRANSPORT_MODES);
const httpAuthMode = enumValue("MCP_HTTP_AUTH_MODE", "token", HTTP_AUTH_MODES);
const jiraAuthMode = enumValue(
  "JIRA_AUTH_MODE",
  required("TARGET_SERVICE_AUTH_MODE", "none").toLowerCase(),
  JIRA_AUTH_MODES
);

export const env = {
  appName: normalizeAppName(process.env.APP_NAME, "jira"),
  mcpServerName: process.env.MCP_SERVER_NAME ?? "jira-mcp",
  mcpServerVersion: process.env.MCP_SERVER_VERSION ?? "0.1.0",
  adminAuthKey: process.env.MCP_ADMIN_AUTH_KEY ?? "",
  targetService: {
    baseUrl: required("JIRA_BASE_URL", process.env.TARGET_SERVICE_BASE_URL ?? "https://your-domain.atlassian.net"),
    timeoutMs: positiveNumber("JIRA_TIMEOUT_MS", process.env.TARGET_SERVICE_TIMEOUT_MS ?? "15000"),
    authMode: jiraAuthMode,
    bearerToken: process.env.JIRA_BEARER_TOKEN ?? process.env.TARGET_SERVICE_BEARER_TOKEN ?? "",
    basicUsername: process.env.JIRA_BASIC_USERNAME ?? process.env.TARGET_SERVICE_BASIC_USERNAME ?? "",
    basicPassword: process.env.JIRA_BASIC_PASSWORD ?? process.env.TARGET_SERVICE_BASIC_PASSWORD ?? "",
    apiPrefix: process.env.JIRA_API_PREFIX ?? "/rest/api/3"
  },
  transport: {
    mode: transportMode,
    http: {
      host: required("MCP_HTTP_HOST", "127.0.0.1"),
      port: portNumber("MCP_HTTP_PORT", "3000"),
      mcpPath: required("MCP_HTTP_PATH", "/mcp"),
      healthPath: required("MCP_HTTP_HEALTH_PATH", "/healthz"),
      authMode: httpAuthMode,
      authTokens: parseCsv("MCP_HTTP_AUTH_TOKENS", "replace-me-token"),
      trustedProxy: booleanValue("MCP_HTTP_TRUST_PROXY", false),
      allowedOrigins: parseCsv("MCP_HTTP_ALLOWED_ORIGINS", ""),
      allowedIps: parseCsv("MCP_HTTP_ALLOWED_IPS", ""),
      maxBodyBytes: positiveNumber("MCP_HTTP_MAX_BODY_BYTES", "1048576"),
      rateLimitWindowMs: positiveNumber("MCP_HTTP_RATE_LIMIT_WINDOW_MS", "60000"),
      rateLimitMaxRequests: positiveNumber("MCP_HTTP_RATE_LIMIT_MAX_REQUESTS", "60"),
      tls: {
        enabled: booleanValue("MCP_HTTP_TLS_ENABLED", false),
        certPath: process.env.MCP_HTTP_TLS_CERT_PATH ?? "",
        keyPath: process.env.MCP_HTTP_TLS_KEY_PATH ?? ""
      }
    }
  }
};
