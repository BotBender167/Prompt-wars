import { expect, test } from "vitest";
import { sanitizeForFilter } from "./search";

test("keeps ordinary search text intact", () => {
  expect(sanitizeForFilter("embedded systems")).toBe("embedded systems");
});

test("strips the PostgREST filter grammar an attacker would need", () => {
  const injected = 'x,or(full_name.ilike.*)';
  const cleaned = sanitizeForFilter(injected);
  for (const char of [",", ".", "(", ")", "*", ":", "%", "\\"]) {
    expect(cleaned, `expected ${char} to be stripped from "${cleaned}"`).not.toContain(char);
  }
});

test("collapses the whitespace left behind so the LIKE stays usable", () => {
  expect(sanitizeForFilter("a,,,b")).toBe("a b");
});

test("caps length so an oversized query cannot be used to hammer the database", () => {
  expect(sanitizeForFilter("z".repeat(500))).toHaveLength(80);
});

test("trims to empty when the input is only punctuation", () => {
  expect(sanitizeForFilter("...,,,")).toBe("");
});
