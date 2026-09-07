import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The proof has no RUN host, credentials, or model connection.
export default defineConfig({
  plugins: [
    react(),
    {
      name: "proof-entry",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== "/") return next();
          response.writeHead(302, { Location: "/proof.html" });
          response.end();
        });
      },
    },
  ],
  base: "./",
  cacheDir: "node_modules/.vite-proof",
  esbuild: { target: "es2022" },
  optimizeDeps: {
    entries: ["proof.html", "scene.html", "play.html"],
    esbuildOptions: { target: "es2022" },
  },
  build: {
    target: "es2022",
    outDir: "dist-proof",
    rollupOptions: { input: ["proof.html", "scene.html", "play.html"] },
  },
  server: {
    host: "127.0.0.1",
    port: 4320,
    strictPort: true,
    fs: { allow: [".", "../../tools/dither-kit"] },
  },
});
