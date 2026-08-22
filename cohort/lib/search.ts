/**
 * PostgREST treats `,` `.` `(` `)` `*` `:` as filter grammar, so a raw user
 * string interpolated into a `.or(...)` clause can rewrite the query — a
 * caller could append their own filter and read rows the UI never intended to
 * expose. Strip those characters before the value reaches the query builder.
 *
 * Kept dependency-free so it can be unit tested without a Next.js runtime.
 */
export function sanitizeForFilter(input: string): string {
  return input.replace(/[,.()*:%\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
