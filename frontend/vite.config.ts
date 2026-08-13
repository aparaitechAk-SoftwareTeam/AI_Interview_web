import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { nitro } from "nitro/vite";

// IMPORTANT: Tailwind must run before vinext/RSC so `@import "tailwindcss"`
// is consumed by the Tailwind Vite plugin before Vite's CSS import resolver.
export default defineConfig({
  plugins: [
    tailwindcss(),
    vinext(),
    nitro(),
  ],
});
