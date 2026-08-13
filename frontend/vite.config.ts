import { defineConfig } from "vite";
import vinext from "vinext";
import { nitro } from "nitro/vite";

// Vercel / non-Cloudflare deployment:
// Vinext runs the Next.js-compatible app on Vite and Nitro adapts the
// server-side routes (including app/api/* route handlers) to Vercel.
export default defineConfig({
  plugins: [vinext(), nitro()],
});
