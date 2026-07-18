import assert from "node:assert/strict";
import test from "node:test";

import { createMcpServer } from "../src/mcp/server.js";

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
    operationRequest: 0,
    request: 0
  };

  const client = {
    getConnectionInfo() {
      return {
        baseUrl: "https://example.atlassian.net",
        authMode: "basic"
      };
    },
    listKnownGroups() {
      return ["issues", "projects"];
    },
    listKnownEndpoints() {
      return [{ key: "issueCreate", group: "issues", method: "POST", path: "/rest/api/3/issue" }];
    },
    findKnownEndpoint(key) {
      if (key !== "issueCreate") {
        return null;
      }
      return { key: "issueCreate", method: "POST", path: "/rest/api/3/issue" };
    },
    async healthCheck() {
      return { status: 200, data: null };
    },
    async getMyself() {
      return { accountId: "abc", displayName: "Test User" };
    },
    async listProjects() {
      return { values: [] };
    },
    async getProject(projectIdOrKey) {
      return { id: "10000", key: projectIdOrKey };
    },
    async searchIssues(payload) {
      return { issues: [], query: payload.jql };
    },
    async getIssue(issueIdOrKey) {
      return { id: issueIdOrKey, key: issueIdOrKey };
    },
    async createIssue(fields) {
      calls.createIssue += 1;
      return { id: "10001", key: "TEST-1", fields };
    },
    async editIssue(issueIdOrKey, body, query) {
      return { issueIdOrKey, body, query };
    },
    async transitionIssue(issueIdOrKey, body) {
      return { issueIdOrKey, body };
    },
    async addComment(issueIdOrKey, body) {
      return { issueIdOrKey, body };
    },
    async requestByKey(payload) {
      calls.operationRequest += 1;
      return {
        status: 200,
        ...payload
      };
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

test("service_health_check returns ok", async () => {
  const restoreEnv = setEnv({ MCP_ADMIN_AUTH_KEY: "" });

  try {
    const { client } = createServiceClientMock();
    const server = createMcpServer({
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

test("mutating Jira tools require authorizationKey when admin key is configured", async () => {
  const restoreEnv = setEnv({ MCP_ADMIN_AUTH_KEY: "super-secret" });

  try {
    const { client, calls } = createServiceClientMock();
    const server = createMcpServer({
      name: "jira-mcp",
      version: "0.1.0",
      serviceClient: client
    });

    const unauthorized = await invokeTool(server, "jira_create_issue", {
      fields: { project: { key: "TEST" }, summary: "Sample", issuetype: { name: "Task" } }
    });
    assert.equal(unauthorized.result.isError, true);
    assert.equal(unauthorized.payload.status, 401);

    const authorized = await invokeTool(server, "jira_create_issue", {
      fields: { project: { key: "TEST" }, summary: "Sample", issuetype: { name: "Task" } },
      authorizationKey: "super-secret"
    });
    assert.equal(authorized.payload.ok, true);
    assert.equal(calls.createIssue, 1);

    const genericUnauthorized = await invokeTool(server, "jira_api_request", {
      method: "POST",
      path: "/issue"
    });
    assert.equal(genericUnauthorized.result.isError, true);
    assert.equal(genericUnauthorized.payload.status, 401);

    const genericAuthorized = await invokeTool(server, "jira_api_request", {
      method: "POST",
      path: "/issue",
      authorizationKey: "super-secret"
    });
    assert.equal(genericAuthorized.payload.ok, true);
    assert.equal(calls.request, 1);

    const operationAuthorized = await invokeTool(server, "jira_operation_request", {
      operationKey: "issueCreate",
      authorizationKey: "super-secret"
    });
    assert.equal(operationAuthorized.payload.ok, true);
    assert.equal(calls.operationRequest, 1);
  } finally {
    restoreEnv();
  }
});
