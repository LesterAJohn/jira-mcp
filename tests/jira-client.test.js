import assert from "node:assert/strict";
import test from "node:test";

import { JiraServiceClient } from "../src/services/targetService.js";

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type" ? "application/json" : null;
      }
    },
    async text() {
      return JSON.stringify(payload);
    }
  };
}

test("JiraServiceClient prefixes Jira API path and sends basic auth", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return createJsonResponse({ ok: true }, 200);
  };

  try {
    const client = new JiraServiceClient({
      baseUrl: "https://example.atlassian.net",
      authMode: "basic",
      basicUsername: "user@example.com",
      basicPassword: "api-token"
    });

    const result = await client.request({
      method: "GET",
      path: "/issue/TEST-1",
      query: { fields: ["summary", "status"] }
    });

    assert.equal(result.status, 200);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/rest\/api\/3\/issue\/TEST-1/);
    assert.ok(calls[0].options.headers.Authorization.startsWith("Basic "));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("JiraServiceClient requestByKey resolves path parameters", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/rest\/api\/3\/issue\/ABC-123$/);
    return createJsonResponse({ key: "ABC-123" }, 200);
  };

  try {
    const client = new JiraServiceClient({ baseUrl: "https://example.atlassian.net" });
    const response = await client.requestByKey({
      key: "issueGet",
      pathParams: { issueIdOrKey: "ABC-123" }
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.key, "ABC-123");

    await assert.rejects(
      () =>
        client.requestByKey({
          key: "issueGet",
          pathParams: {}
        }),
      /Missing required path parameter: issueIdOrKey/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
