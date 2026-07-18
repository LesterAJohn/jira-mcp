---
mode: agent
tools: ["codebase", "editFiles", "search", "testFailure"]
description: "Implement Jira MCP changes with env config, service adapter updates, tool mapping, tests, and docs refresh."
---

Use this prompt to implement Jira MCP changes in this repository.

Required inputs:
- Jira endpoint set to support
- Tool naming and payload requirements
- Auth expectations for read-only vs mutating behavior
- Documentation updates required

Execution checklist:
1. Update env parsing in `src/config/env.js`.
2. Update Jira client behavior in `src/services/targetService.js`.
3. Update MCP tool registration in `src/mcp/server.js`.
4. Add/update tests under `tests`.
5. Rewrite docs to match implementation.
6. Keep support for external Vault/Postgres services and app-only compose mode.
7. Run `npm test` and summarize the results.

Constraints:
- Mutating operations must support `authorizationKey` checks.
- Preserve current HTTP transport auth controls.
- Keep code and docs synchronized.
