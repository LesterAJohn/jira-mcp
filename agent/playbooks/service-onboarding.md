# Jira MCP Onboarding Playbook

Use this checklist when adding or changing Jira MCP features.

## 1. Capability definition

- Define Jira endpoints involved.
- Split into read-only vs mutating tools.
- Identify required auth mode (`basic` or `bearer`).
- Identify sensitive payload fields.

## 2. Config

- Add env parsing and validation in `src/config/env.js`.
- Keep Jira-specific defaults in `.env.example`.
- Keep compatibility with existing transport and Vault/Postgres settings.

## 3. Jira adapter

- Add endpoint wrappers in `src/services/targetService.js`.
- Keep `jira_api_request` compatibility for full REST coverage.
- Keep errors normalized for MCP tools.

## 4. MCP tool mapping

- Register tools in `src/mcp/server.js`.
- Enforce `authorizationKey` for mutating operations.
- Keep tool outputs JSON-serializable.

## 5. Runtime wiring

- Keep stdio and HTTP startup paths intact.
- Preserve HTTP auth and rate limit controls.

## 6. Tests

- Add integration tests under `tests`.
- Cover auth gates and Jira request mapping.
- Validate new endpoint wrappers and fallback/generic tool behavior.

## 7. Docs and ops

- Update README tool catalog and env docs.
- Keep app-only compose path documented for external infrastructure.
- Keep language around app-only compose path consistent with external deployment docs.
