export interface GraphDifference {
  readonly path: string;
  readonly rule: string;
  readonly expected: string;
  readonly actual: string;
}

export interface GraphComparison {
  readonly equal: boolean;
  readonly differences: readonly GraphDifference[];
  readonly objects: number;
  readonly scalarValues: number;
  readonly comparedBytes: number;
  readonly sharedReferences: number;
}

const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype);
function intrinsic<T>(prototype: object, key: string, value: object): T {
  return Object.getOwnPropertyDescriptor(prototype, key)!.get!.call(value) as T;
}
function viewParts(value: ArrayBufferView): { buffer: ArrayBuffer; offset: number; length: number } {
  const prototype = value instanceof DataView ? DataView.prototype : typedPrototype;
  return { buffer: intrinsic(prototype, 'buffer', value),
    offset: intrinsic(prototype, 'byteOffset', value), length: intrinsic(prototype, 'byteLength', value) };
}

function display(value: unknown): string {
  if (typeof value === 'number') {
    const bytes = new ArrayBuffer(8);
    new DataView(bytes).setFloat64(0, value, false);
    const bits = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    return `${Object.is(value, -0) ? '-0' : String(value)} [f64:${bits}]`;
  }
  if (typeof value === 'symbol') return String(value);
  if (value === undefined) return 'undefined';
  if (typeof value === 'object' && value !== null) return Object.prototype.toString.call(value);
  return JSON.stringify(value) ?? String(value);
}

/** Compare the actual graph. Do not encode or normalize either input. */
export function compareCityGraphs(expected: unknown, actual: unknown, limit = 16): GraphComparison {
  const differences: GraphDifference[] = [];
  const forward = new Map<object, object>();
  const reverse = new Map<object, object>();
  let objects = 0, scalarValues = 0, comparedBytes = 0, sharedReferences = 0;
  const issue = (path: string, rule: string, left: unknown, right: unknown) => {
    if (differences.length < limit) differences.push({ path, rule, expected: display(left), actual: display(right) });
  };
  const bytes = (left: ArrayBuffer, right: ArrayBuffer, path: string) => {
    const leftLength = intrinsic<number>(ArrayBuffer.prototype, 'byteLength', left);
    const rightLength = intrinsic<number>(ArrayBuffer.prototype, 'byteLength', right);
    if (leftLength !== rightLength) {
      issue(path, 'buffer-length', leftLength, rightLength);
      return;
    }
    const a = new Uint8Array(left), b = new Uint8Array(right);
    comparedBytes += a.length;
    for (let index = 0; index < a.length; index += 1) {
      if (a[index] !== b[index]) { issue(`${path}[byte:${index}]`, 'buffer-byte', a[index], b[index]); break; }
    }
  };
  const visit = (left: unknown, right: unknown, path: string): void => {
    if (differences.length >= limit) return;
    if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
      scalarValues += 1;
      if (!Object.is(left, right) || (typeof left === 'number' && typeof right === 'number'
        && Number.isNaN(left) && Number.isNaN(right) && display(left) !== display(right))) {
        issue(path, 'scalar', left, right);
      }
      return;
    }
    const linked = forward.get(left), incoming = reverse.get(right);
    if (linked !== undefined || incoming !== undefined) {
      sharedReferences += 1;
      if (linked !== right || incoming !== left) issue(path, 'reference-alias', linked, right);
      return;
    }
    forward.set(left, right);
    reverse.set(right, left);
    objects += 1;
    if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) {
      issue(path, 'prototype', Object.getPrototypeOf(left), Object.getPrototypeOf(right));
      return;
    }
    for (const [name, query] of [
      ['extensible', Object.isExtensible], ['sealed', Object.isSealed], ['frozen', Object.isFrozen],
    ] as const) {
      if (query(left) !== query(right)) issue(path, name, query(left), query(right));
    }
    if (left instanceof ArrayBuffer && right instanceof ArrayBuffer) bytes(left, right, path);
    else if (ArrayBuffer.isView(left) && ArrayBuffer.isView(right)) {
      const a = viewParts(left), b = viewParts(right);
      if (a.offset !== b.offset) issue(path, 'view-offset', a.offset, b.offset);
      if (a.length !== b.length) issue(path, 'view-length', a.length, b.length);
      visit(a.buffer, b.buffer, `${path}.[[buffer]]`);
    } else if (left instanceof Map && right instanceof Map) {
      const a = intrinsic<number>(Map.prototype, 'size', left), b = intrinsic<number>(Map.prototype, 'size', right);
      if (a !== b) issue(path, 'map-size', a, b);
      const entries = Map.prototype.entries.call(right);
      let index = 0;
      for (const [key, value] of Map.prototype.entries.call(left)) {
        const other = entries.next();
        if (other.done) break;
        visit(key, other.value[0], `${path}.map[${index}].key`);
        visit(value, other.value[1], `${path}.map[${index}].value`);
        index += 1;
      }
    } else if (left instanceof Set && right instanceof Set) {
      const a = intrinsic<number>(Set.prototype, 'size', left), b = intrinsic<number>(Set.prototype, 'size', right);
      if (a !== b) issue(path, 'set-size', a, b);
      const entries = Set.prototype.values.call(right);
      let index = 0;
      for (const value of Set.prototype.values.call(left)) {
        const other = entries.next();
        if (other.done) break;
        visit(value, other.value, `${path}.set[${index++}]`);
      }
    } else if (!Array.isArray(left) && Object.getPrototypeOf(left) !== Object.prototype
      && Object.getPrototypeOf(left) !== null) {
      issue(path, 'unsupported-object', left, right);
      return;
    }
    const leftKeys = Reflect.ownKeys(left), rightKeys = Reflect.ownKeys(right);
    if (leftKeys.length !== rightKeys.length) issue(path, 'property-count', leftKeys.length, rightKeys.length);
    for (let index = 0; index < leftKeys.length; index += 1) {
      const key = leftKeys[index]!;
      if (key !== rightKeys[index]) {
        issue(`${path}.keys[${index}]`, 'property-order', key, rightKeys[index]);
        continue;
      }
      const a = Object.getOwnPropertyDescriptor(left, key)!;
      const b = Object.getOwnPropertyDescriptor(right, key)!;
      const child = `${path}.${String(key)}`;
      for (const flag of ['enumerable', 'configurable', 'writable'] as const) {
        if (a[flag] !== b[flag]) issue(child, `descriptor-${flag}`, a[flag], b[flag]);
      }
      if (('value' in a) !== ('value' in b)) issue(child, 'descriptor-kind', 'value' in a, 'value' in b);
      if ('value' in a && 'value' in b) {
        // Typed values are already checked as bytes, including NaN payloads.
        if (!(ArrayBuffer.isView(left) && typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key))) {
          visit(a.value, b.value, child);
        }
      } else {
        if (a.get !== b.get || a.set !== b.set) issue(child, 'accessor-identity', a.get, b.get);
      }
    }
  };
  visit(expected, actual, '$');
  return { equal: differences.length === 0, differences, objects, scalarValues, comparedBytes, sharedReferences };
}

/** Change one real field and preserve all other own-property flags. */
export function replaceGraphField<T extends object>(record: T, key: keyof T, value: unknown): T {
  const result = Object.create(Object.getPrototypeOf(record)) as T;
  for (const name of Reflect.ownKeys(record)) {
    const descriptor = Object.getOwnPropertyDescriptor(record, name)!;
    Object.defineProperty(result, name, name === key ? { ...descriptor, value } : descriptor);
  }
  if (!Object.isExtensible(record)) Object.preventExtensions(result);
  return result;
}
