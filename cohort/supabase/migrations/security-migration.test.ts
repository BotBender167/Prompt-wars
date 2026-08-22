import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const migrationPath = fileURLToPath(new URL("./0005_security.sql", import.meta.url));

describe("database security migration", () => {
  test("adds server-managed profile sessions", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS profile_sessions/i);
    expect(sql).toMatch(/token_hash\s+text\s+UNIQUE\s+NOT NULL/i);
  });

  test("enables RLS on every application table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    for (const table of [
      "domains",
      "institutions",
      "profiles",
      "profile_domains",
      "github_cache",
      "codeforces_cache",
      "beacons",
      "profile_sessions",
    ]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, "i"));
    }
  });

  test("revokes direct browser roles from server-owned tables", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/REVOKE ALL.*FROM anon, authenticated/is);
  });
});
