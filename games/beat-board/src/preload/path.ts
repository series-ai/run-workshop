export function isExternalAssetUrl(path: string): boolean {
  return /^https?:\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:');
}

export function hasAssetExtension(path: string): boolean {
  return /\.[a-z0-9]+$/i.test(path);
}

export function normalizeAssetPath(path: string): string {
  if (!path) {
    return '';
  }

  return path
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/^blob:/i, 'blob:')
    .replace(/^data:/i, 'data:')
    .replace(/^\/+/, '')
    .replace(/^cdn-assets\//, '');
}

export function applyDefaultAssetExtension(path: string): string {
  if (!path || isExternalAssetUrl(path) || hasAssetExtension(path)) {
    return path;
  }

  return `${path}.png`;
}

export function toHttpAssetPath(path: string): string {
  if (!path) {
    return '';
  }

  if (isExternalAssetUrl(path)) {
    return path;
  }

  const normalized = applyDefaultAssetExtension(normalizeAssetPath(path));
  if (!normalized) {
    return '';
  }

  return `/${['cdn-assets', normalized].join('/')}`.replace(/\/{2,}/g, '/');
}

export function toSdkAssetPath(path: string): string {
  if (!path) {
    return '';
  }

  if (isExternalAssetUrl(path)) {
    return path;
  }

  return applyDefaultAssetExtension(normalizeAssetPath(path));
}
