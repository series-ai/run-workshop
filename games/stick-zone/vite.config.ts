import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rundotGameLibrariesPlugin } from "@series-inc/rundot-game-sdk/vite";
import path from "path";

/**
 * Standard Vite configuration for Stick Zone: Exfil.
 * Stick Zone is a client game running on RUN.game / Venus platform infrastructure.
 * Zero custom backend servers. All room coordination and settlement run via
 * @series-inc/rundot-syncplay and @series-inc/rundot-synchub.
 */
export default defineConfig({
  plugins: [react(), rundotGameLibrariesPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "three", "@react-three/fiber"],
  },
  optimizeDeps: {
    exclude: ["@series-inc/rundot-game-sdk"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
  },
  server: {
    port: 58392,
    strictPort: false,
    host: true,
  },
  preview: {
    port: 48392,
    strictPort: false,
    host: true,
  },
});
