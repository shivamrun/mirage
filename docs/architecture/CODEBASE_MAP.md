# Codebase map

This map covers maintained architecture-bearing files. Generated `.source`, `.next`, Drizzle snapshots, UI primitive details and static assets are intentionally omitted.

| Directory/module | Responsibility | Main dependencies | Main consumers | Scope |
|---|---|---|---|---|
| `src/app/layout.tsx`, `globals.css` | HTML shell, fonts, shared styles | Next, `src/lib/metadata` | All pages | Shared |
| `src/app/page.tsx`, `contact/page.tsx` | Public landing/waitlist and contact screens | Public components, metadata | Visitors | Public feature |
| `src/app/(auth)` | Login, registration, password reset, email verification/change and 2FA pages | `src/components/auth`, Better Auth client through forms | Visitors/auth users | Auth |
| `src/app/(role_user)` | Account profile/security routes and user role gate | `VerifiedRoleGate`, account components | Authenticated users | Account |
| `src/app/admin` | Admin users, security, email lists, contact inbox; redirects and server reads | `requireAdmin`, DAL, admin components | Admin users | Admin |
| `src/app/admin/contact-submission/all/actions.ts` | Verified-admin-only contact status Server Actions and revalidation | `requireVerifiedAdmin`, contact DAL, admin query parser | Contact admin UI | Contact/admin |
| `src/app/(backend)/api` | Dispatches `/api/auth` to Better Auth and remaining `/api` traffic to Elysia | `src/lib/auth`, `src/server/routes` | Browser/API clients | Shared transport |
| `src/app/(written-content)` | Articles/guides/authors pages and OG routes | Fumadocs source, content components, SEO helpers | Visitors/search crawlers | Content |
| `src/app/(legal)` | Static legal pages | `src/lib/legal`, legal component | Visitors | Public content |
| `src/proxy.ts` | Protected-path session redirects and current-path header | Better Auth | Matched page requests | Shared access entry |
| `src/components/auth`, `account` | Interactive auth/account screens; a server role gate in auth directory | Better Auth client, Eden client, upload helper | Auth/account pages | Auth/account |
| `src/components/admin` | Admin tables, filters, dialogs, navigation and query-state helpers | Better Auth client, `fetch`, Zod; some DAL-derived types | Admin pages | Admin |
| `src/components/contact`, `email-list` | Public forms | Eden client, Zod/form libraries | Landing/contact pages | Public feature |
| `src/components/app`, `ui`, `src/hooks` | Sidebar/navigation, shadcn/Radix primitives, mobile hook | React, Radix, Tailwind | Most interactive pages | Shared presentation |
| `src/components/content`, `legal` | MDX render pieces, content cards/metadata and legal page view | Fumadocs/React, content metadata | Public content pages | Content |
| `src/lib/auth/index.ts`, `hooks.ts`, `roles.ts`, `access.ts`, `client.ts` | Better Auth server/client setup, Zod hooks, role normalization, page/API access helpers | Better Auth, auth DAL, email, env | Proxy, layouts, pages, routes, forms | Shared auth |
| `src/lib/api/client.ts` | Typed Eden client | Elysia `App` type | Client forms | Shared transport |
| `src/server/routes` | Elysia route tree: public forms, account operations, admin operations, upload signing | Auth macros, Zod, DAL, account workflows, email, upload signer | `/api/[[...route]]` | HTTP layer |
| `src/server/account` | Email-change approval/confirmation, 2FA email-code/TOTP and Google-account view | Auth session type, DAL, email | Account routes | Account domain |
| `src/server/db/index.ts` | Lazy process-wide Postgres.js pool and Drizzle instance | Env, schema | DAL | Shared infrastructure |
| `src/server/db/schema` | Auth/session, contact and email-list tables, relations/indexes | Drizzle and schema helpers | DB entrypoint and DAL | Persistence model |
| `src/server/db/dal` | Auth adapter, user/admin reads, security reads/mutations, contact and email-list queries/workflows | Drizzle, schema, some `src/components/admin` query types | Pages, routes, account workflows, auth | Data access (mixed) |
| `src/server/db/helpers` | Table naming, columns, offset pagination helper | Drizzle | Schema/DAL; pagination helper has no observed production caller | Shared DB |
| `src/server/email` | Resend client/config, send function, templates and senders | Env, React Email/Resend | Better Auth, account/email-list routes | Shared integration |
| `src/lib/uploads` | Browser avatar upload, key validation, URL resolution, S3 signer/profile | Upload SDK, Eden, env | Account form, auth hooks, upload route | Upload feature |
| `src/zod` | Form/API/auth validation schemas and shared input types | Zod | Better Auth hooks, Elysia routes, forms, DAL typing | Shared contracts |
| `src/lib/content-source.ts`, `content/`, `source.config.mjs` | Compiled local MDX collections | Fumadocs | Written-content routes | Content |
| `src/lib/metadata.ts`, `content-seo.ts`, `authors.ts`, `legal.ts` | Site metadata/SEO, author and legal records | Next metadata types, content data | Public pages/OG routes | Public content |
| `src/lib/env.ts` | Runtime env validation and server/public settings | t3-env, Zod | Auth, DB, email, uploads, routes | Shared config |
| `drizzle/`, `drizzle.config.ts` | Committed SQL migration history and generation config | Drizzle Kit, schema, database URL | Migration command | Database operations |
| `package.json`, `next.config.mjs`, `biome.json`, `.dependency-cruiser.js`, `docker-compose.yml` | Scripts/dependencies, MDX build integration, lint rules, dependency rules, local Postgres | Toolchain | Developers/build/deploy | Tooling |

### Folder structure assessment

App Router URLs, public content, admin screens and shared UI are easy to locate. The `src/server/account` workflow folder is a useful separation. Admin delete and 2FA persistence now use focused DAL modules, and `pnpm depcruise` passes as of 2026-09-13. The DAL is still not consistently a query-only layer: `email-list.ts` contains subscription policy, default seeding and verification lifecycle. `src/server/db/dal/admin-users.ts` and `contact-submission.ts` import `src/components/admin` query types; moving neutral query contracts to `src/zod` or a server-safe shared module would make dependency direction clearer. `src/components/admin/user-detail/dialogs/user-management-dialogs.tsx` is a very large client module with many Better Auth mutations; splitting by action would improve change isolation if this area continues to evolve.
