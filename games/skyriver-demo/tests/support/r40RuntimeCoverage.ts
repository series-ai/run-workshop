import { Session } from 'node:inspector';

interface FunctionCoverage { readonly functionName: string; readonly ranges: readonly { readonly count: number }[]; }
interface ScriptCoverage { readonly url: string; readonly functions: readonly FunctionCoverage[]; }

/** Observe real V8 calls. Do not replace a city function. */
export async function measureCityCalls<T>(action: () => Promise<T>): Promise<{ value: T; calls: ReadonlyMap<string, number> }> {
  const session = new Session();
  session.connect();
  const post = (method: string, params: object = {}) => new Promise<unknown>((resolve, reject) => {
    session.post(method, params, (error, result) => error ? reject(error) : resolve(result));
  });
  try {
    await post('Profiler.enable');
    await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    const value = await action();
    const coverage = await post('Profiler.takePreciseCoverage') as { readonly result: readonly ScriptCoverage[] };
    const calls = new Map<string, number>();
    for (const script of coverage.result) {
      if (!script.url.includes('/src/render/city')) continue;
      for (const fn of script.functions) {
        calls.set(fn.functionName, (calls.get(fn.functionName) ?? 0) + (fn.ranges[0]?.count ?? 0));
      }
    }
    return { value, calls };
  } finally {
    await post('Profiler.stopPreciseCoverage').catch(() => {});
    await post('Profiler.disable').catch(() => {});
    session.disconnect();
  }
}
