# AGENTS.md - Antigravity & Gemini Agent Rules
> Adapted from [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) for Google Antigravity & Gemini models.

This file defines behavioral guidelines for AI coding agents operating within Antigravity. These guidelines bias toward caution, precision, simplicity, and empirical verification over speed.

---

## 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before writing code or performing destructive edits:
* **State Assumptions Explicitly:** Before implementing a solution, state any underlying assumptions. If anything is uncertain, ask for clarification.
* **Surface Tradeoffs:** If multiple technical implementations exist, present the options with pros/cons instead of making a silent decision.
* **Push Back for Simplicity:** If a simpler, more direct approach exists than what was described, suggest it clearly.
* **Stop on Ambiguity:** If a user request, API specification, or codebase state is unclear, stop immediately. Name what is confusing and request input.
* **Inspect Before Speculating:** Never guess variable names, schemas, or file locations. Always inspect authoritative sources using `view_file`, `grep_search`, or `list_dir`.

---

## 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

* **No Unasked Features:** Build strictly what was requested. Do not add features, hooks, or speculative options "just in case".
* **No Premature Abstractions:** Avoid creating wrapper classes, helpers, or abstraction layers for single-use code.
* **No Unrequested Configurability:** Hardcode parameters when appropriate unless dynamic configuration is explicitly requested.
* **No Defensive Over-Engineering:** Avoid writing complex error handling or fallbacks for impossible scenarios.
* **Code Economy:** If a implementation takes 200 lines but could be done cleanly in 50 lines, rewrite and simplify it immediately.
* **Senior Engineer Test:** Ask: *"Would a senior engineer consider this solution overcomplicated?"* If yes, refactor to its simplest form.

---

## 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**

* **Scoped Modifications:** Limit edits strictly to the files and line ranges required for the task.
* **Preserve Unrelated Code:** Do not refactor, reformat, or "improve" adjacent code, comments, or imports that are not broken or requested to change.
* **Respect Existing Style:** Match existing codebase conventions, indentations, and naming patterns, even if you would personally write them differently.
* **No Unsolicited Cleanups:** Do not delete unused code or files outside your immediate changes unless explicitly asked. Clean up only orphaned imports or variables created by your own edits.
* **Precise Edits:** Use Antigravity's targeted tools (`replace_file_content` / `multi_replace_file_content`) to modify code rather than rewriting large intact files.

---

## 4. Goal-Driven Execution & Empirical Verification
**Define verifiable success criteria. Loop until empirically verified.**

* **Concrete Milestones:** Transform broad or vague instructions into explicit, testable criteria before editing code.
  * *Vague:* "Fix the bug" $\rightarrow$ *Goal-Driven:* "Identify the root cause in logs, write/run a test case that reproduces it, then verify it passes."
  * *Vague:* "Add validation" $\rightarrow$ *Goal-Driven:* "Write test cases for invalid payloads and verify error codes are returned."
* **Proactive Execution & Verification:** Take full initiative on actions you can perform yourself. Never ask the user to execute commands, launch applications, or run test suites that you can execute directly via available tools.
* **No Declaration of Success Without Verification:** Never claim a feature is complete or a bug is fixed without executing verification commands (`run_command` tests/builds) and confirming zero errors.
* **Log Inspection First:** When a runtime failure or build error occurs, read the un-truncated log output before proposing a diagnosis.
* **No Symptom Masking:** Never mask errors by swallowing exceptions (`try/except: pass`), returning dummy fallback values, commenting out failing assertions, or altering test expectations without fixing the underlying bug.

---

## 5. Antigravity & Gemini Tooling Rules
**Optimized for Antigravity pair programming and Gemini LLM capabilities.**

* **Context Efficiency:** Keep reasoning concise and focused. Do not re-summarize entire files or artifacts when presenting updates.
* **Background Execution:** Use `run_command` asynchronously for long-running operations. Do not poll or loop on status; allow Antigravity's reactive notifications to report task completion.
* **Resource Attribution:** Enforce required project/location metadata when executing Cloud or CLI commands (`gcloud`, `bq`).
* **Artifact Rules:** Store technical designs, plans, and walkthroughs in designated markdown artifacts within the Antigravity conversation directory.
* **Clickable References:** Format all code symbols and file references as clickable markdown links (`[filename.py](file:///path/to/filename.py)`).

---

## 6. Security
**Proactive security, secret isolation, and defense-in-depth.**

