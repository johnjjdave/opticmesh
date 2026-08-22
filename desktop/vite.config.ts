import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: __dirname,
  base: "./",
  publicDir: resolve(__dirname, "../public"),
  plugins: [react()],
  css: { postcss: { plugins: [] } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssMinify: false,
  },
});
