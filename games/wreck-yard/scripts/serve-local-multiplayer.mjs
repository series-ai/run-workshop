#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { rundotGameLibrariesPlugin, rundotMultiplayerPlugin } from '@series-inc/rundot-game-sdk/vite';
import { DevSyncplayAuthorityRoom } from '@series-inc/rundot-syncplay/node';

function port(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error(`Invalid ${name}.`);
  return value;
}

const root = fileURLToPath(new URL('../', import.meta.url));
const httpPort = port('WRECK_YARD_PORT', 4398);
const roomPort = port('WRECK_YARD_ROOM_PORT', 4399);
if (httpPort === roomPort) throw new Error('The game and room server need different ports.');

// The local authority has no playground plugin or server upload path.
const server = await createServer({
  root,
  configFile: false,
  plugins: [
    react(),
    rundotGameLibrariesPlugin(),
    rundotMultiplayerPlugin({
      configPath: 'rundot/realtime.config.json',
      devPort: roomPort,
      deterministicRoomClass: DevSyncplayAuthorityRoom,
    }),
  ],
  esbuild: { target: 'es2022' },
  optimizeDeps: { esbuildOptions: { target: 'es2022' }, exclude: ['@series-inc/rundot-game-sdk'] },
  server: { host: '127.0.0.1', port: httpPort, strictPort: true, fs: { allow: [root, fileURLToPath(new URL('../../../tools/voxel-kit', import.meta.url))] } },
});
await server.listen();
server.printUrls();
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
