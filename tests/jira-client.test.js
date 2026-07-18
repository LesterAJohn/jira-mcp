import assert from "node:assert/strict";
import test from "node:test";

import { JiraServiceClient } from "../src/services/jiraService.js";

test("requestByKey resolves Jira path params and array query values", async () => {
  const client = new JiraServiceClient({
    baseUrl: "https://example.atlassian.net",
    authMode: "none"
  });

  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    assert.equal(init.method, "GET");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    const response = await client.requestByKey({
      key: "userBulk",
      query: {
        accountId: ["abc", "def"]
      }
    });

    assert.equal(response.status, 200);
    assert.match(requestedUrl, /\/rest\/api\/3\/user\/bulk\?accountId=abc&accountId=def$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("request normalizes relative Jira paths under the API prefix", async () => {
  const client = new JiraServiceClient({
    baseUrl: "https://example.atlassian.net",
    authMode: "none"
  });

  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ issue: "ABC-1" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    const response = await client.request({
      method: "GET",
      path: "/issue/ABC-1"
    });

    assert.equal(response.data.issue, "ABC-1");
    assert.equal(requestedUrl, "https://example.atlassian.net/rest/api/3/issue/ABC-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});