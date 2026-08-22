# AGENTS.md — Cohort Project Contract

These rules are binding for every AI agent and human contributor working in this repository.
They must be re-read and re-confirmed at the start of each implementation phase.

---

## Rule 1 — Domain-Agnostic

Never hardcode "ECE" or any single department name in source code, UI copy, or configuration.
All domain and skill values must be read from the database `domains` table.
Components, pages, and API handlers must not embed department-specific logic.

## Rule 2 — No Mock or Fabricated User Data

Do not seed, generate, or display mock user profiles, placeholder names, or fabricated
skill evidence at any point in any phase.
If an API route or server action returns an empty result set, the UI must render an
appropriate empty state (e.g., "No results found") rather than falling back to dummy data.

## Rule 3 — No Score Numbers in UI

Do not display numeric scores, composite rankings, or weighted totals in any user-facing
component. Render raw evidence only — e.g., commit counts, problem counts, repository
languages, ratings from external platforms — without aggregating them into a single number.

## Rule 4 — Provider Isolation

All calls to external APIs (GitHub, Codeforces, or any future provider) must live in
`/lib/providers/*.ts`, one file per provider.
No external API call may be made inside a React component, page, or route handler directly.

## Rule 5 — Uniform Provider Return Shape

Every exported function in `/lib/providers/*.ts` must return the shape:

```ts
{ data: T | null; error: string | null }
```

Functions must never throw exceptions to the caller.
All errors must be caught internally and returned via the `error` field.

## Rule 6 — Environment Variables Only

API keys, connection strings, and secrets must be read exclusively from `process.env`.
No key or secret may be inlined in source code, committed to the repository, or
interpolated via any method other than `process.env.VARIABLE_NAME`.
All required variables must be documented in `.env.example` at the project root.
