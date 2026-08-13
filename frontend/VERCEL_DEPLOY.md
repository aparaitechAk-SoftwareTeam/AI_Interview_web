# Vercel deployment

Project settings:

- Root Directory: `frontend` only when this folder is inside a larger repository. If this folder itself is the repository root, leave Root Directory blank.
- Framework Preset: Other
- Build Command: `vite build`
- Output Directory: `.output`
- Install Command: `npm install`

Environment variable:

- `API_BASE_URL=https://ai-interview-web-sy7e.onrender.com`

The project uses vinext with Nitro. Nitro auto-detects Vercel in Vercel CI.

Important: this UI uses custom CSS, not Tailwind utilities. Tailwind was intentionally removed because `@import "tailwindcss"` was being processed as a file import during the Vercel RSC build and caused the ENOENT build failure.
