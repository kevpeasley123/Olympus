import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 31420,
    strictPort: true,
    fs: {
      // Worktrees may share dependencies through a directory junction.
      allow: [resolve("."), realpathSync("node_modules")],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/output/**", "**/*.sqlite", "**/*.sqlite3"]
    }
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2020",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: Boolean(process.env.TAURI_DEBUG)
  }
});
