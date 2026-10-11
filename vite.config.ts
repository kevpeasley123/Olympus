import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

export default defineConfig({
  // Linked worktrees may share node_modules but must not invalidate each
  // other's dependency optimizer cache while their preview servers run.
  cacheDir: resolve("node_modules", `.vite-${createHash("sha256").update(resolve(".")).digest("hex").slice(0, 12)}`),
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
