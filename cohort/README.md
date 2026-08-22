# Parivar

Parivar is a Thapar campus discovery app for finding peers, collaborators, and people who are available nearby. It shows source-backed profile evidence without exposing synthetic compatibility scores.

## Local development

Requirements: Node.js 20+ and a Supabase project with the migrations in `supabase/migrations` applied.

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` and provide the documented values. The service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix.

## Quality checks

```bash
npm run lint
npm run test:coverage
npm run build
npm run test:e2e
```

Unit and regression tests enforce coverage thresholds. Playwright exercises all public pages, a mobile viewport, browser-console cleanliness, and the cross-origin write guard. GitHub Actions runs the static checks on pushes and pull requests, then runs browser smoke tests against successful deployments.

## Database and deployment

Apply pending database changes before deploying matching server code:

```bash
npx supabase db push --linked
npx vercel --prod
```

The Vercel project root must be `cohort`. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the sensitive `SUPABASE_SERVICE_ROLE_KEY` in Vercel.

Anonymous profile ownership is enforced through a hashed server-side session referenced by a Secure, HttpOnly, SameSite cookie. Browser roles have no direct table privileges. Full account login and cross-device identity recovery are intentionally not implemented yet.
