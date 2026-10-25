import type { Probe } from './types';
import { duration, yesNo } from './utils';

const visit = { start: 0, switches: 0 };

type Hello = { type: 'hello' | 'here' | 'bye'; id: string };
const me = Math.random().toString(36).slice(2);
const others = new Map<string, number>();
let channel: BroadcastChannel | null = null;
let helloAt = 0;

const onMessage = (e: MessageEvent<Hello>) => {
  const { type, id } = e.data ?? {};
  if (!id || id === me) return;
  if (type === 'bye') others.delete(id);
  else others.set(id, Date.now());
  if (type === 'hello') channel?.postMessage({ type: 'here', id: me });
};

const onPageHide = () => channel?.postMessage({ type: 'bye', id: me });

const otherTabs = () => {
  if (!channel) return null;
  const now = Date.now();
  if (now - helloAt > 4000) {
    helloAt = now;
    channel.postMessage({ type: 'hello', id: me });
  }
  for (const [id, at] of others) if (now - at > 10000) others.delete(id);
  return others.size;
};

const onVisibility = () => {
  if (document.visibilityState === 'hidden') visit.switches++;
};

const visitProbe: Probe = {
  id: 'visit',
  title: 'This visit',
  category: 'Behaviour',
  access: 'none',
  weight: 2,
  live: true,
  compat: [
    'api.Document.referrer',
    'api.History.length',
    'api.Document.visibilityState',
    'api.BroadcastChannel',
  ],
  how: 'document.referrer, history.length, the Page Visibility API, and a BroadcastChannel that other tabs with this page answer on',
  why: 'A page always knows where you came from, how long you stay and when you look away, and its other tabs can talk to each other without a server.',
  watch() {
    visit.start = performance.now();
    visit.switches = 0;
    document.addEventListener('visibilitychange', onVisibility);
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('your-secrets');
      channel.onmessage = onMessage;
      helloAt = 0;
      window.addEventListener('pagehide', onPageHide);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      onPageHide();
      channel?.close();
      channel = null;
      others.clear();
    };
  },
  async collect() {
    const tabs = otherTabs();
    let from = 'Typed, bookmarked or a new tab';
    if (document.referrer) {
      try {
        from = new URL(document.referrer).host;
      } catch {
        from = document.referrer;
      }
    }
    return {
      lead: `${history.length} page${history.length > 1 ? 's' : ''} in this tab`,
      facts: [
        ['Came from', from],
        ['Time here', duration(performance.now() - visit.start)],
        [
          'Looked away',
          `${visit.switches} time${visit.switches === 1 ? '' : 's'}`,
        ],
        ['Window in focus', yesNo(document.hasFocus())],
        [
          'This page in other tabs',
          tabs === null ? null : tabs ? `${tabs} more open` : 'None',
        ],
      ],
    };
  },
};

export default visitProbe;
