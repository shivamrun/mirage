/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "db-schema-only-in-schemas-and-database",
      comment:
        "Database schema modules may only be consumed by schemas and database infrastructure. The account email-change transaction is a reviewed exception.",
      severity: "error",
      from: {
        pathNot: [
          "^src/shared/schemas/",
          "^src/server/db/schema/",
          "^src/server/db/dal/",
          "^src/server/db/index\\.ts$",
          "^src/server/db/services/account/email-change\\.ts$",
          "^src/adapters/rate-limit/stores/database\\.ts$",
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
        pathNot: [
          "^src/server/db/dal/",
          "^src/adapters/rate-limit/stores/database\\.ts$",
        ],
      },
      to: {
        path: "^src/server/db/index\\.ts$",
      },
    },
    {
      name: "db-dal-only-in-db-services-and-auth-adapter",
      comment:
        "DAL modules should be consumed by database services. Better Auth server setup is a reviewed exception because it wires the auth database adapter.",
      severity: "error",
      from: {
        pathNot: [
          "^src/server/db/services/",
          "^src/server/routes/index\\.ts$",
          "^src/features/auth/better-auth/server\\.ts$",
        ],
      },
      to: {
        path: "^src/server/db/dal/",
      },
    },
    {
      name: "db-helpers-only-in-db-layer",
      comment:
        "Database helper modules must stay database-owned. Generic feature math belongs with its feature.",
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
      name: "adapters-cannot-import-feature-ui",
      comment:
        "Technical adapters must not depend on feature presentation code.",
      severity: "error",
      from: {
        path: "^src/adapters/",
      },
      to: {
        path: "^src/features/[^/]+/components/",
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
