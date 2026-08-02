/// <reference types="node" />

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env, getEnvVariable } from "@/lib/env";
import * as schema from "./schema";

export type DBExecutor = PostgresJsDatabase<typeof schema>;
export type PostgresClient = ReturnType<typeof postgres>;

export type DBConnection = {
  client: PostgresClient;
  close: () => Promise<void>;
  db: DBExecutor;
};

declare global {
  var pgClient: PostgresClient | undefined;
  var drizzleDb: DBExecutor | undefined;
}

const getConnectionOptions = () => ({
  max: env.NODE_ENV === "production" ? 10 : 5,
  prepare: false,
});

export const createDbConnection = (): DBConnection => {
  const client = postgres(
    getEnvVariable("DATABASE_URL"),
    getConnectionOptions(),
  );
  const db = drizzle(client, { schema });

  return {
    client,
    close: async () => {
      await client.end();
    },
    db,
  };
};

const getDb = (): DBExecutor => {
  if (!global.pgClient) {
    const connection = createDbConnection();
    global.pgClient = connection.client;
    global.drizzleDb = connection.db;
  } else if (!global.drizzleDb) {
    global.drizzleDb = drizzle(global.pgClient, { schema });
  }

  return global.drizzleDb;
};

export const db = new Proxy({} as DBExecutor, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});

export default db;
export type DBTransaction = Parameters<DBExecutor["transaction"]>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;
export type DBClient = DBExecutor | DBTransaction;
