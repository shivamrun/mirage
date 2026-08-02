# Grove

Grove is a Next.js app with Better Auth, Elysia API routes, Drizzle ORM, and a
local Postgres database.

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

## Checks

```bash
pnpm lint
pnpm build
```
