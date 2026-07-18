import assert from "node:assert/strict";
import test from "node:test";

import { createHttpMcpServer } from "../src/http/server.js";
import { createMcpServer } from "../src/mcp/server.js";

function createServiceClientMock() {
  return {
    getConnectionInfo() {
      return { baseUrl: "https://example.atlassian.net", authMode: "basic" };
    },
    listKnownGroups() {
      return [];
    },
    listKnownEndpoints() {
      return [];
    },
    findKnownEndpoint() {
      return null;
    },
    async healthCheck() {
      return { status: 200, data: null };
    },
    async getMyself() {
      return { accountId: "abc" };
    },
    async listProjects() {
      return { values: [] };
    },
    async getProject(projectIdOrKey) {
      return { key: projectIdOrKey };
    },
    async searchIssues() {
      return { issues: [] };
    },
    async getIssue(issueIdOrKey) {
      return { key: issueIdOrKey };
    },
    async createIssue(fields) {
      return { fields };
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
      return payload;
    },
    async request(payload) {
      return {
        status: 200,
        ...payload
      };
    }
  };
}

function createTestServer() {
  const serviceClient = createServiceClientMock();
  return createHttpMcpServer({
    host: "127.0.0.1",
    port: 0,
    mcpPath: "/mcp",
    healthPath: "/healthz",
    authTokens: ["test-token"],
    trustedProxy: false,
    allowedOrigins: [],
    allowedIps: [],
    maxBodyBytes: 1024 * 1024,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 60,
    createMcpServer: () =>
      createMcpServer({
        name: "jira-mcp",
        version: "0.1.0",
        serviceClient
      })
  });
}

function initializeRequestPayload() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  };
}

test("unauthorized HTTP request is rejected", async () => {
  const server = createTestServer();
  await server.start();

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(initializeRequestPayload())
    });

    assert.equal(response.status, 401);
  } finally {
    await server.close();
  }
});

test("authorized HTTP MCP initialize call succeeds", async () => {
  const server = createTestServer();
  await server.start();

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer test-token"
      },
      body: JSON.stringify(initializeRequestPayload())
    });

    assert.equal(response.status, 200);
  } finally {
    await server.close();
  }
});

test("health endpoint reports HTTP MCP status", async () => {
  const server = createTestServer();
  await server.start();

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.status, 200);
    assert.equal(payload.transport, "http");
    assert.equal(payload.path, "/mcp");
  } finally {
    await server.close();
  }
});
