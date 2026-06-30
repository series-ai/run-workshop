import fs from 'fs';
import path from 'path';
import { resolveDevBindHost, resolveDevPort, resolveLocalDevBaseUrl } from '../../dev-server.config';

type EnvMap = Record<string, string | undefined>;

export type E2ETestFilter =
  | 'full'
  | 'smoke'
  | 'mobile'
  | 'desktop'
  | 'responsive'
  | 'walkthrough'
  | 'triage';

export type E2EServerMode = 'dev' | 'preview' | 'external';
export type E2ESuiteSafety = 'remote-safe' | 'local-only';

interface ResolveRuntimeOptions {
  projectDir: string;
  env?: EnvMap;
  devCommand: string;
  reuseExistingDevServer?: boolean;
}

interface RuntimeProjectDefinition {
  name: 'mobile-chromium' | 'desktop-chromium' | 'walkthrough';
  deviceName: string;
  grep: RegExp;
  videoMode?: 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';
}

interface RuntimeWebServer {
  command: string;
  reuseExistingServer: boolean;
}

export interface PlaywrightRuntimeConfig {
  baseURL: string;
  serverMode: E2EServerMode;
  testFilter: E2ETestFilter;
  suiteSafety: E2ESuiteSafety;
  isRemoteBaseUrl: boolean;
  grep?: RegExp;
  grepInvert?: RegExp;
  videoMode: 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';
  walkthroughDeviceName: string;
  projects: RuntimeProjectDefinition[];
  webServer?: RuntimeWebServer;
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0']);
const WALKTHROUGH_DEVICE_ALIASES: Record<string, string> = {
  mobile: 'iPhone 13',
  'iphone-13': 'iPhone 13',
  iphone13: 'iPhone 13',
  desktop: 'Desktop Chrome',
  'desktop-chrome': 'Desktop Chrome',
  desktopchrome: 'Desktop Chrome',
};

function normalizeFilter(value: string | undefined): E2ETestFilter {
  switch (value?.trim().toLowerCase()) {
    case undefined:
    case '':
    case 'full':
      return 'full';
    case 'smoke':
    case 'mobile':
    case 'desktop':
    case 'responsive':
    case 'walkthrough':
    case 'triage':
      return value.trim().toLowerCase() as E2ETestFilter;
    default:
      throw new Error(
        `Unsupported PLAYWRIGHT_TEST_FILTER="${value}". Expected one of: full, smoke, mobile, desktop, responsive, walkthrough, triage.`,
      );
  }
}

function normalizeVideoMode(
  value: string | undefined,
): 'off' | 'on' | 'retain-on-failure' | 'on-first-retry' {
  switch (value?.trim().toLowerCase()) {
    case undefined:
    case '':
      return 'retain-on-failure';
    case 'off':
    case 'on':
    case 'retain-on-failure':
    case 'on-first-retry':
      return value.trim().toLowerCase() as 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';
    default:
      throw new Error(
        `Unsupported PLAYWRIGHT_VIDEO_MODE="${value}". Expected one of: off, on, retain-on-failure, on-first-retry.`,
      );
  }
}

function resolveWalkthroughDevice(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return 'iPhone 13';
  }
  return WALKTHROUGH_DEVICE_ALIASES[normalized] ?? value!.trim();
}

function isRemoteBaseUrl(baseURL: string): boolean {
  try {
    const hostname = new URL(baseURL).hostname;
    return !LOCAL_HOSTS.has(hostname);
  } catch {
    throw new Error(`Invalid BASE_URL "${baseURL}". Expected a fully-qualified http(s) URL.`);
  }
}

function resolveServerMode(hasBaseUrlOverride: boolean, env: EnvMap): E2EServerMode {
  if (hasBaseUrlOverride) {
    return 'external';
  }

  const requested = env.E2E_SERVER_MODE?.trim().toLowerCase();
  if (requested === 'dev' || requested === 'preview') {
    return requested;
  }

  if (requested) {
    throw new Error(
      `Unsupported E2E_SERVER_MODE="${env.E2E_SERVER_MODE}". Expected "dev" or "preview".`,
    );
  }

  return env.CI ? 'preview' : 'dev';
}

function ensurePreviewArtifact(projectDir: string): void {
  const distIndexPath = path.join(projectDir, 'dist', 'index.html');
  if (!fs.existsSync(distIndexPath)) {
    throw new Error(
      `Built artifact missing at ${distIndexPath}. Run "npm run build" before preview-backed Playwright runs, or provide BASE_URL.`,
    );
  }
}

