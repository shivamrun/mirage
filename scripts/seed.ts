if (!process.env.NODE_ENV) {
  Object.assign(process.env, { NODE_ENV: "development" });
}

async function main() {
  const [{ createDbConnection }, { seedDefaultEmailLists }] = await Promise.all(
    [import("../src/server/db"), import("../src/server/admin/email-list")],
  );

  const connection = createDbConnection();

  try {
    await seedDefaultEmailLists(connection.db);
    console.log("Seeded default email lists.");
  } finally {
    await connection.close();
  }
}

void main();

export {};
