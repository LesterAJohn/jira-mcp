import assert from "node:assert/strict";
import test from "node:test";

import { createJiraMcpServer } from "../src/mcp/jiraServer.js";

function setEnv(updates) {
  const previous = {};
  for (const [key, value] of Object.entries(updates)) {
    previous[key] = process.env[key];
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

function createServiceClientMock() {
  const calls = {
    createIssue: 0,
    request: 0,
    requestByKey: 0
  };

  const client = {
    getConnectionInfo() {
      return {
        baseUrl: "https://example.atlassian.net",
        apiPrefix: "/rest/api/3",
        authMode: "none"
      };
    },
    listKnownGroups() {
      return ["issues", "projects"];
    },
    listKnownEndpoints() {
      return [
        { key: "projectSearch", method: "GET", path: "/rest/api/3/project/search", group: "projects" },
        { key: "issueCreate", method: "POST", path: "/rest/api/3/issue", group: "issues" }
      ];
    },
    findKnownEndpoint(key) {
      return this.listKnownEndpoints().find((entry) => entry.key === key) ?? null;
    },
    async healthCheck() {
      return { status: 200, data: null };
    },
    async getMyself() {
      return { status: 200, data: { accountId: "abc" } };
    },
    async listProjects(args) {
      return { status: 200, data: { values: [], args } };
    },
    async getProject(projectIdOrKey, query) {
      return { status: 200, data: { key: projectIdOrKey, query } };
    },
    async searchIssues(args) {
      return { status: 200, data: { issues: [], ...args } };
    },
    async getIssue(issueIdOrKey, query) {
      return { status: 200, data: { key: issueIdOrKey, query } };
    },
    async createIssue(fields, additionalBody) {
      calls.createIssue += 1;
      return { status: 201, data: { fields, additionalBody } };
    },
    async editIssue(issueIdOrKey, body, query) {
      return { status: 204, data: { issueIdOrKey, body, query } };
    },
    async transitionIssue(issueIdOrKey, body) {
      return { status: 204, data: { issueIdOrKey, body } };
    },
    async addComment(issueIdOrKey, body) {
      return { status: 201, data: { issueIdOrKey, body } };
    },
    async requestByKey(payload) {
      calls.requestByKey += 1;
      return { status: 200, ...payload };
    },
    async request(payload) {
      calls.request += 1;
      return {
        status: 200,
        ...payload
      };
    }
  };

  return { client, calls };
}

async function invokeTool(server, name, args = {}) {
  const registeredTools = server._registeredTools;
  assert.ok(registeredTools[name], `Expected tool ${name} to be registered`);
  const result = await registeredTools[name].handler(args);
  const payload = JSON.parse(result.content[0].text);
  return { result, payload };
}

test("jira_health_check returns ok", async () => {
  const restoreEnv = setEnv({ MCP_ADMIN_AUTH_KEY: "" });

  try {
    const { client } = createServiceClientMock();
    const server = createJiraMcpServer({
      name: "jira-mcp",
      version: "0.1.0",
      serviceClient: client
    });

    const { payload } = await invokeTool(server, "jira_health_check");

    assert.equal(payload.ok, true);
    assert.equal(payload.status, 200);
    assert.equal(payload.data.status, 200);
  } finally {
    restoreEnv();
  }
});

test("mutating jira tools require authorizationKey when admin key is configured", async () => {
  const restoreEnv = setEnv({ MCP_ADMIN_AUTH_KEY: "super-secret" });

  try {
    const { client, calls } = createServiceClientMock();
    const server = createJiraMcpServer({
      name: "jira-mcp",
      version: "0.1.0",
      serviceClient: client
    });

    const unauthorized = await invokeTool(server, "jira_create_issue", {
      fields: { summary: "Test issue" }
    });
    assert.equal(unauthorized.result.isError, true);
    assert.equal(unauthorized.payload.status, 401);

    const authorized = await invokeTool(server, "jira_create_issue", {
      fields: { summary: "Test issue" },
      authorizationKey: "super-secret"
    });
    assert.equal(authorized.payload.ok, true);
    assert.equal(calls.createIssue, 1);

    const operationUnauthorized = await invokeTool(server, "jira_operation_request", {
      operationKey: "issueCreate"
    });
    assert.equal(operationUnauthorized.result.isError, true);
    assert.equal(operationUnauthorized.payload.status, 401);

    const genericAuthorized = await invokeTool(server, "jira_api_request", {
      method: "POST",
      path: "/issue",
      authorizationKey: "super-secret"
    });
    assert.equal(genericAuthorized.payload.ok, true);
    assert.equal(calls.request, 1);
  } finally {
    restoreEnv();
  }
});
