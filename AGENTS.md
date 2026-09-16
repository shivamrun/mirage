# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js app using the App Router. Application routes and global styles live in `src/app`, with backend route handlers grouped under `src/app/(backend)/api`. Product UI domains live in `src/features`, shared API schemas live in `src/shared/schemas`, and cross-feature utilities live in `src/shared`. Elysia routes live in `src/server/routes`; database schema, DAL, and server services live in `src/server/db`; HTTP helpers live in `src/server/http`; technical adapters such as email, operations, and rate limiting live under `src/adapters`. Static assets are kept in `public`.

Tests live in the top-level `tests` directory. Keep integration helpers there, and colocate narrowly focused unit tests near the code they cover when that makes ownership clearer.

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

## Editing Guardrails

Never modify ignored or generated output directly. This includes `node_modules`,
`dist`, `.next`, and any file or directory covered by `.gitignore`.

Never edit migration files directly. For database changes, update the Drizzle
schema first, then generate a new migration with `pnpm db:generate`.

## Coding Style & Naming Conventions

Use TypeScript with strict mode. Biome is the source of truth for formatting: 2-space indentation, semicolons, organized imports, and recommended React/Next rules. Prefer path aliases like `@/shared/env` over deep relative imports when practical.

Use PascalCase for React components, camelCase for functions and variables, and lowercase route filenames following Next conventions. Keep feature-specific UI code under `src/features`, API routes under `src/server/routes`, and server-side DAL/services under `src/server/db`.

Text links in the UI should use the shared `.link-text` class from `src/app/globals.css`. Add only local utility modifiers when a link needs a different size or emphasis.

## Testing Guidelines

Vitest is configured for tests. For most changes, validate with:

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
