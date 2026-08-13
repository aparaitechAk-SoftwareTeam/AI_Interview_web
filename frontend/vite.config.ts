import { defineConfig } from "vite";
import vinext from "vinext";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// Vercel-ready Vinext build:
// - vinext: Next.js-compatible app on Vite
// - @tailwindcss/vite: resolves `@import "tailwindcss"` correctly in Vite
// - nitro: adapts server/API routes for Vercel
export default defineConfig({
  plugins: [vinext(), tailwindcss(), nitro()],
});
