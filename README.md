# jira-mcp

Jira Cloud MCP server built from the skeleton architecture, with Jira-first tools and full REST coverage through a generic Jira API request tool.

## What this solution provides

- Jira-focused MCP tools for common workflows:
  - profile lookup (`jira_get_myself`)
  - project discovery (`jira_list_projects`, `jira_get_project`)
  - issue search and retrieval (`jira_search_issues`, `jira_get_issue`)
  - issue mutation (`jira_create_issue`, `jira_edit_issue`, `jira_transition_issue`, `jira_add_comment`)
- Full Jira REST v3 coverage via:
  - `jira_api_request` (generic method/path/query/body)
  - `jira_operation_request` (operation-key based request for documented high-value endpoints)
- Existing hardened HTTP transport and auth controls from the skeleton:
  - bearer token gate on `/mcp`
  - request limits and rate limits
  - IP/origin allow-lists
  - optional Vault-backed token verification path

## Jira API sources used

- Jira docs landing page: https://confluence.atlassian.com/jira
- Jira Cloud REST API v3 intro: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
- Jira Cloud REST API groups (issues/projects/search/users), plus operation references from Atlassian documentation.

## Architecture

- `src/index.js`: stdio MCP entrypoint
- `src/http/index.js`: HTTP MCP entrypoint
- `src/http/server.js`: streamable HTTP transport with auth/rate-limit/access logs
- `src/mcp/server.js`: Jira tool registration and auth wrapper
- `src/services/targetService.js`: Jira service client (`JiraServiceClient`) and operation catalog
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

Mutating tools (require `authorizationKey` if `MCP_ADMIN_AUTH_KEY` is set):
- `jira_create_issue`
- `jira_edit_issue`
- `jira_transition_issue`
- `jira_add_comment`
- `jira_operation_request` (when selected operation is mutating)
- `jira_api_request` (for `POST`, `PUT`, `PATCH`, `DELETE`)

## Registering the MCP server

### VS Code / local stdio

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "npm",
      "args": ["run", "start:stdio"],
      "cwd": "/Users/lesterjohn/Documents/GitHub/jira-mcp"
    }
  }
}
```

### HTTP transport

Run:

```bash
npm run start:http
```

Default URLs:

- MCP: `http://127.0.0.1:3000/mcp`
- Health: `http://127.0.0.1:3000/healthz`

## Environment variables

### Core

- `APP_NAME` (default `jira`)
- `MCP_SERVER_NAME` (default `jira-mcp`)
- `MCP_SERVER_VERSION`
- `MCP_ADMIN_AUTH_KEY`
- `MCP_TRANSPORT_MODE` (`stdio`, `http`, `both`)

### Jira service integration

- `JIRA_BASE_URL` (e.g. `https://your-domain.atlassian.net`)
- `JIRA_TIMEOUT_MS`
- `JIRA_AUTH_MODE` (`none`, `bearer`, `basic`)
- `JIRA_BEARER_TOKEN`
- `JIRA_BASIC_USERNAME`
- `JIRA_BASIC_PASSWORD` (use Jira API token for basic auth)
- `JIRA_API_PREFIX` (default `/rest/api/3`)

### HTTP transport gate

- `MCP_HTTP_HOST`, `MCP_HTTP_PORT`, `MCP_HTTP_PATH`, `MCP_HTTP_HEALTH_PATH`
- `MCP_HTTP_AUTH_MODE` (`token`)
- `MCP_HTTP_AUTH_TOKENS`
- `MCP_HTTP_ALLOWED_ORIGINS`
- `MCP_HTTP_ALLOWED_IPS`
- `MCP_HTTP_MAX_BODY_BYTES`
- `MCP_HTTP_RATE_LIMIT_WINDOW_MS`
- `MCP_HTTP_RATE_LIMIT_MAX_REQUESTS`

### Postgres / Vault support (retained from skeleton)

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `VAULT_ADDR`, `VAULT_TOKEN`

## Quick start

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`
3. Fill in Jira credentials (`JIRA_BASE_URL`, auth variables)
4. Start server:
   - stdio: `npm run start:stdio`
   - HTTP: `npm run start:http`
5. Run tests: `npm test`

## External Services Mode

This repository keeps the skeleton's app-only mode for external infrastructure, including `docker-compose.external.yml`.

Use this mode when Vault and Postgres are managed outside this repository.

Required environment variables include:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `VAULT_ADDR`, `VAULT_TOKEN`

Run:

```bash
docker compose -f docker-compose.external.yml up -d
```

## Notes on "full coverage"

Jira REST v3 has a very large endpoint surface. This solution provides practical full coverage by combining:

- high-value first-class tools for common Jira workflows
- operation-key execution for curated documented endpoints
- unrestricted Jira REST pass-through via `jira_api_request`

That means any Jira REST path documented by Atlassian can be called through MCP without waiting for a dedicated wrapper tool.
