import { describe, expect, test } from "vitest";
import {
  isUuid,
  normalizeInterests,
  nullableText,
  parsePositiveInteger,
} from "./validation";

describe("UUID validation", () => {
  test("accepts a canonical UUID", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  test.each(["", "not-a-uuid", "550e8400e29b41d4a716446655440000"])(
    "rejects malformed identifiers: %s",
    (value) => expect(isUuid(value)).toBe(false)
  );
});

describe("text normalization", () => {
  test("trims and caps text", () => {
    expect(nullableText("  abcdef  ", 4)).toBe("abcd");
  });

  test.each([undefined, null, 42, "   "])("normalizes empty values to null", (value) => {
    expect(nullableText(value, 20)).toBeNull();
  });
});

describe("interest normalization", () => {
  test("trims, de-duplicates, and bounds the list", () => {
    expect(normalizeInterests([" Web ", "Web", "AI", 3], 2, 20)).toEqual([
      "Web",
      "AI",
    ]);
  });

  test("caps individual interest length", () => {
    expect(normalizeInterests(["x".repeat(100)], 40, 12)).toEqual(["x".repeat(12)]);
  });

  test("returns an empty list for non-arrays", () => {
    expect(normalizeInterests("Web", 40, 80)).toEqual([]);
  });
});

describe("positive integer parsing", () => {
  test.each([1, 30, 1440])("accepts bounded integers: %s", (value) => {
    expect(parsePositiveInteger(value, 1440)).toBe(value);
  });

  test.each([0, -1, 1.5, 1441, "5"])("rejects invalid values: %s", (value) => {
    expect(parsePositiveInteger(value, 1440)).toBeNull();
  });
});
