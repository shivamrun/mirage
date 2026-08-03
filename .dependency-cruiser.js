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
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
