import { createServer } from "vite";
import react from "@vitejs/plugin-react";
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  plugins: [react()],
  esbuild: { target: "es2022" },
  optimizeDeps: { esbuildOptions: { target: "es2022" } },
  server: {
    host: "127.0.0.1",
    hmr: false,
    port: 4402,
    strictPort: true,
    fs: { allow: [".", "../../tools/voxel-kit"] },
  },
});
await server.listen();
server.printUrls();
