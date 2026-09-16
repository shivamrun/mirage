# Source layout

The application is organized by ownership. Keep Next.js route files in
`src/app` thin; they assemble pages or delegate requests to feature code.

| Directory | Owns | Examples |
| --- | --- | --- |
| `src/features/<domain>` | A product capability's UI and browser-safe logic | `auth`, `account`, `admin`, `contact`, `email-list`, `uploads` |
| `src/server/routes` | Elysia API composition and route handlers | account, auth actions, contact, email list, uploads, admin |
| `src/server/db` | Database ownership plus server-side DAL and services | Drizzle schema, raw DAL, feature services |
| `src/server/http` | HTTP helpers for server routes and auth integration | Elysia auth, request policy, response helpers |
| `src/adapters` | Technical adapters used by multiple capabilities | email delivery, request metrics, rate-limit stores |
| `src/shared/schemas` | Browser/server-shared validation and API shapes | Zod request and response schemas |
| `src/shared` | Small cross-feature, runtime-safe utilities and site content helpers | environment, metadata, typed API client |
| `src/components` | App shell and reusable presentation primitives | UI kit, legal and content display |
| `packages/upload-sdk` | Reusable standalone upload package | provider implementations and upload validation |

## Placement rules

- Put a new feature's UI in its `components/`. Browser-safe feature constants
  and query parsing stay at the feature root or in `query/`.
- Put Elysia endpoints in `src/server/routes`, server workflows in
  `src/server/db/services`, and raw SQL/data access in `src/server/db/dal`.
- Put external integration and cross-feature operational mechanics under
  `src/adapters` by adapter type. The database's `dal/`, `schema/`,
  `services/`, and SQL-only `helpers/` stay together under `src/server/db`.
- Keep rate-limit policy code in `src/adapters/rate-limit`. Backing
  implementations live in `src/adapters/rate-limit/stores`, so Redis or Valkey
  can replace the database store without changing callers.
- Use `schemas` for schemas that both an API and a browser consumer need.
  Do not import server implementations into browser components at runtime.
- Use `shared` only when there is no natural feature owner. Avoid a generic
  `helpers` directory: name a utility for what it does and put it beside its
  owner. Leave reusable UI primitives in `components/ui`.
- Keep database access through the DAL, and keep email delivery behind the
  email adapter. Domain services may depend on infrastructure; infrastructure
  must not depend on feature presentation components.

Existing route paths, schemas, migrations, and database table definitions
were not changed by the layout refactor. Boundary checks live in
`.dependency-cruiser.js` and `tests/architecture-boundaries.test.ts`.
