import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVaultUserTokenIndexPath, normalizeAppName, normalizeUserIdForPath } from "../config/vaultAuthTokenIndex.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeMethod(method) {
  return String(method ?? "GET").trim().toUpperCase();
}

function normalizePath(path) {
  const raw = String(path ?? "").trim();
  if (!raw) {
    return "/";
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function createMcpServer({ name, version, serviceClient }) {
  const server = new McpServer({
    name,
    version
  });

  const adminAuthKey = process.env.MCP_ADMIN_AUTH_KEY;
  const appName = normalizeAppName(process.env.APP_NAME ?? "skeleton");
  const defaultUserId = String(process.env.MCP_CONFIG_DEFAULT_USER_ID ?? "default").trim() || "default";

  function getScopeModel(userId = defaultUserId) {
    const resolvedUserId = String(userId ?? defaultUserId).trim() || defaultUserId;
    return {
      appName,
      userId: resolvedUserId,
      userIdPathSegment: normalizeUserIdForPath(resolvedUserId),
      postgres: {
        tableName: `${appName}_config`,
        primaryKey: ["user_id", "key"],
        scope: "app_and_user"
      },
      vault: {
        tokenIndexPath: getVaultUserTokenIndexPath(appName, resolvedUserId),
        scope: "app_and_user"
      }
    };
  }

  function asText(value) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(value, null, 2)
        }
      ]
    };
  }

  function classifyToolError(error) {
    const status = Number(error?.status ?? error?.statusCode ?? 500);
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      status: Number.isFinite(status) ? status : 500,
      error: message
    };
  }

  function withErrorHandling(handler) {
    return async (args) => {
      try {
        return asText(await handler(args));
      } catch (error) {
        return {
          ...asText(classifyToolError(error)),
          isError: true
        };
      }
    };
  }

  function assertAuthorized(authorizationKey) {
    if (!adminAuthKey) {
      return;
    }

    if (!authorizationKey || authorizationKey !== adminAuthKey) {
      const unauthorized = new Error("Unauthorized: invalid authorizationKey for mutating API operation");
      unauthorized.status = 401;
      throw unauthorized;
    }
  }

  server.tool(
    "jira_connection_info",
    "Return MCP server and Jira API connection details.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: {
        server: {
          name,
          version,
          adminAuthConfigured: Boolean(adminAuthKey),
          scopeModel: getScopeModel()
        },
        jira: serviceClient.getConnectionInfo()
      }
    }))
  );

  server.tool(
    "jira_scope_info",
    "Return app/user scoping metadata used by Postgres config and Vault token index paths.",
    {
      userId: z.string().min(1).optional()
    },
    withErrorHandling(async ({ userId }) => ({
      ok: true,
      status: 200,
      data: getScopeModel(userId)
    }))
  );

  server.tool(
    "jira_list_operations",
    "List Jira operations exposed by this MCP server.",
    {
      group: z.string().min(1).optional(),
      method: z.string().min(1).optional(),
      keyContains: z.string().min(1).optional()
    },
    withErrorHandling(async ({ group, method, keyContains }) => {
      const normalizedMethod = method ? normalizeMethod(method) : "";
      const groupFilter = String(group ?? "").trim().toLowerCase();
      const keyFilter = String(keyContains ?? "").trim().toLowerCase();
      const operations = serviceClient
        .listKnownEndpoints()
        .filter((entry) => !groupFilter || String(entry.group ?? "").toLowerCase() === groupFilter)
        .filter((entry) => !normalizedMethod || entry.method === normalizedMethod)
        .filter((entry) => !keyFilter || String(entry.key ?? "").toLowerCase().includes(keyFilter));

      return {
        ok: true,
        status: 200,
        data: {
          groups: serviceClient.listKnownGroups(),
          operations
        }
      };
    })
  );

  server.tool(
    "jira_health_check",
    "Call Jira /myself endpoint as a connectivity health check.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: await serviceClient.healthCheck()
    }))
  );

  server.tool(
    "jira_get_myself",
    "Get current Jira user profile via GET /rest/api/3/myself.",
    {},
    withErrorHandling(async () => ({
      ok: true,
      status: 200,
      data: await serviceClient.getMyself()
    }))
  );

  server.tool(
    "jira_list_projects",
    "List Jira projects via GET /rest/api/3/project/search.",
    {
      startAt: z.number().int().min(0).optional(),
      maxResults: z.number().int().min(1).optional(),
      query: z.string().optional(),
      keys: z.array(z.string().min(1)).optional(),
      orderBy: z.string().optional()
    },
    withErrorHandling(async (args) => ({
      ok: true,
      status: 200,
      data: await serviceClient.listProjects(args)
    }))
  );

  server.tool(
    "jira_get_project",
    "Get one Jira project via GET /rest/api/3/project/{projectIdOrKey}.",
    {
      projectIdOrKey: z.string().min(1),
      expand: z.string().optional()
    },
    withErrorHandling(async ({ projectIdOrKey, expand }) => ({
      ok: true,
      status: 200,
      data: await serviceClient.getProject(projectIdOrKey, expand ? { expand } : undefined)
    }))
  );

  server.tool(
    "jira_search_issues",
    "Search Jira issues using POST /rest/api/3/search/jql.",
    {
      jql: z.string().min(1),
      maxResults: z.number().int().min(1).optional(),
      nextPageToken: z.string().optional(),
      fields: z.array(z.string().min(1)).optional(),
      expand: z.array(z.string().min(1)).optional(),
      reconcileIssues: z.array(z.number().int()).optional(),
      failFast: z.boolean().optional()
    },
    withErrorHandling(async (args) => ({
      ok: true,
      status: 200,
      data: await serviceClient.searchIssues(args)
    }))
  );

  server.tool(
    "jira_get_issue",
    "Get one Jira issue via GET /rest/api/3/issue/{issueIdOrKey}.",
    {
      issueIdOrKey: z.string().min(1),
      fields: z.array(z.string().min(1)).optional(),
      expand: z.string().optional(),
      updateHistory: z.boolean().optional()
    },
    withErrorHandling(async ({ issueIdOrKey, fields, expand, updateHistory }) => ({
      ok: true,
      status: 200,
      data: await serviceClient.getIssue(issueIdOrKey, {
        fields,
        expand,
        updateHistory
      })
    }))
  );

  server.tool(
    "jira_create_issue",
    "Create a Jira issue via POST /rest/api/3/issue.",
    {
      fields: z.record(z.string(), z.unknown()),
      update: z.record(z.string(), z.unknown()).optional(),
      properties: z.array(z.unknown()).optional(),
      transition: z.record(z.string(), z.unknown()).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ fields, update, properties, transition, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await serviceClient.createIssue(fields, {
          update,
          properties,
          transition
        })
      };
    })
  );

  server.tool(
    "jira_edit_issue",
    "Edit a Jira issue via PUT /rest/api/3/issue/{issueIdOrKey}.",
    {
      issueIdOrKey: z.string().min(1),
      body: z.record(z.string(), z.unknown()),
      query: z.record(z.string(), z.unknown()).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ issueIdOrKey, body, query, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await serviceClient.editIssue(issueIdOrKey, body, query)
      };
    })
  );

  server.tool(
    "jira_transition_issue",
    "Transition a Jira issue via POST /rest/api/3/issue/{issueIdOrKey}/transitions.",
    {
      issueIdOrKey: z.string().min(1),
      transitionId: z.union([z.string().min(1), z.number().int().positive()]),
      fields: z.record(z.string(), z.unknown()).optional(),
      update: z.record(z.string(), z.unknown()).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ issueIdOrKey, transitionId, fields, update, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await serviceClient.transitionIssue(issueIdOrKey, {
          transition: { id: String(transitionId) },
          fields,
          update
        })
      };
    })
  );

  server.tool(
    "jira_add_comment",
    "Add Jira comment via POST /rest/api/3/issue/{issueIdOrKey}/comment.",
    {
      issueIdOrKey: z.string().min(1),
      body: z.unknown(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ issueIdOrKey, body, authorizationKey }) => {
      assertAuthorized(authorizationKey);
      return {
        ok: true,
        status: 200,
        data: await serviceClient.addComment(issueIdOrKey, { body })
      };
    })
  );

  server.tool(
    "jira_operation_request",
    "Execute a documented Jira operation key from jira_list_operations.",
    {
      operationKey: z.string().min(1),
      pathParams: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
      query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
      body: z.unknown().optional(),
      headers: z.record(z.string(), z.string()).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ operationKey, pathParams, query, body, headers, authorizationKey }) => {
      const endpoint = serviceClient.findKnownEndpoint(operationKey);
      if (!endpoint) {
        const error = new Error(`Unknown operationKey: ${operationKey}`);
        error.status = 400;
        throw error;
      }

      if (MUTATING_METHODS.has(endpoint.method)) {
        assertAuthorized(authorizationKey);
      }

      return {
        ok: true,
        status: 200,
        data: await serviceClient.requestByKey({
          key: operationKey,
          pathParams,
          query,
          body,
          headers
        })
      };
    })
  );

  server.tool(
    "jira_api_request",
    "Generic Jira REST API call for full endpoint coverage.",
    {
      method: z.string().min(1),
      path: z.string().min(1),
      query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
      body: z.unknown().optional(),
      headers: z.record(z.string(), z.string()).optional(),
      authorizationKey: z.string().min(1).optional()
    },
    withErrorHandling(async ({ method, path, query, body, headers, authorizationKey }) => {
      const normalizedMethod = normalizeMethod(method);
      const normalizedPath = normalizePath(path);

      if (MUTATING_METHODS.has(normalizedMethod)) {
        assertAuthorized(authorizationKey);
      }

      return {
        ok: true,
        status: 200,
        data: await serviceClient.request({
          method: normalizedMethod,
          path: normalizedPath,
          query,
          body,
          headers
        })
      };
    })
  );

  return server;
}
