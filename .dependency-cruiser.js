/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "db-schema-only-in-zod",
      comment:
        "Database schema modules may only be consumed by Zod schemas. The database entrypoint is exempt because it registers the schema with Drizzle.",
      severity: "error",
      from: {
        pathNot: [
          "^src/zod/",
          "^src/server/db/schema/",
          "^src/server/db/dal/",
          "^src/server/db/index\\.ts$",
          "^src/server/account/email-change\\.ts$",
        ],
      },
      to: {
        path: "^src/server/db/schema/",
      },
    },
    {
      name: "db-entrypoint-only-in-dal",
      comment:
        "The database entrypoint is an infrastructure detail and may only be consumed by the data access layer.",
      severity: "error",
      from: {
        pathNot: "^src/server/db/dal/",
      },
      to: {
        path: "^src/server/db/index\\.ts$",
      },
    },
    {
      name: "db-helpers-only-in-db-layer",
      comment:
        "Database helper modules must stay DB-owned. Generic server/view math should live outside src/server/db/helpers.",
      severity: "error",
      from: {
        pathNot: [
          "^src/server/db/dal/",
          "^src/server/db/schema/",
          "^src/server/db/index\\.ts$",
        ],
      },
      to: {
        path: "^src/server/db/helpers/",
      },
    },
    {
      name: "lib-auth-browser-safe-only",
      comment:
        "src/lib/auth is reserved for browser-safe auth helpers after the server auth move.",
      severity: "error",
      from: {},
      to: {
        path: "^src/lib/auth/(?!client\\.ts$|roles\\.ts$|redirect\\.ts$)",
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
