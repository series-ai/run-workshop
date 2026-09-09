import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  rundotGameLibrariesPlugin,
  rundotGamePlaygroundPlugin,
} from '@series-inc/rundot-game-sdk/vite';
import fs from 'node:fs';
import path from 'node:path';

function conversationLoggerPlugin(): Plugin {
  return {
    name: 'conversation-logger',
    configureServer(server) {
      server.middlewares.use('/_log_conversation', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const logFile = path.resolve(__dirname, 'conversation.log');
              const entry = `[${data.timestamp}] [${data.type}] ${
                typeof data.data === 'string'
                  ? data.data
                  : JSON.stringify(data.data)
              }\n`;
              fs.appendFileSync(logFile, entry);
              res.statusCode = 200;
              res.end('ok');
            } catch (err) {
              res.statusCode = 500;
              res.end(String(err));
            }
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    conversationLoggerPlugin(),
    rundotGameLibrariesPlugin(),
    rundotGamePlaygroundPlugin(),
  ],
  base: './',
  esbuild: { target: 'es2022' },
  optimizeDeps: {
    esbuildOptions: { target: 'es2022' },
    exclude: ['@series-inc/rundot-game-sdk'],
  },
  build: { target: 'es2022' },
  server: {
    host: '127.0.0.1',
    port: 4318,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '.getbb.app'],
    fs: { allow: ['.', '../../tools/dither-kit'] },
  },
});
