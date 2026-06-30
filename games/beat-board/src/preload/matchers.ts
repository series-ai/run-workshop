import { normalizeAssetPath } from './path';

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function globToRegExp(glob: string): RegExp {
  const normalized = normalizeAssetPath(glob)
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '__SINGLE_STAR__');
  const escaped = escapeRegExp(normalized)
    .replace(/__DOUBLE_STAR__/g, '.*')
    .replace(/__SINGLE_STAR__/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

export function matchesGlob(path: string, glob: string): boolean {
  return globToRegExp(glob).test(normalizeAssetPath(path));
}

export function matchesAnyGlob(path: string, globs: string[]): boolean {
  return globs.some((glob) => matchesGlob(path, glob));
}
