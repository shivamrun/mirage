# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js app using the App Router. Application routes and global styles live in `src/app`, with backend route handlers grouped under `src/app/(backend)/api`. Shared utilities and auth setup live in `src/lib`. Elysia API routes are defined in `src/server/routes`, while Drizzle database setup, helpers, and schema live in `src/server/db`. Static assets are kept in `public`.

There is no dedicated test directory yet. When tests are added, colocate focused unit tests near the code they cover or use a top-level `tests` directory for integration flows.

## Build, Test, and Development Commands

- `pnpm dev`: start the local Next.js development server.
- `pnpm build`: create a production build and run Next.js type validation.
- `pnpm start`: run the built production app.
- `pnpm lint`: run Biome checks for formatting, lint rules, and import organization.
- `pnpm format`: apply Biome formatting.
- `pnpm db:up`: start local Postgres via Docker Compose.
- `pnpm db:down`: stop Postgres and remove local volumes.
- `pnpm db:generate`: generate Drizzle migrations from schema changes.
- `pnpm db:migrate`: apply Drizzle migrations.
- `pnpm db:studio`: open Drizzle Studio.

## Coding Style & Naming Conventions

Use TypeScript with strict mode. Biome is the source of truth for formatting: 2-space indentation, semicolons, organized imports, and recommended React/Next rules. Prefer path aliases like `@/lib/env` over deep relative imports when practical.

Use PascalCase for React components, camelCase for functions and variables, and lowercase route filenames following Next conventions. Keep server-only code under `src/server` or server route files.

## Testing Guidelines

No test runner is configured yet. Until one is added, validate changes with:

```bash
pnpm lint
pnpm build
```

For future tests, prefer Vitest for unit tests and Playwright for browser flows. Name tests after the behavior under review, for example `auth-session.test.ts` or `api-health.spec.ts`.

## Commit & Pull Request Guidelines

Follow the repository commit rules in [docs/GIT_CONVENTION.md](docs/GIT_CONVENTION.md) for all commit messages. Check that guide before creating commits, especially for type/scope format and examples.

Pull requests should include a short summary, validation commands run, linked issue when available, and screenshots for UI changes.

## Security & Configuration Tips

Keep `.env` files local. Required runtime values include `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL`, `BETTER_AUTH_URL`, and a strong `BETTER_AUTH_SECRET` of at least 32 characters. Do not hardcode production URLs or secrets in source files.
