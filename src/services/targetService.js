const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_API_PREFIX = "/rest/api/3";

const JIRA_KNOWN_ENDPOINTS = [
  { key: "myself", method: "GET", path: "/rest/api/3/myself", group: "myself", description: "Get current Jira user profile" },
  { key: "projectSearch", method: "GET", path: "/rest/api/3/project/search", group: "projects", description: "Get projects with pagination" },
  { key: "projectGet", method: "GET", path: "/rest/api/3/project/{projectIdOrKey}", group: "projects", description: "Get one project by key or id" },
  { key: "issueGet", method: "GET", path: "/rest/api/3/issue/{issueIdOrKey}", group: "issues", description: "Get one issue by key or id" },
  { key: "issueCreate", method: "POST", path: "/rest/api/3/issue", group: "issues", description: "Create an issue" },
  { key: "issueEdit", method: "PUT", path: "/rest/api/3/issue/{issueIdOrKey}", group: "issues", description: "Edit an issue" },
  { key: "issueDelete", method: "DELETE", path: "/rest/api/3/issue/{issueIdOrKey}", group: "issues", description: "Delete an issue" },
  { key: "issueTransitions", method: "GET", path: "/rest/api/3/issue/{issueIdOrKey}/transitions", group: "issues", description: "List available issue transitions" },
  { key: "issueTransition", method: "POST", path: "/rest/api/3/issue/{issueIdOrKey}/transitions", group: "issues", description: "Transition an issue" },
  { key: "issueCommentCreate", method: "POST", path: "/rest/api/3/issue/{issueIdOrKey}/comment", group: "issue-comments", description: "Create issue comment" },
  { key: "issueSearchJql", method: "POST", path: "/rest/api/3/search/jql", group: "issue-search", description: "Search issues using JQL enhanced search" },
  { key: "issueSearchCount", method: "POST", path: "/rest/api/3/search/approximate-count", group: "issue-search", description: "Get approximate issue count for JQL" },
  { key: "userGet", method: "GET", path: "/rest/api/3/user", group: "users", description: "Get user details" },
  { key: "userBulk", method: "GET", path: "/rest/api/3/user/bulk", group: "users", description: "Get users by account ids" },
  { key: "userSearch", method: "GET", path: "/rest/api/3/users/search", group: "users", description: "Search users" }
];

