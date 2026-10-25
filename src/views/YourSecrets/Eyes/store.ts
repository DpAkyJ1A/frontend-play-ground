import { GAZE, IDLE, IRIS, PUPIL, shapes, type IdleStep } from './geometry';

export type EyeNodes = {
  mirror: boolean;
  clipShape: SVGPathElement;
  white: SVGGElement;
  sclera: SVGPathElement;
  shade: SVGPathElement;
  lid: SVGPathElement;
  iris: SVGGElement;
  redIris: SVGGElement;
  pinwheel: SVGPathElement;
  pupil: SVGCircleElement;
};

type Instance = {
  svg: SVGSVGElement;
  eyes: EyeNodes[];
  gx: number;
  gy: number;
  pupil: number;
  visible: boolean;
  drawn: Map<Element, Record<string, string>>;
};

const instances = new Set<Instance>();
const pointer = { x: 0, y: 0, at: -Infinity };
const sharingan = { on: false, level: 0, angle: 0, spin: 0 };
const listeners = new Set<() => void>();
let focus: { el: Element; until: number } | null = null;
let frame = 0;
let observer: IntersectionObserver | null = null;
let reduce = false;

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

const set = (
  instance: Instance,
  node: Element,
  name: string,
  value: string
) => {
  let attrs = instance.drawn.get(node);
  if (!attrs) instance.drawn.set(node, (attrs = {}));
  if (attrs[name] === value) return;
  attrs[name] = value;
  node.setAttribute(name, value);
};

const draw = (instance: Instance, blinkOpen: number) => {
  const open = blinkOpen * (1 - 0.12 * sharingan.level);
  const { opening, lid, shade } = shapes(open);
  for (const eye of instance.eyes) {
    set(instance, eye.white, 'opacity', Math.min(1, open / 0.25).toFixed(2));
    set(instance, eye.clipShape, 'd', opening);
    set(instance, eye.sclera, 'd', opening);
    set(instance, eye.lid, 'd', lid);
    // a growing outline closes the hairlines left where the lid lands
    set(instance, eye.lid, 'stroke-width', (16 * (1 - open)).toFixed(1));
    set(instance, eye.shade, 'd', shade);
    // the mirrored eye is drawn flipped, so its gaze runs the other way
    const x = IRIS.x + (eye.mirror ? -instance.gx : instance.gx) * GAZE.x;
    const y = IRIS.y + instance.gy * GAZE.y;
    set(
      instance,
      eye.iris,
      'transform',
      `translate(${x.toFixed(1)}, ${y.toFixed(1)})`
    );
    set(
      instance,
      eye.pupil,
      'r',
      (PUPIL * instance.pupil * (1 - sharingan.level)).toFixed(1)
    );
    set(instance, eye.redIris, 'opacity', sharingan.level.toFixed(3));
    set(
      instance,
      eye.pinwheel,
      'transform',
      `rotate(${sharingan.angle.toFixed(1)})`
    );
  }
};

let step = 0;
let stepUntil = 0;
let idle: IdleStep = IDLE[0];
let blinkAt = -Infinity;
let nextBlink = 3000;

const tick = (now: number) => {
  frame = 0;
  if (now > stepUntil) {
    idle = IDLE[step++ % IDLE.length];
    stepUntil = now + idle.hold;
    if (idle.blink) blinkAt = now;
  }
  if (now > nextBlink) {
    blinkAt = now;
    nextBlink = now + 3000 + Math.random() * 4000;
  }
  const b = (now - blinkAt) / 190;
  const open = b >= 0 && b < 1 ? 1 - Math.sin(b * Math.PI) : 1;

  sharingan.level += ((sharingan.on ? 1 : 0) - sharingan.level) * 0.08;
  sharingan.spin *= 0.95;
  sharingan.angle += sharingan.spin + 0.5 * sharingan.level;

  const following = now - pointer.at < 2200;
  for (const instance of instances) {
    if (!instance.visible) continue;
    let tx = idle.x;
    let ty = idle.y;
    let tp = idle.pupil ?? 1;
    let target: { x: number; y: number } | null = null;
    if (sharingan.on) {
      tx = 0;
      ty = 0;
    } else if (focus && now < focus.until) {
      const r = focus.el.getBoundingClientRect();
      target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    } else if (following) {
      target = pointer;
    }
    if (target) {
      const r = instance.svg.getBoundingClientRect();
      const dx = target.x - (r.left + r.width / 2);
      const dy = target.y - (r.top + r.height / 2);
      tx = clamp(dx / 260);
      ty = clamp(dy / 180);
      tp = Math.hypot(dx, dy) < r.width * 0.6 ? 1.2 : 1;
    }
    instance.gx += (tx - instance.gx) * 0.16;
    instance.gy += (ty - instance.gy) * 0.16;
    instance.pupil += (tp - instance.pupil) * 0.1;
    draw(instance, open);
  }
  schedule();
};

const awake = () =>
  !reduce &&
  document.visibilityState === 'visible' &&
  [...instances].some((instance) => instance.visible);

function schedule() {
  if (frame || !awake()) return;
  frame = requestAnimationFrame(tick);
}

const pause = () => {
  cancelAnimationFrame(frame);
  frame = 0;
};

const onVisibility = () => (awake() ? schedule() : pause());

const onPointer = (e: PointerEvent) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.at = performance.now();
};

const start = () => {
  reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('visibilitychange', onVisibility);
  if (!reduce)
    window.addEventListener('pointermove', onPointer, { passive: true });
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      for (const instance of instances) {
        if (instance.svg === entry.target)
          instance.visible = entry.isIntersecting;
      }
    }
    onVisibility();
  });
};

const stop = () => {
  pause();
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pointermove', onPointer);
  observer?.disconnect();
  observer = null;
};

export const register = (svg: SVGSVGElement, eyes: EyeNodes[]) => {
  if (!instances.size) start();
  const instance: Instance = {
    svg,
    eyes,
    gx: 0,
    gy: 0,
    pupil: 1,
    visible: false,
    drawn: new Map(),
  };
  instances.add(instance);
  observer!.observe(svg);
  draw(instance, 1);
  return () => {
    observer?.unobserve(svg);
    instances.delete(instance);
    if (!instances.size) stop();
  };
};

export const lookAt = (el: Element, ms = 1600) => {
  focus = { el, until: performance.now() + ms };
};

export const isSharingan = () => sharingan.on;

export const setSharingan = (on: boolean) => {
  sharingan.on = on;
  if (on) sharingan.spin = 16;
  if (reduce) {
    sharingan.level = on ? 1 : 0;
    for (const instance of instances) draw(instance, 1);
  }
  for (const listener of listeners) listener();
};

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
