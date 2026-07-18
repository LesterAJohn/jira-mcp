# Jira MCP Feature Spec Template

Use this template for new Jira MCP work requests.

## Overview

- Feature name:
- Jira API endpoints:
- Jira permission/scopes assumptions:
- Auth mechanism (`basic` or `bearer`):
- Transport impact (`stdio`, `http`, `both`):

## Operations

### Read-only tools

- Tool names:
- Inputs:
- Expected response shape:

### Mutating tools

- Tool names:
- Inputs:
- Required `authorizationKey` behavior:
- Expected response shape:

## Reliability and security

- Retry and timeout expectations:
- Redaction/sensitive field expectations:
- Error behavior requirements:
- External Vault/Postgres support requirements:

## Tests

- New tests required:
- Existing tests touched:

## Documentation

- README updates required:
- External Vault/Postgres support requirements to mention explicitly:
