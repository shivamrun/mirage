# Repository Guidelines

## Work Efficiently

- Inspect only files relevant to the current task.
- Prefer targeted search over broad repository exploration.
- Follow imports/dependencies only when required.
- Prefer patterns from the nearest equivalent feature.
- Do not re-read unchanged files unnecessarily.
- Make the smallest correct change.
- Do not perform unrelated refactors or cleanup.
- Run focused tests/checks instead of broad suites.
- Keep final summaries concise.

## Architecture

Next.js App Router + Elysia + Drizzle + pnpm workspace.

- `src/app` — pages, layouts, Next.js route entrypoints
- `src/components` — shared UI
- `src/features` — feature-specific UI/domain code
- `src/shared` — shared utilities and schemas
- `src/server/routes` — Elysia routes
- `src/server/db/dal` — database access
- `src/server/db/services` — business logic
- `src/server/db/schema` — Drizzle schemas
- `src/adapters` — infrastructure/integrations
- `packages` — workspace packages
- `tests` — integration/cross-cutting tests

Prefer:

`UI → route → service → DAL → database`

Do not bypass existing service/DAL layers.

## Editing Rules

- Never edit generated or ignored files.
- Never manually edit generated Drizzle migrations.
- For DB changes, update the schema then use `pnpm db:generate`.
- Do not modify lockfiles unless dependencies change.
- Prefer `@/...` imports over deep relative imports.
- Use nearby code as the primary style reference.
- UI text links should use `.link-text` from `src/app/globals.css`.

## Validation

Run the narrowest relevant validation.

```bash
pnpm lint
```

Run focused Vitest tests when behavior changes.

**Do not run `pnpm build`.** Ask the user to run it when build validation is required.

## Documentation

Read docs only when relevant to the task.

- architecture → `docs/ARCHITECTURE.md`
- pagination → `docs/PAGINATION.md`
- notifications → `docs/notifications.md`
- adapters → `docs/adapters/*`
- commits → `docs/GIT_CONVENTION.md`

For Stripe/Better Auth billing changes, consult:

`https://better-auth.com/docs/plugins/stripe.md`

## Security

- Never expose or commit secrets.
- Keep `.env` files local.
- Never hardcode production credentials or URLs.