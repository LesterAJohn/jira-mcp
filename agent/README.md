# Agent Structure

This directory contains Jira-specific implementation guidance for this MCP repository.

## Purpose

Use these docs when evolving this Jira MCP server while preserving transport security, Vault/Postgres integrations, and test coverage.

## Contents

- `playbooks/service-onboarding.md`: Jira MCP change checklist.
- `templates/service-spec.md`: structured spec for new Jira capability requests.
- `.github/prompts/adapt-skeleton-service.prompt.md`: reusable implementation prompt for agent mode.

## Implementation guardrails

- Keep Jira API integration in `src/services/targetService.js`.
- Keep mutating tools gated by `authorizationKey` when `MCP_ADMIN_AUTH_KEY` is configured.
- Keep redaction/security defaults in place.
- Preserve support for external Vault and Postgres services.
