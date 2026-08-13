# Vercel deployment

Use these settings in Vercel:

- Root Directory: `frontend` (only when this folder is inside a larger repository)
- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `.output`
- Install Command: `npm install`

Environment variable:

- `API_BASE_URL=https://ai-interview-web-sy7e.onrender.com`

This project uses Vinext + Vite + Tailwind's Vite plugin + Nitro.
