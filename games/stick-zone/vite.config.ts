import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// @ts-ignore
import { createStickZoneServer } from "./scripts/server.mjs";

export function setupMultiplayerAndSettlement(server: any, customSettlement?: any) {
  const httpServer = server.httpServer;
  const stickServer = createStickZoneServer(customSettlement, httpServer);
  const handler = (stickServer as any).requestHandler;

  const endpoints = [
    "/api/settlement/active-raid",
    "/api/settlement/join",
    "/api/settlement/loot",
    "/api/settlement/hold",
    "/api/settlement/commit",
    "/api/settlement/verify-receipt",
    "/api/settlement/kia",
    "/api/settlement/corridor-status",
  ];

  for (const ep of endpoints) {
    server.middlewares.use(ep, (req: any, res: any, next: any) => {
      req.url = req.originalUrl || ep;
      handler(req, res);
    });
  }

  // Mount settlement API middleware preserving original URL against Connect prefix stripping
  server.middlewares.use((req: any, res: any, next: any) => {
    const rawUrl = req.originalUrl || req.url;
    if (rawUrl && rawUrl.startsWith("/api/settlement")) {
      req.url = rawUrl;
      handler(req, res);
    } else if (typeof next === "function") {
      next();
    }
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "stick-zone-multiplayer-relay",
      configurePreviewServer(server: any) {
        setupMultiplayerAndSettlement(server);
      },
      configureServer(server: any) {
        setupMultiplayerAndSettlement(server);
      },
    },
  ],
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
