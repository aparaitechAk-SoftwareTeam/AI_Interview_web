# Vercel Deployment

This project is configured for Vinext + Vite + Nitro on Vercel.

## Vercel settings

- Root Directory: the folder containing this `package.json` (use `frontend` if the repo root is one level above)
- Framework Preset: Other / auto (the included `vercel.json` sets `framework` to `null`)
- Build Command: `npm run build`
- Output Directory: `.output`
- Node.js: 22.x or newer

## Environment variable

Optional, because the app already has the current Render backend as a fallback:

`API_BASE_URL=https://ai-interview-web-sy7e.onrender.com`

Add it in Vercel Project Settings > Environment Variables if you want the backend URL controlled from Vercel.

## What was changed

- `vite.config.ts`: switched from the Cloudflare Vite adapter to Nitro.
- `package.json`: build now runs `vite build`; Nitro was added.
- `vercel.json`: Vercel build/output settings included in the project.
- Existing application routes and `/api/backend` proxy were left intact.
