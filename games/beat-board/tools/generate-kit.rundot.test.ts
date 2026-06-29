import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

vi.mock('node:child_process', () => {
  const mockSpawnSync = vi.fn();
  return { spawnSync: mockSpawnSync, default: { spawnSync: mockSpawnSync } };
});

import { resolveGameId, runRundotGenerate } from './generate-kit';

const spawnSyncMock = vi.mocked(spawnSync);

type ManifestItem = Parameters<typeof runRundotGenerate>[0];
type DispatchPlan = Parameters<typeof runRundotGenerate>[1];

let tmpDir: string;

function rawPathFor(file: string): string {
  return join(tmpDir, file);
}

function lastArgs(): string[] {
  const call = spawnSyncMock.mock.calls.at(-1);
  if (!call) throw new Error('spawnSync was not called');
  return call[1] as string[];
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'beatboard-rundot-'));
  spawnSyncMock.mockReset();
  // Default: pretend rundot succeeded. `runRundotGenerate` then checks
  // existsSync(rawOutPath); since the mock never writes the file the
  // result is ok:false, but every test here asserts on dispatch args,
  // not on the post-write existence check.
  spawnSyncMock.mockReturnValue({
    status: 0,
    stdout: '{}',
    stderr: '',
    pid: 1,
    output: [],
    signal: null,
  } as ReturnType<typeof spawnSync>);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('runRundotGenerate dispatch', () => {
  it('routes a music item to `rundot generate music` with --duration', () => {
    const item: ManifestItem = { file: 'drums-1.mp3', kind: 'drum', prompt: 'lofi drums' };
    const plan: DispatchPlan = { audioType: 'music', rawDur: 40, trimSec: 22.8 };
    const out = rawPathFor('drums-1.mp3');

    runRundotGenerate(item, plan, out, undefined);

    const args = lastArgs();
    expect(spawnSyncMock.mock.calls.at(-1)?.[0]).toBe('rundot');
    expect(args.slice(0, 2)).toEqual(['generate', 'music']);
    expect(args).toEqual(
      expect.arrayContaining(['--prompt', 'lofi drums', '--duration', '40', '--out', out, '--json']),
    );
    expect(args).not.toContain('--game-id');
  });

  it('routes a vocal item to `rundot generate tts` with --text and --voice-id', () => {
    const item: ManifestItem = {
      file: 'vocals-A-0.mp3',
      kind: 'vocal',
      prompt: 'oh yeah',
      voiceId: 'voice-123',
    };
    const plan: DispatchPlan = { audioType: 'voice', rawDur: 40, trimSec: 22.8 };
    const out = rawPathFor('vocals-A-0.mp3');

    runRundotGenerate(item, plan, out, undefined);

    const args = lastArgs();
    expect(args.slice(0, 2)).toEqual(['generate', 'tts']);
    expect(args).toEqual(
      expect.arrayContaining(['--text', 'oh yeah', '--voice-id', 'voice-123', '--out', out, '--json']),
    );
    expect(args).not.toContain('--duration');
  });

  it('fails a vocal item that is missing a voiceId without dispatching', () => {
    const item: ManifestItem = { file: 'vocals-A-0.mp3', kind: 'vocal', prompt: 'oh yeah' };
    const plan: DispatchPlan = { audioType: 'voice', rawDur: 40, trimSec: 22.8 };

    const result = runRundotGenerate(item, plan, rawPathFor('vocals-A-0.mp3'), undefined);

    expect(result.ok).toBe(false);
    expect(result.errorLog).toMatch(/voiceId/);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it('routes an sfx one-shot to `rundot generate sfx` with --description', () => {
    const item: ManifestItem = { file: 'fx-1.mp3', kind: 'oneShot', type: 'sfx', prompt: 'snare roll' };
    const plan: DispatchPlan = { audioType: 'sfx', rawDur: 6, trimSec: 1 };
    const out = rawPathFor('fx-1.mp3');

    runRundotGenerate(item, plan, out, undefined);

    const args = lastArgs();
    expect(args.slice(0, 2)).toEqual(['generate', 'sfx']);
    expect(args).toEqual(
      expect.arrayContaining(['--description', 'snare roll', '--duration', '6', '--out', out, '--json']),
    );
    expect(args).not.toContain('--prompt');
  });

  it('passes --game-id when a sandbox game id is provided', () => {
    const item: ManifestItem = { file: 'drums-1.mp3', kind: 'drum', prompt: 'lofi drums' };
    const plan: DispatchPlan = { audioType: 'music', rawDur: 40, trimSec: 22.8 };

    runRundotGenerate(item, plan, rawPathFor('drums-1.mp3'), 'game-abc');

    const args = lastArgs();
    expect(args).toEqual(expect.arrayContaining(['--game-id', 'game-abc']));
  });
});

describe('resolveGameId', () => {
  it('returns the trimmed RUNDOT_SANDBOX_GAME_ID when set', () => {
    expect(resolveGameId({ RUNDOT_SANDBOX_GAME_ID: '  game-xyz  ' })).toBe('game-xyz');
  });

  it('returns undefined when the env var is empty or absent', () => {
    expect(resolveGameId({ RUNDOT_SANDBOX_GAME_ID: '   ' })).toBeUndefined();
    expect(resolveGameId({})).toBeUndefined();
  });
});
