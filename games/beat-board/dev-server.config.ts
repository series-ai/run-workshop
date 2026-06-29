import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_DEV_BIND_HOST = '127.0.0.1';
const DEFAULT_DEV_CONNECT_HOST = '127.0.0.1';
const DEFAULT_DEV_PORT_BASE = 4300;
const DEFAULT_DEV_PORT_RANGE = 500;
const DEFAULT_MULTIPLAYER_DEV_PORT_BASE = DEFAULT_DEV_PORT_BASE + 1000;
const DEFAULT_MULTIPLAYER_DEV_PORT_RANGE = DEFAULT_DEV_PORT_RANGE;
const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));

type EnvMap = Record<string, string | undefined>;

function parsePort(value: unknown): number | null {
  const port = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    return null;
  }
  return port;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function computeDeterministicPort(projectKey: string, base: number, range: number): number {
  let hash = 0;
  for (const char of projectKey) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return base + (hash % range);
}

function computeDeterministicDevPort(projectKey: string): number {
  return computeDeterministicPort(projectKey, DEFAULT_DEV_PORT_BASE, DEFAULT_DEV_PORT_RANGE);
}

function computeDeterministicMultiplayerDevPort(projectKey: string): number {
  return computeDeterministicPort(
    projectKey,
    DEFAULT_MULTIPLAYER_DEV_PORT_BASE,
    DEFAULT_MULTIPLAYER_DEV_PORT_RANGE,
  );
}

function resolveProjectKey(projectDir: string): string {
  const packageJson = readJson<{ name?: unknown }>(path.join(projectDir, 'package.json'));
  if (typeof packageJson?.name === 'string' && packageJson.name.trim().length > 0) {
    return packageJson.name.trim();
  }
  return path.basename(projectDir);
}

export function resolveDevBindHost(env: EnvMap = process.env): string {
  return env.DEV_HOST?.trim() || DEFAULT_DEV_BIND_HOST;
}

export function resolveDevPort(projectDir = PROJECT_ROOT, env: EnvMap = process.env): number {
  const envPort = parsePort(env.DEV_PORT);
  if (envPort) {
    return envPort;
  }

  const status = readJson<{ dev_port?: unknown }>(path.join(projectDir, '.project', 'status.json'));
  const statusPort = parsePort(status?.dev_port);
  if (statusPort) {
    return statusPort;
  }

  return computeDeterministicDevPort(resolveProjectKey(projectDir));
}

export function resolveMultiplayerDevPort(projectDir = PROJECT_ROOT, env: EnvMap = process.env): number {
  const envPort = parsePort(env.MULTIPLAYER_DEV_PORT ?? env.RUNDOT_MULTIPLAYER_DEV_PORT);
  if (envPort) {
    return envPort;
  }

  const status = readJson<{ multiplayer_dev_port?: unknown }>(path.join(projectDir, '.project', 'status.json'));
  const statusPort = parsePort(status?.multiplayer_dev_port);
  if (statusPort) {
    return statusPort;
  }

  return computeDeterministicMultiplayerDevPort(resolveProjectKey(projectDir));
}

export function resolveLocalDevBaseUrl(projectDir = PROJECT_ROOT, env: EnvMap = process.env): string {
  return `http://${DEFAULT_DEV_CONNECT_HOST}:${resolveDevPort(projectDir, env)}`;
}
