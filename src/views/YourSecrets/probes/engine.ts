import type { Probe } from './types';
import { bytes, hash } from './utils';

export const engineName = () => {
  try {
    return String((JSON.parse('null') as { x: number }).x);
  } catch (error) {
    const message = (error as Error).message;
    if (/^Cannot read properties of null/.test(message)) return 'V8';
    if (/is null$/.test(message)) return 'SpiderMonkey';
    if (/^null is not an object/.test(message)) return 'JavaScriptCore';
    return null;
  }
};

const ENGINES: Record<string, string> = {
  V8: 'V8, from Chromium',
  SpiderMonkey: 'SpiderMonkey, from Firefox',
  JavaScriptCore: 'JavaScriptCore, from WebKit',
};

const mathResults = () =>
  [
    Math.acos(0.123124234234234242),
    Math.acosh(1e308),
    Math.asin(0.123124234234234242),
    Math.asinh(1),
    Math.atanh(0.5),
    Math.atan(0.5),
    Math.sin(-1e300),
    Math.sinh(1),
    Math.cos(10.000000000123),
    Math.cosh(1),
    Math.tan(-1e300),
    Math.tanh(1),
    Math.exp(1),
    Math.expm1(1),
    Math.log1p(10),
    Math.pow(Math.PI, -100),
  ].map(String);

const stackDepth = () => {
  let depth = 0;
  const dive = (): void => {
    depth++;
    dive();
  };
  try {
    dive();
  } catch {}
  return depth;
};

const timerStep = () => {
  let smallest = Infinity;
  let last = performance.now();
  const end = last + 5;
  for (let t = last; t < end; t = performance.now()) {
    if (t !== last) {
      smallest = Math.min(smallest, t - last);
      last = t;
    }
  }
  return smallest;
};

const step = (ms: number) =>
  !Number.isFinite(ms)
    ? null
    : ms < 1
      ? `${Math.round(ms * 1000)} µs`
      : `${+ms.toFixed(2)} ms`;

const WASM: [string, () => boolean][] = [
  [
    'SIMD',
    () =>
      validate([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10,
        1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
      ]),
  ],
  [
    'relaxed SIMD',
    () =>
      validate([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15,
        1, 13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11,
      ]),
  ],
  [
    'tail calls',
    () =>
      validate([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 6, 1, 4,
        0, 18, 0, 11,
      ]),
  ],
  [
    'garbage collection',
    () => validate([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 95, 1, 120, 0]),
  ],
  [
    'exceptions',
    () =>
      validate([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 8, 1, 6,
        0, 6, 64, 25, 11, 11,
      ]),
  ],
  [
    'exnref',
    () =>
      compiles(
        Uint8Array.from(
          atob('AGFzbQEAAAABBAFgAAADAgEAChABDgACaR9AAQMAAAsACxoL'),
          (c) => c.charCodeAt(0)
        )
      ),
  ],
  ['memory64', () => validate([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 4, 1])],
  [
    'multiple memories',
    () =>
      compiles(
        new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 5, 5, 2, 0, 0, 0, 0])
      ),
  ],
  [
    'extended constants',
    () =>
      validate([
        0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 0, 1, 11, 9, 1, 0, 65, 1, 65, 2,
        106, 11, 0,
      ]),
  ],
  ['promise integration', () => 'Suspending' in WebAssembly],
];

const validate = (code: number[]) => WebAssembly.validate(new Uint8Array(code));

const compiles = (code: Uint8Array<ArrayBuffer>) => {
  try {
    new WebAssembly.Module(code);
    return true;
  } catch {
    return false;
  }
};

const engine: Probe = {
  id: 'engine',
  title: 'JavaScript engine',
  category: 'Browser',
  access: 'none',
  weight: 5,
  heavy: true,
  compat: ['api.Performance.now', 'webassembly.api.validate_static'],
  how: 'The wording of a TypeError, edge cases of Math.tan, Math.acosh and others, a recursion until the stack runs out, the steps of performance.now(), and WebAssembly.validate() on tiny modules',
  why: 'Each engine words its errors and rounds its maths its own way, so a page knows what really runs your browser whatever the user agent says. How deep the stack goes and which WebAssembly features are in narrow down the version and the device.',
  async collect() {
    const name = engineName();
    const math = mathResults();
    const wasm =
      typeof WebAssembly === 'object' ? WASM.filter(([, has]) => has()) : null;
    const heap = (
      performance as Performance & { memory?: { jsHeapSizeLimit: number } }
    ).memory?.jsHeapSizeLimit;
    return {
      lead: name && ENGINES[name],
      facts: [
        ['Maths results', hash(math.join(',')).slice(0, 12)],
        ['Deepest recursion', `${stackDepth().toLocaleString('en')} calls`],
        ['Timer steps', step(timerStep())],
        [
          'WebAssembly',
          wasm
            ? `${wasm.length} of ${WASM.length} newer features`
            : 'Turned off',
        ],
        ['Memory for scripts', heap ? bytes(heap) : null],
      ],
      raw: `${math.join('\n')}${wasm ? `\n\nWebAssembly: ${wasm.map(([feature]) => feature).join(', ') || 'none of the newer features'}` : ''}`,
    };
  },
};

export default engine;