function resolveSuiteSafety(testFilter: E2ETestFilter): E2ESuiteSafety {
  switch (testFilter) {
    case 'smoke':
    case 'walkthrough':
      return 'remote-safe';
    default:
      return 'local-only';
  }
}

function resolveFilterGrep(
  testFilter: E2ETestFilter,
): Pick<PlaywrightRuntimeConfig, 'grep' | 'grepInvert'> {
  switch (testFilter) {
    case 'full':
      return { grepInvert: /@triage|@walkthrough/ };
    case 'smoke':
      return { grep: /@smoke/ };
    case 'mobile':
      return { grep: /@smoke|@mobile|@responsive/ };
    case 'desktop':
      return { grep: /@smoke|@desktop|@responsive/ };
    case 'responsive':
      return { grep: /@responsive/ };
    case 'walkthrough':
      return { grep: /@walkthrough/ };
    case 'triage':
      return { grep: /@triage/ };
  }
}

function resolveProjects(testFilter: E2ETestFilter, walkthroughDeviceName: string): RuntimeProjectDefinition[] {
  const mobileProject: RuntimeProjectDefinition = {
    name: 'mobile-chromium',
    deviceName: 'iPhone 13',
    grep: /@smoke|@mobile|@responsive/,
  };
  const desktopProject: RuntimeProjectDefinition = {
    name: 'desktop-chromium',
    deviceName: 'Desktop Chrome',
    grep: /@smoke|@desktop|@responsive|@triage/,
  };
  const walkthroughProject: RuntimeProjectDefinition = {
    name: 'walkthrough',
    deviceName: walkthroughDeviceName,
    grep: /@walkthrough/,
    videoMode: 'on',
  };

  switch (testFilter) {
    case 'smoke':
      return [
        {
          ...mobileProject,
          grep: /@smoke/,
        },
        {
          ...desktopProject,
          grep: /@smoke/,
        },
      ];
    case 'mobile':
      return [mobileProject];
    case 'desktop':
      return [desktopProject];
    case 'responsive':
      return [
        {
          ...mobileProject,
          grep: /@responsive/,
        },
      ];
    case 'triage':
      return [
        {
          ...desktopProject,
          grep: /@triage/,
        },
      ];
    case 'walkthrough':
      return [walkthroughProject];
    default:
      return [mobileProject, desktopProject, walkthroughProject];
  }
}

export function resolvePlaywrightRuntime({
  projectDir,
  env = process.env,
  devCommand,
  reuseExistingDevServer = true,
}: ResolveRuntimeOptions): PlaywrightRuntimeConfig {
  const baseUrlOverride = env.BASE_URL?.trim();
  const testFilter = normalizeFilter(env.PLAYWRIGHT_TEST_FILTER);
  const videoMode = normalizeVideoMode(env.PLAYWRIGHT_VIDEO_MODE);
  const walkthroughDeviceName = resolveWalkthroughDevice(env.WALKTHROUGH_DEVICE);
  const serverMode = resolveServerMode(Boolean(baseUrlOverride), env);
  const devHost = resolveDevBindHost(env);
  const devPort = resolveDevPort(projectDir, env);

  const baseURL =
    serverMode === 'external' && baseUrlOverride
      ? baseUrlOverride
      : resolveLocalDevBaseUrl(projectDir, env);
  const remoteBaseUrl = isRemoteBaseUrl(baseURL);
  const suiteSafety = resolveSuiteSafety(testFilter);

  if (remoteBaseUrl && suiteSafety !== 'remote-safe') {
    throw new Error(
      `PLAYWRIGHT_TEST_FILTER="${testFilter}" is classified as local-only and cannot run against remote BASE_URL=${baseURL}. Use smoke or walkthrough, or point BASE_URL at a local server.`,
    );
  }

  let webServer: RuntimeWebServer | undefined;
  if (serverMode === 'dev') {
    webServer = {
      command: devCommand,
      reuseExistingServer: reuseExistingDevServer,
    };
  } else if (serverMode === 'preview') {
    ensurePreviewArtifact(projectDir);
    webServer = {
      command: `npm run preview -- --host ${devHost} --port ${devPort} --strictPort`,
      reuseExistingServer: !env.CI,
    };
  }

  return {
    baseURL,
    serverMode,
    testFilter,
    suiteSafety,
    isRemoteBaseUrl: remoteBaseUrl,
    ...resolveFilterGrep(testFilter),
    videoMode,
    walkthroughDeviceName,
    projects: resolveProjects(testFilter, walkthroughDeviceName),
    webServer,
  };
}
