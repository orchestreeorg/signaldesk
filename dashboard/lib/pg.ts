import pg from "pg";
import { databaseUrl } from "./env";

let pool: pg.Pool | undefined;

export function getDatabase(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl(),
      max: 2,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
