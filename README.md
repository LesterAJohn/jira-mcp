# jira-mcp

Jira Cloud MCP server with Jira-first tools and full REST coverage.

## What it provides

- Focused Jira tools for common workflows:
  - `jira_get_myself`
  - `jira_list_projects`
  - `jira_get_project`
  - `jira_search_issues`
  - `jira_get_issue`
  - `jira_create_issue`
  - `jira_edit_issue`
  - `jira_transition_issue`
  - `jira_add_comment`
- Full Jira REST access through:
  - `jira_api_request`
  - `jira_operation_request`
- Existing HTTP transport hardening retained from this repository:
  - bearer token gate on `/mcp`
  - request limits and rate limits
  - IP/origin allow-lists
  - optional Vault-backed token verification path

## Architecture

- `src/index.js`: stdio MCP entrypoint
- `src/http/index.js`: HTTP MCP entrypoint
- `src/http/server.js`: streamable HTTP transport with auth, rate limits, and access logs
- `src/mcp/jiraServer.js`: Jira tool registration and auth wrapper
- `src/services/jiraService.js`: Jira REST client and operation catalog
- `src/config/env.js`: environment parsing and validation

## Tool catalog

Read tools:
- `jira_connection_info`
- `jira_scope_info`
- `jira_list_operations`
- `jira_health_check`
- `jira_get_myself`
- `jira_list_projects`
- `jira_get_project`
- `jira_search_issues`
- `jira_get_issue`

Mutating tools:
- `jira_create_issue`
- `jira_edit_issue`
- `jira_transition_issue`
- `jira_add_comment`
- `jira_operation_request`
- `jira_api_request`

If `MCP_ADMIN_AUTH_KEY` is set, mutating tools require `authorizationKey`.

## Registering the MCP server

### Stdio

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "npm",
      "args": ["run", "start:stdio"],
      "cwd": "/Users/lesterjohn/Documents/GitHub/skeleton-mcp"
    }
  }
}
```

### HTTP

Run `npm run start:http` and use:

- MCP: `http://127.0.0.1:3000/mcp`
- Health: `http://127.0.0.1:3000/healthz`

## Environment variables

### Core

- `APP_NAME` default: `jira`
- `MCP_SERVER_NAME` default: `jira-mcp`
- `MCP_SERVER_VERSION`
- `MCP_ADMIN_AUTH_KEY`
- `MCP_TRANSPORT_MODE`: `stdio`, `http`, `both`

### Jira

- `JIRA_BASE_URL`
- `JIRA_TIMEOUT_MS`
- `JIRA_AUTH_MODE`: `none`, `bearer`, `basic`
- `JIRA_BEARER_TOKEN`
- `JIRA_BASIC_USERNAME`
- `JIRA_BASIC_PASSWORD`
- `JIRA_API_PREFIX` default: `/rest/api/3`

### HTTP transport

- `MCP_HTTP_HOST`
- `MCP_HTTP_PORT`
- `MCP_HTTP_PATH`
- `MCP_HTTP_HEALTH_PATH`
- `MCP_HTTP_AUTH_MODE`
- `MCP_HTTP_AUTH_TOKENS`
- `MCP_HTTP_ALLOWED_ORIGINS`
- `MCP_HTTP_ALLOWED_IPS`
- `MCP_HTTP_MAX_BODY_BYTES`
- `MCP_HTTP_RATE_LIMIT_WINDOW_MS`
- `MCP_HTTP_RATE_LIMIT_MAX_REQUESTS`

### Postgres and Vault support

This repository still keeps the existing Vault/Postgres support for transport auth and local infrastructure:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `VAULT_ADDR`, `VAULT_TOKEN`

## Quick start

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `JIRA_BASE_URL` and Jira auth credentials.
4. Start the server with `npm run start:stdio` or `npm run start:http`.
5. Run tests with `npm test`.

## Notes on full coverage

Jira REST v3 is large. This repository exposes practical full coverage by combining:

- first-class tools for common Jira workflows
- operation-key execution for curated endpoints
- unrestricted Jira REST pass-through with `jira_api_request`

That means any documented Jira REST v3 path can be called through MCP without waiting for a dedicated wrapper tool.