function joinUrl(baseUrl, path, query) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  if (query && typeof query === "object") {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function parseResponseBody(contentType, text) {
  if (!text) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function normalizeApiPrefix(value) {
  const trimmed = String(value ?? DEFAULT_API_PREFIX).trim() || DEFAULT_API_PREFIX;
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function withPathParams(pathTemplate, pathParams) {
  const params = pathParams && typeof pathParams === "object" ? pathParams : {};
  return String(pathTemplate).replace(/\{([^}]+)\}/g, (match, key) => {
    const value = params[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing required path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
}

export class JiraServiceClient {
  constructor({
    baseUrl,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    authMode = "none",
    bearerToken = "",
    basicUsername = "",
    basicPassword = "",
    apiPrefix = DEFAULT_API_PREFIX
  }) {
    this.baseUrl = String(baseUrl ?? "https://your-domain.atlassian.net").trim();
    this.timeoutMs = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
    this.authMode = String(authMode ?? "none").toLowerCase();
    this.bearerToken = String(bearerToken ?? "").trim();
    this.basicUsername = String(basicUsername ?? "").trim();
    this.basicPassword = String(basicPassword ?? "");
    this.apiPrefix = normalizeApiPrefix(apiPrefix);

    if (!["none", "bearer", "basic"].includes(this.authMode)) {
      throw new Error("JIRA_AUTH_MODE must be one of: none, bearer, basic");
    }

    if (this.authMode === "bearer" && !this.bearerToken) {
      throw new Error("JIRA_BEARER_TOKEN is required when JIRA_AUTH_MODE=bearer");
    }

    if (this.authMode === "basic" && !this.basicUsername) {
      throw new Error("JIRA_BASIC_USERNAME is required when JIRA_AUTH_MODE=basic");
    }
  }

  getConnectionInfo() {
    return {
      baseUrl: this.baseUrl,
      apiPrefix: this.apiPrefix,
      timeoutMs: this.timeoutMs,
      authMode: this.authMode,
      bearerTokenConfigured: Boolean(this.bearerToken),
      basicUsernameConfigured: Boolean(this.basicUsername),
      basicPasswordConfigured: Boolean(this.basicPassword)
    };
  }

  listKnownEndpoints() {
    return JIRA_KNOWN_ENDPOINTS;
  }

  listKnownGroups() {
    return Array.from(new Set(JIRA_KNOWN_ENDPOINTS.map((entry) => entry.group))).sort();
  }

  findKnownEndpoint(key) {
    return JIRA_KNOWN_ENDPOINTS.find((entry) => entry.key === key) ?? null;
  }

  resolvePath(path) {
    const normalizedPath = String(path ?? "/").trim() || "/";
    if (normalizedPath.startsWith(this.apiPrefix)) {
      return normalizedPath;
    }
    if (normalizedPath.startsWith("/rest/api/")) {
      return normalizedPath;
    }
    if (normalizedPath.startsWith("/")) {
      return `${this.apiPrefix}${normalizedPath}`;
    }
    return `${this.apiPrefix}/${normalizedPath}`;
  }

  async request({ method = "GET", path = "/", query, body, headers = {} }) {
    const upperMethod = String(method).toUpperCase();
    const jiraPath = this.resolvePath(path);
    const url = joinUrl(this.baseUrl, jiraPath, query);
    const requestHeaders = {
      Accept: "application/json",
      ...headers
    };

    if (this.authMode === "bearer") {
      requestHeaders.Authorization = `Bearer ${this.bearerToken}`;
    }

    if (this.authMode === "basic") {
      const credential = Buffer.from(`${this.basicUsername}:${this.basicPassword}`).toString("base64");
      requestHeaders.Authorization = `Basic ${credential}`;
    }

    let payload;
    if (body !== undefined && body !== null && upperMethod !== "GET") {
      if (typeof body === "string") {
        payload = body;
      } else {
        payload = JSON.stringify(body);
        if (!requestHeaders["Content-Type"] && !requestHeaders["content-type"]) {
          requestHeaders["Content-Type"] = "application/json";
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: upperMethod,
        headers: requestHeaders,
        body: payload,
        signal: controller.signal
      });

      const text = await response.text();
      const contentType = String(response.headers.get("content-type") ?? "");
      const parsed = parseResponseBody(contentType, text);

      if (!response.ok) {
        const error = new Error(`Jira request failed: ${upperMethod} ${url.pathname} -> ${response.status}`);
        error.status = response.status;
        error.response = parsed;
        throw error;
      }

      return {
        method: upperMethod,
        path: url.pathname,
        url: url.toString(),
        status: response.status,
        contentType,
        data: parsed
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async requestByKey({ key, pathParams, query, body, headers }) {
    const endpoint = this.findKnownEndpoint(key);
    if (!endpoint) {
      const error = new Error(`Unknown Jira endpoint key: ${key}`);
      error.status = 400;
      throw error;
    }

    const resolvedPath = withPathParams(endpoint.path, pathParams);
    return this.request({
      method: endpoint.method,
      path: resolvedPath,
      query,
      body,
      headers
    });
  }

  async healthCheck() {
    return this.request({ method: "GET", path: "/myself" });
  }

  async getMyself() {
    return this.request({ method: "GET", path: "/myself" });
  }

  async searchIssues({ jql, maxResults, nextPageToken, fields, expand, reconcileIssues, failFast }) {
    return this.request({
      method: "POST",
      path: "/search/jql",
      body: {
        jql,
        maxResults,
        nextPageToken,
        fields,
        expand,
        reconcileIssues,
        failFast
      }
    });
  }

  async getIssue(issueIdOrKey, query) {
    return this.request({ method: "GET", path: `/issue/${encodeURIComponent(String(issueIdOrKey))}`, query });
  }

  async createIssue(fields, additionalBody = {}) {
    return this.request({ method: "POST", path: "/issue", body: { fields, ...additionalBody } });
  }

  async editIssue(issueIdOrKey, body, query) {
    return this.request({
      method: "PUT",
      path: `/issue/${encodeURIComponent(String(issueIdOrKey))}`,
      body,
      query
    });
  }

  async transitionIssue(issueIdOrKey, body) {
    return this.request({
      method: "POST",
      path: `/issue/${encodeURIComponent(String(issueIdOrKey))}/transitions`,
      body
    });
  }

  async addComment(issueIdOrKey, body) {
    return this.request({
      method: "POST",
      path: `/issue/${encodeURIComponent(String(issueIdOrKey))}/comment`,
      body
    });
  }

  async listProjects(query) {
    return this.request({ method: "GET", path: "/project/search", query });
  }

  async getProject(projectIdOrKey, query) {
    return this.request({
      method: "GET",
      path: `/project/${encodeURIComponent(String(projectIdOrKey))}`,
      query
    });
  }

  async getUser(query) {
    return this.request({ method: "GET", path: "/user", query });
  }
}

export class TargetServiceClient extends JiraServiceClient {}
