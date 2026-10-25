import { hashBytes, withTimeout } from './utils';

export type Rendering = {
  renderer: string | null;
  vendor: string | null;
  maxTexture: number | null;
  maxViewport: string | null;
  anisotropy: number | null;
  extensions: number | null;
  webgpu: boolean;
  gpuFamily: string | null;
  webgpuFeatures: string[] | null;
  canvas: readonly [string, string] | null;
  webgl: readonly [string, string] | null;
};

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type GL = WebGLRenderingContext | WebGL2RenderingContext;
type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type GPU = {
  requestAdapter: () => Promise<{
    info?: { vendor?: string; architecture?: string };
    features?: Iterable<string>;
  } | null>;
};

const CANVAS = { width: 280, height: 60 };
const drawCanvas = (make: () => Canvas) => {
  const canvas = make();
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true,
  }) as Context2D | null;
  if (!ctx) return null;
  const read = () => {
    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createLinearGradient(0, 0, CANVAS.width, 0);
    gradient.addColorStop(0, '#f60');
    gradient.addColorStop(1, '#06f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    ctx.textBaseline = 'top';
    ctx.font = '18px "Times New Roman", serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Your secrets, 0.1 + 0.2 😶‍🌫️', 6, 8);
    ctx.globalCompositeOperation = 'multiply';
    ctx.beginPath();
    ctx.arc(220, 30, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(255, 0, 180)';
    ctx.fill();
    return hashBytes(ctx.getImageData(0, 0, CANVAS.width, CANVAS.height).data);
  };
  return [read(), read()] as const;
};

const VERTEX = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAGMENT = `
precision mediump float;
varying vec2 uv;
void main() {
  float wave = sin(uv.x * 37.3) * cos(uv.y * 23.7) + fract(uv.x * uv.y * 113.1);
  gl_FragColor = vec4(fract(wave), uv.y * 0.7 + 0.2 * sin(wave * 9.1), uv.x, 1.0);
}`;
const SHADER_SIZE = 64;

const inspect = (gl: GL) => {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null;
  const filter = gl.getExtension('EXT_texture_filter_anisotropic');
  return {
    renderer: gl.getParameter(
      ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER
    ) as string | null,
    vendor: gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR) as
      | string
      | null,
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number | null,
    maxViewport: dims ? `${dims[0]} × ${dims[1]}` : null,
    anisotropy: filter
      ? (gl.getParameter(filter.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number)
      : null,
    extensions: gl.getSupportedExtensions()?.length ?? null,
  };
};

const NO_GL = {
  renderer: null,
  vendor: null,
  maxTexture: null,
  maxViewport: null,
  anisotropy: null,
  extensions: null,
};

const drawShader = (gl: WebGLRenderingContext) => {
  const program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 0.9, 0.8]),
    gl.STATIC_DRAW
  );
  const at = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const read = () => {
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const pixels = new Uint8Array(SHADER_SIZE * SHADER_SIZE * 4);
    gl.readPixels(
      0,
      0,
      SHADER_SIZE,
      SHADER_SIZE,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    return hashBytes(pixels);
  };
  return [read(), read()] as const;
};

const release = (gl: GL | null) =>
  gl?.getExtension('WEBGL_lose_context')?.loseContext();

const askWebGPU = async (gpu: GPU | undefined) => {
  if (!gpu) return { webgpu: false, gpuFamily: null, webgpuFeatures: null };
  const adapter = await withTimeout(gpu.requestAdapter(), 1200);
  const info = adapter?.info;
  return {
    webgpu: Boolean(adapter),
    gpuFamily:
      info && (info.vendor || info.architecture)
        ? [info.vendor, info.architecture].filter(Boolean).join(', ')
        : null,
    webgpuFeatures: adapter?.features ? [...adapter.features].sort() : null,
  };
};

export const render = async (
  make: () => Canvas,
  gpu?: GPU
): Promise<Rendering> => {
  const canvas = drawCanvas(make);
  const gl = (make().getContext('webgl2') ||
    make().getContext('webgl')) as GL | null;
  const target = make();
  target.width = target.height = SHADER_SIZE;
  const shader = target.getContext('webgl', {
    preserveDrawingBuffer: true,
  }) as WebGLRenderingContext | null;
  try {
    return {
      ...(gl ? inspect(gl) : NO_GL),
      ...(await askWebGPU(gpu)),
      canvas,
      webgl: shader ? drawShader(shader) : null,
    };
  } finally {
    release(gl);
    release(shader);
  }
};
