import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Standard Vite configuration for Stick Zone: Exfil.
 * Stick Zone is a client game running on RUN.game / Venus platform infrastructure.
 * Zero custom backend servers. All room coordination and settlement run via
 * @series-inc/rundot-syncplay and @series-inc/rundot-synchub.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
  },
  server: {
    port: 5196,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 4196,
    strictPort: true,
    host: true,
  },
});
