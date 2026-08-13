# Vercel deployment

Use these project settings:

- Root Directory: `frontend` (only if this folder lives under a repo root)
- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `.output`
- Install Command: `npm install`

Environment variable:

- `API_BASE_URL=https://ai-interview-web-sy7e.onrender.com`

If Vercel previously cached a failed build, redeploy with build cache disabled/cleared.
