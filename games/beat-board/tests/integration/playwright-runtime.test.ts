import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolvePlaywrightRuntime } from '../../e2e/playwright/runtime';

const tempDirs: string[] = [];

function createProjectFixture(options: { withDist?: boolean } = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'game-bot-playwright-runtime-'));
  tempDirs.push(dir);
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'playwright-runtime-fixture' }, null, 2),
    'utf8',
  );
  if (options.withDist) {
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist', 'index.html'), '<!doctype html>', 'utf8');
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolvePlaywrightRuntime', () => {
  it('defaults local runs to the dev server with mobile and desktop projects', () => {
    const projectDir = createProjectFixture();

    const runtime = resolvePlaywrightRuntime({
      projectDir,
      env: {},
      devCommand: 'npm run dev -- --host 127.0.0.1 --port 4301',
    });

    expect(runtime.serverMode).toBe('dev');
    expect(runtime.baseURL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(runtime.projects.map((project) => project.name)).toEqual([
      'mobile-chromium',
      'desktop-chromium',
      'walkthrough',
    ]);
    expect(runtime.grepInvert).toEqual(/@triage|@walkthrough/);
  });

  it('requires a built artifact for preview-backed runs', () => {
    const projectDir = createProjectFixture();

    expect(() =>
      resolvePlaywrightRuntime({
        projectDir,
        env: { E2E_SERVER_MODE: 'preview' },
        devCommand: 'npm run dev',
      }),
    ).toThrow(/Built artifact missing/);
  });

  it('uses the built artifact preview server when dist exists', () => {
    const projectDir = createProjectFixture({ withDist: true });

    const runtime = resolvePlaywrightRuntime({
      projectDir,
      env: { E2E_SERVER_MODE: 'preview' },
      devCommand: 'npm run dev',
    });

    expect(runtime.serverMode).toBe('preview');
    expect(runtime.webServer?.command).toContain('npm run preview');
    expect(runtime.webServer?.reuseExistingServer).toBe(true);
  });

  it('rejects local-only filters against remote base URLs', () => {
    const projectDir = createProjectFixture({ withDist: true });

    expect(() =>
      resolvePlaywrightRuntime({
        projectDir,
        env: {
          BASE_URL: 'https://example.com',
          PLAYWRIGHT_TEST_FILTER: 'full',
        },
        devCommand: 'npm run dev',
      }),
    ).toThrow(/local-only/);
  });

  it('allows remote-safe smoke runs against remote base URLs', () => {
    const projectDir = createProjectFixture({ withDist: true });

    const runtime = resolvePlaywrightRuntime({
      projectDir,
      env: {
        BASE_URL: 'https://example.com',
        PLAYWRIGHT_TEST_FILTER: 'smoke',
      },
      devCommand: 'npm run dev',
    });

    expect(runtime.serverMode).toBe('external');
    expect(runtime.suiteSafety).toBe('remote-safe');
    expect(runtime.projects).toHaveLength(2);
    expect(runtime.projects).toEqual([
      expect.objectContaining({
        name: 'mobile-chromium',
        grep: /@smoke/,
      }),
      expect.objectContaining({
        name: 'desktop-chromium',
        grep: /@smoke/,
      }),
    ]);
    expect(runtime.grep).toEqual(/@smoke/);
  });

  it('scopes responsive runs to the phone-layout proof surface', () => {
    const projectDir = createProjectFixture({ withDist: true });

    const runtime = resolvePlaywrightRuntime({
      projectDir,
      env: {
        E2E_SERVER_MODE: 'preview',
        PLAYWRIGHT_TEST_FILTER: 'responsive',
      },
      devCommand: 'npm run dev',
    });

    expect(runtime.projects).toEqual([
      expect.objectContaining({
        name: 'mobile-chromium',
        grep: /@responsive/,
      }),
    ]);
    expect(runtime.grep).toEqual(/@responsive/);
  });

  it('selects the walkthrough project and device override', () => {
    const projectDir = createProjectFixture({ withDist: true });

    const runtime = resolvePlaywrightRuntime({
      projectDir,
      env: {
        E2E_SERVER_MODE: 'preview',
        PLAYWRIGHT_TEST_FILTER: 'walkthrough',
        WALKTHROUGH_DEVICE: 'desktop',
      },
      devCommand: 'npm run dev',
    });

    expect(runtime.projects).toHaveLength(1);
    expect(runtime.projects[0]).toMatchObject({
      name: 'walkthrough',
      deviceName: 'Desktop Chrome',
      videoMode: 'on',
    });
  });
});
