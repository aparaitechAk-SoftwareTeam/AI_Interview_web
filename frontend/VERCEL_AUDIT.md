# Vercel readiness audit

- Root App Router page exists: `app/page.tsx`
- Candidate/admin routes exist
- API proxy route exists: `app/api/backend/route.ts`
- Backend target is configured by `API_BASE_URL`, with a Render fallback
- Vite config uses `vinext()` + `nitro()`
- Vercel build command: `vite build`
- Vercel output directory: `.output`
- Tailwind import/plugin removed because the app uses custom CSS classes and the unused Tailwind import caused the Vercel CSS build failure
- Duplicate work folder removed from the distribution ZIP

The original project still contains Cloudflare-specific source files under `db/` and `worker/`, but they are not imported by the Vercel app routes audited here. They were left intact to avoid deleting unrelated project code.