* **Input Validation:** Sanitize and validate all user input on both client and server; never trust client-side validation alone.
* **Secrets Management:** Use environment variables for all secrets, API keys, and credentials — never hardcode or commit them. Add `.env*` to `.gitignore`.
* **Security Headers:** Set secure HTTP headers: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`.
* **HTTPS Enforcement:** Use `next/headers` or middleware to enforce HTTPS redirects in production.
* **XSS Prevention:** Escape all dynamic content rendered in JSX to prevent XSS; avoid `dangerouslySetInnerHTML` unless content is sanitized (e.g. via `DOMPurify`).
* **Rate Limiting:** Implement rate limiting on all API routes and forms to prevent abuse and brute force attacks.
* **CSRF Protection:** Use CSRF protection on any state-changing `POST`/`PUT`/`DELETE` routes.
* **Upload Security:** Validate and sanitize file uploads (type, size, extension); never trust client-reported MIME types.
* **Dependency Auditing:** Keep dependencies updated; run `npm audit` (or equivalent) before every release and fix high/critical vulnerabilities.
* **Auth Best Practices:** Use authentication best practices: hashed passwords (bcrypt/argon2), secure/httpOnly/sameSite cookies, short-lived tokens with refresh rotation.
* **Information Leak Prevention:** Never expose stack traces, internal error details, or debug info in production responses.

---

## 7. Accessibility (a11y)
**Inclusive design, keyboard operation, and screen-reader readiness.**

* **Keyboard Operability:** All interactive elements must be reachable and operable via keyboard alone (`Tab`, `Enter`, `Space`, `Esc`).
* **Image Alt Text:** Every image needs meaningful `alt` text (or `alt=""` if purely decorative).
* **Semantic HTML:** Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<header>`, `<footer>`) instead of generic `<div>`s with click handlers.
* **Heading Hierarchy:** Maintain a logical heading hierarchy (`h1` $\rightarrow$ `h2` $\rightarrow$ `h3`, no skipped levels).
* **Color Contrast:** Ensure color contrast meets WCAG AA minimum (4.5:1 for normal text, 3:1 for large text).
* **ARIA Attributes:** Add `aria-label`, `aria-describedby`, or `aria-live` where visual context isn't enough for screen readers.
* **Form Labels & Errors:** Forms must have associated `<label>` elements (not just placeholder text) and clear error messaging tied via `aria-describedby`.
* **Visible Focus:** Focus states must be visible; never remove `:focus` outlines without providing an accessible replacement.
* **Audit & Testing:** Test with a screen reader (VoiceOver/NVDA) and axe DevTools / Lighthouse accessibility audit before shipping any new page.
* **Motion Sensitivity:** Respect `prefers-reduced-motion` for animations and transitions.

---

## 8. Responsive Design / Cross-Device Readiness
**Mobile-first layouts, fluid adaptation, and cross-browser parity.**

* **Mobile-First Layouts:** Design mobile-first; use Tailwind/CSS breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) rather than fixed pixel widths.
* **Viewport Testing:** Test all layouts at minimum: 375px (mobile), 768px (tablet), 1280px+ (desktop).
* **Flexible Containers:** Avoid fixed heights on containers with dynamic content; use `min-h` and flex/grid instead.
* **Responsive Media:** Use `next/image` for all images with proper `sizes` and responsive `srcset` behavior — never raw `<img>` for content images.
* **Touch Targets:** Ensure touch targets are at least 44x44px on mobile viewports.
* **No Overflow:** Avoid horizontal scroll at any breakpoint; audit with browser dev tools device toolbar.
* **Fluid Typography:** Use `clamp()` or fluid typography for text scaling across viewports instead of hard breakpoint jumps.
* **Cross-Browser Verification:** Test on both iOS Safari and Android Chrome — they diverge on viewport units, scroll behavior, and form elements.

---

## 9. Performance
**Speed optimization, minimal JS payloads, and Core Web Vitals targets.**

* **Lighthouse Target:** Run Lighthouse (Performance, SEO, Best Practices, Accessibility) before every deploy; target 90+ on all four metrics.
* **Lazy Loading:** Lazy-load below-the-fold images and components (`next/dynamic`, `loading="lazy"`).
* **Server-First Components:** Minimize client-side JS: prefer Server Components by default in Next.js App Router; only mark `"use client"` where interactivity is required.
* **CLS Prevention:** Avoid layout shift: reserve space for images/embeds with explicit width/height or `aspect-ratio`.
* **Cache Headers:** Set proper caching headers (`Cache-Control`) for static assets.
* **Bundle Budgeting:** Keep bundle size in check — run `next build` and review output size warnings; code-split large dependencies.
* **Font Optimization:** Preload critical fonts; use `next/font` to avoid FOUC/CLS from web fonts.

---

## 10. SEO & Metadata
**Search engine visibility, social sharing, and structured data.**

* **Page Metadata:** Every page must define a unique `<title>` and `meta description` via Next.js Metadata API.
* **Social Cards:** Add Open Graph and Twitter Card metadata for shareable pages.
* **Sitemaps & Indexing:** Generate and serve a `sitemap.xml` and `robots.txt`.
* **Canonicalization:** Use canonical URLs to avoid duplicate content issues.
* **Structured Data:** Add structured data (JSON-LD) for relevant content types (articles, products, FAQs, etc.).

---

## 11. Production Readiness Checklist
**Final empirical verification before marking any feature "done".**

- [ ] Passes Lighthouse audit (90+ across all categories)
- [ ] No console errors or warnings in browser or server logs
- [ ] Works cleanly across 375px, 768px, and 1280px+ viewports
- [ ] Fully keyboard-navigable and screen-reader tested
- [ ] All forms include validation, clear error states, and loading states
- [ ] All API routes handle errors gracefully (no unhandled promise rejections)
- [ ] Environment variables documented in `.env.example`
- [ ] No secrets or API keys committed to the repository
- [ ] 404 and error pages are custom-styled (not default Next.js templates)
