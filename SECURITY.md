# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: open the repository's **Security** tab and click **Report a vulnerability**. Don't open a public issue for them.

Include what you found, how to reproduce it, and what an attacker could do with it. You'll get a reply within a week.

## What counts

Upthread is a self-hosted, read-only MCP server. Its main protection is the secret path: the MCP endpoint answers only at `/mcp/<MCP_PATH_SECRET>`, and every other path returns 404. Reports we especially want:

- any way to reach the MCP endpoint, or learn the secret, without knowing it already
- the setup page or logs revealing a secret, a Reddit credential, a query or Reddit content
- anything that lets one person's deployment act on another's

Out of scope: rate limits or outages on Reddit's side, and problems that need someone's connector address (anyone with the address can use that connector by design; the fix is to change `MCP_PATH_SECRET`).

## Supported versions

Only the latest `main` is supported. Deployments made with the Deploy button don't update automatically, so redeploy from the latest `main` after a security fix.
