import { idle } from './utils';

export type Sandboxed = {
  pdf: boolean | null;
  plugins: number | null;
  address: string | null;
};

const CHECKS = `<script>
parent.postMessage({
  pdf: 'pdfViewerEnabled' in navigator ? navigator.pdfViewerEnabled : null,
  plugins: navigator.plugins ? navigator.plugins.length : null,
}, '*');
(async () => {
  let address = null;
  try {
    const peer = new RTCPeerConnection({ iceServers: [] });
    const found = new Promise((resolve) => {
      peer.onicecandidate = (e) => {
        if (!e.candidate) return resolve(null);
        const value = e.candidate.address || e.candidate.candidate.split(' ')[4];
        if (value) resolve(value);
      };
      setTimeout(() => resolve(null), 1500);
    });
    peer.createDataChannel('ys');
    await peer.setLocalDescription(await peer.createOffer());
    address = await found;
    peer.close();
  } catch {}
  parent.postMessage({ address }, '*');
})();
<\/script>`;

const TIMEOUT = { pdf: 2500, plugins: 2500, address: 3500 };

const reply = <K extends keyof Sandboxed>(frame: HTMLIFrameElement, key: K) =>
  new Promise<Sandboxed[K] | null>((resolve) => {
    const done = (value: Sandboxed[K] | null) => {
      window.removeEventListener('message', listen);
      clearTimeout(timer);
      resolve(value);
    };
    const listen = (e: MessageEvent<Partial<Sandboxed>>) => {
      if (e.source === frame.contentWindow && key in e.data)
        done(e.data[key] ?? null);
    };
    const timer = setTimeout(() => done(null), TIMEOUT[key]);
    window.addEventListener('message', listen);
  });

const open = () => {
  const frame = document.createElement('iframe');
  frame.sandbox.add('allow-scripts');
  frame.hidden = true;
  frame.srcdoc = CHECKS;
  const answers = {
    pdf: reply(frame, 'pdf'),
    plugins: reply(frame, 'plugins'),
    address: reply(frame, 'address'),
  };
  let closed = false;
  idle().then(() => {
    if (!closed) document.body.append(frame);
  });
  Promise.all(Object.values(answers)).then(() => {
    closed = true;
    frame.remove();
  });
  return answers;
};

let opened: ReturnType<typeof open> | null = null;

export const sandboxed = <K extends keyof Sandboxed>(key: K) =>
  (opened ??= open())[key];
