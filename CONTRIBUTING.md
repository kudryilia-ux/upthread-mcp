# Contributing

Thanks for helping. Bug reports, setup problems and small fixes are all welcome.

## Before you start

- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Security problems go through private reporting, not issues. See [SECURITY.md](SECURITY.md).
- Upthread stays **read-only** and **stores nothing**. Changes that post, vote, cache Reddit content or log queries won't be accepted. Reddit's [Data API Terms](https://www.redditinc.com/policies/data-api-terms) apply.

## Local setup

Needs Node 20+ and pnpm (via `corepack enable`).

```sh
pnpm install
cp .env.example .env.local   # fill in your own values; never commit them
pnpm dev                     # serves http://localhost:3000/mcp/<MCP_PATH_SECRET>
```

## Checks

CI runs these on every pull request; please run them first:

```sh
pnpm test         # unit tests, no network
pnpm type-check
pnpm lint
pnpm build
```

To try the server against real Reddit, run `pnpm dev`, then in another terminal `MCP_PATH_SECRET=... node scripts/test-client.mjs http://localhost:3000`.

## Pull requests

- Keep each PR to one change, with tests for new behaviour.
- If you change tool names, descriptions or result text, say why. Claude decides whether to use the connector from the tool names, and reads the descriptions and results when writing its answer, so small wording changes can change behaviour.
- Don't include secrets, connector addresses or Reddit content in code, tests or screenshots. A secret scanner runs on every push.
- By contributing, you agree your work is released under the [MIT License](LICENSE).
