import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeForFilter } from "./search.ts";

test("keeps ordinary search text intact", () => {
  assert.equal(sanitizeForFilter("embedded systems"), "embedded systems");
});

test("strips the PostgREST filter grammar an attacker would need", () => {
  const injected = 'x,or(full_name.ilike.*)';
  const cleaned = sanitizeForFilter(injected);
  for (const char of [",", ".", "(", ")", "*", ":", "%", "\\"]) {
    assert.ok(!cleaned.includes(char), `expected ${char} to be stripped from "${cleaned}"`);
  }
});

test("collapses the whitespace left behind so the LIKE stays usable", () => {
  assert.equal(sanitizeForFilter("a,,,b"), "a b");
});

test("caps length so an oversized query cannot be used to hammer the database", () => {
  assert.equal(sanitizeForFilter("z".repeat(500)).length, 80);
});

test("trims to empty when the input is only punctuation", () => {
  assert.equal(sanitizeForFilter("...,,,"), "");
});
