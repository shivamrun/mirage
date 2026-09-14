# Mirage

Mirage is a starter Next.js app with Better Auth, Elysia API routes, Drizzle
ORM, Tailwind, and a local Postgres database already wired together.

## Development

Install dependencies:

```bash
pnpm install
```

Start Postgres:

```bash
pnpm db:up
```

Run migrations:

```bash
pnpm db:migrate
```

Start the app:

```bash
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Google Sign-In

Create an OAuth client in Google Cloud Console and add this redirect URI for
local development:

```text
http://localhost:3000/api/auth/callback/google
```

Then add the credentials to `.env`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Checks

```bash
pnpm lint
pnpm build
```

## Operations

After deploying, run the smoke test against the deployed origin:

```bash
SMOKE_TEST_BASE_URL=https://example.com pnpm smoke
```

See `docs/operations/RUNBOOK.md` for migration, backup, restore, request ID,
admin metrics and database connection-budget guidance.
