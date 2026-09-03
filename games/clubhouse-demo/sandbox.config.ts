import fs from 'fs';
import path from 'path';

type EnvMap = Record<string, string | undefined>

/**
 * Resolution order for the playground game ID:
 * 1. RUNDOT_SANDBOX_GAME_ID env var (CI override)
 * 2. local game.config.playground.json (written by the plugin on first run)
 * 3. local game.config.prod.json (written by `rundot init`)
 * 4. undefined — the playground plugin will auto-register the game
 */
const SANDBOX_GAME_CONFIG_FILES = [
  'game.config.playground.json',
  'game.config.prod.json',
] as const;

interface SandboxGameConfig {
  gameId?: unknown;
}

function readGameId(configPath: string): string | undefined {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as SandboxGameConfig;
    const gameId = typeof parsed.gameId === 'string' ? parsed.gameId.trim() : '';
    return gameId.length > 0 ? gameId : undefined;
  } catch {
    return undefined;
  }
}

export function resolveSandboxGameId(
  projectRoot: string,
  env: EnvMap = process.env,
): string | undefined {
  const envGameId = env.RUNDOT_SANDBOX_GAME_ID?.trim()
  if (envGameId) {
    return envGameId
  }

  for (const filename of SANDBOX_GAME_CONFIG_FILES) {
    const gameId = readGameId(path.join(projectRoot, filename));
    if (gameId) {
      return gameId;
    }
  }

  return undefined;
}
