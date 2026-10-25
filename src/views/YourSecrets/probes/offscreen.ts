import { nav } from './browser';
import { render, type Rendering } from './rendering';

export type { Rendering };

const inWorker = () =>
  new Promise<Rendering | null>((resolve) => {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
      return resolve(null);
    const worker = new Worker(
      new URL('./rendering.worker.ts', import.meta.url),
      {
        type: 'module',
      }
    );
    const done = (rendering: Rendering | null) => {
      worker.terminate();
      resolve(rendering);
    };
    worker.onmessage = (e: MessageEvent<Rendering | null>) =>
      done(e.data && (e.data.renderer || e.data.webgl) ? e.data : null);
    worker.onerror = () => done(null);
    worker.postMessage(null);
  });

let pending: Promise<Rendering> | null = null;

export const readRendering = () =>
  (pending ??= inWorker().then(
    (rendering) =>
      rendering ?? render(() => document.createElement('canvas'), nav().gpu)
  ));
