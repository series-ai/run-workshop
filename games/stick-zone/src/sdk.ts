/**
 * @file sdk.ts
 * Pure first-party RUN platform SDK accessor and lifecycle integration.
 * Zero custom backend servers. Zero raw fetch calls.
 */

let cachedApi: any = null;

export function getRundotGameApi(): any {
  if (cachedApi) return cachedApi;
  if (typeof window !== "undefined") {
    if ((window as any).RundotGameAPI) {
      cachedApi = (window as any).RundotGameAPI;
      return cachedApi;
    }
  }
  if (typeof globalThis !== "undefined" && (globalThis as any).RundotGameAPI) {
    return (globalThis as any).RundotGameAPI;
  }
  return null;
}
