import postgres from "postgres";
import type { Config } from "./config.js";

export type Db = ReturnType<typeof postgres>;

/** One pooled connection, created once at process startup and shared across every tool call (and, for HTTP, across every per-request server factory invocation). */
export function createDb(config: Config): Db {
  return postgres(config.databaseUrl, { max: 5 });
}
