import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  /**
   * Relative asset paths, so one build runs unchanged at a domain root, in the
   * subdirectory GitHub Pages serves from, and under any other prefix. The app
   * is a single page with no client-side routing, which is what makes this safe.
   */
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
});
