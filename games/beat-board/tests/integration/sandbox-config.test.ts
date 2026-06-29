import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveSandboxGameId } from '../../sandbox.config';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-sandbox-config-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveSandboxGameId', () => {
  it('reads the sandbox game id from game.config.playground.json', () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, 'game.config.playground.json'),
      `${JSON.stringify({ gameId: 'playground-game-id' }, null, 2)}\n`,
      'utf8',
    );

    expect(resolveSandboxGameId(dir)).toBe('playground-game-id');
  });

  it('does not read from game.config.prod.json', () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, 'game.config.prod.json'),
      `${JSON.stringify({ gameId: 'prod-game-id' }, null, 2)}\n`,
      'utf8',
    );

    expect(resolveSandboxGameId(dir)).toBeUndefined();
  });

  it('allows a sandbox game ID override for automated browser verification', () => {
    const dir = makeTempDir();

    expect(resolveSandboxGameId(dir, { RUNDOT_SANDBOX_GAME_ID: 'playwright-game-id' })).toBe(
      'playwright-game-id',
    );
  });
});
