import type { Probe } from './types';
import { readRendering } from './offscreen';
import { hash, withTimeout } from './utils';

const audioHash = async () => {
  const Offline =
    window.OfflineAudioContext ||
    (
      window as unknown as {
        webkitOfflineAudioContext?: typeof OfflineAudioContext;
      }
    ).webkitOfflineAudioContext;
  if (!Offline) return null;
  const ctx = new Offline(1, 5000, 44100);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 10000;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -50;
  comp.knee.value = 40;
  comp.ratio.value = 12;
  comp.attack.value = 0;
  comp.release.value = 0.25;
  osc.connect(comp);
  comp.connect(ctx.destination);
  osc.start(0);
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
  return hash(sum.toString());
};

const layoutHash = () => {
  const box = document.createElement('div');
  box.style.cssText =
    'position:absolute;left:-9999px;top:0;width:173.3px;font:16.3px/1.13 serif;transform:rotate(0.37deg) scale(1.0007);';
  box.innerHTML =
    '<span>Quiz</span> <span>naïve</span> <em>façade</em> <b>Ŵ ﬁ</b> <span>1¾ Æ</span>';
  document.body.append(box);
  const rects = [...box.children].flatMap((el) =>
    [...el.getClientRects()].map((r) => `${r.x},${r.y},${r.width},${r.height}`)
  );
  box.remove();
  return rects.length ? hash(rects.join(';')) : null;
};

const fingerprint: Probe = {
  id: 'fingerprint',
  title: 'Fingerprint',
  category: 'Privacy',
  access: 'none',
  weight: 8,
  heavy: true,
  compat: [
    'api.CanvasRenderingContext2D.getImageData',
    'api.WebGLRenderingContext.readPixels',
    'api.OfflineAudioContext',
    'api.Element.getClientRects',
  ],
  how: 'A canvas drawing, a WebGL shader, an audio render and the boxes of a few turned words from getClientRects(), hashed. Each image is drawn twice to catch added noise.',
  why: 'Each device draws and mixes a little differently. The hashes stay the same in a private window, so a site can recognise you without a cookie.',
  async collect() {
    const { canvas, webgl } = await readRendering();
    const audio = await withTimeout(audioHash(), 1500);
    const layout = layoutHash();
    const stable =
      (!canvas || canvas[0] === canvas[1]) && (!webgl || webgl[0] === webgl[1]);
    const first = canvas?.[0] ?? null;
    return {
      lead: stable ? 'Same on every visit' : 'Scrambled by your browser',
      facts: [
        ['Canvas', first && first.slice(0, 12)],
        ['WebGL', webgl && webgl[0].slice(0, 12)],
        ['Audio', audio && audio.slice(0, 12)],
        ['Text layout', layout && layout.slice(0, 12)],
        [
          'Noise added',
          stable ? 'No, the hashes are stable' : 'Yes, they change every run',
        ],
      ],
      meta: { canvas: first, audio, webgl: webgl && webgl[0] },
    };
  },
};

export default fingerprint;
