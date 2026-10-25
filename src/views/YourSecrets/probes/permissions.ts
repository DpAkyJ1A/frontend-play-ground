import type { Probe } from './types';
import { listText } from './utils';

const ASKED: [string, string, object?][] = [
  ['geolocation', 'location'],
  ['camera', 'camera'],
  ['microphone', 'microphone'],
  ['notifications', 'notifications'],
  ['push', 'push messages', { userVisibleOnly: true }],
  ['clipboard-read', 'clipboard'],
  ['midi', 'MIDI', { sysex: false }],
  ['local-fonts', 'fonts'],
  ['window-management', 'window management'],
  ['idle-detection', 'idle detection'],
  ['storage-access', 'storage access'],
  ['screen-wake-lock', 'wake lock'],
  ['speaker-selection', 'speaker choice'],
  ['keyboard-lock', 'keyboard lock'],
  ['pointer-lock', 'pointer lock'],
];
const GIVEN: [string, string, object?][] = [
  ['clipboard-write', 'writing the clipboard'],
  ['background-sync', 'background sync'],
  ['background-fetch', 'background downloads'],
  ['periodic-background-sync', 'periodic sync'],
  ['persistent-storage', 'lasting storage'],
  ['accelerometer', 'accelerometer'],
  ['gyroscope', 'gyroscope'],
  ['magnetometer', 'magnetometer'],
  ['payment-handler', 'payment apps'],
  ['nfc', 'NFC'],
];

const state = async ([name, , extra]: [string, string, object?]) => {
  try {
    return (
      await navigator.permissions.query({
        name,
        ...extra,
      } as PermissionDescriptor)
    ).state;
  } catch {
    return null;
  }
};

const named = (
  list: [string, string, object?][],
  states: (string | null)[],
  wanted: string
) => list.filter((_, i) => states[i] === wanted).map(([, label]) => label);

const sentence = (labels: string[], max = 3) => {
  if (!labels.length) return 'Nothing';
  const shown =
    labels.length > max + 1
      ? [...labels.slice(0, max), `${labels.length - max} more`]
      : labels;
  return listText(shown).replace(/^./, (c) => c.toUpperCase());
};

const NOTIFICATIONS: Record<string, string> = {
  prompt: 'Not decided',
  default: 'Not decided',
  granted: 'Allowed',
  denied: 'Blocked',
};

const notifications = (queried: string | null) => {
  const value =
    queried ??
    (typeof Notification === 'undefined' ? null : Notification.permission);
  return value ? (NOTIFICATIONS[value] ?? null) : null;
};

const permissions: Probe = {
  id: 'permissions',
  title: 'Permissions',
  category: 'Privacy',
  access: 'none',
  weight: 4,
  compat: ['api.Permissions.query', 'api.Notification.permission_static'],
  how: `navigator.permissions.query() for ${ASKED.length + GIVEN.length} permission names and Notification.permission. It only reads: nothing is asked.`,
  why: 'Any page can read what you allowed or blocked for it. A block on a site you have never been to means you turned it off everywhere, and the names your browser knows date it.',
  async collect() {
    if (!navigator.permissions?.query)
      return {
        lead: null,
        facts: [
          ['Allowed by you', null],
          ['Blocked', null],
          ['Allowed without asking', null],
          ['Notifications', null],
          ['Names it knows', null],
        ],
      };
    const [asked, given] = await Promise.all([
      Promise.all(ASKED.map(state)),
      Promise.all(GIVEN.map(state)),
    ]);
    const allowed = named(ASKED, asked, 'granted');
    const blocked = [
      ...named(ASKED, asked, 'denied'),
      ...named(GIVEN, given, 'denied'),
    ];
    const states = [...asked, ...given];
    const known = states.filter((s) => s !== null).length;
    return {
      lead:
        allowed.length || blocked.length
          ? `${allowed.length} allowed, ${blocked.length} blocked`
          : 'Nothing decided yet',
      facts: [
        ['Allowed by you', sentence(allowed)],
        ['Blocked', sentence(blocked)],
        ['Allowed without asking', sentence(named(GIVEN, given, 'granted'), 2)],
        [
          'Notifications',
          notifications(
            asked[ASKED.findIndex(([name]) => name === 'notifications')]
          ),
        ],
        ['Names it knows', `${known} of ${ASKED.length + GIVEN.length}`],
      ],
      raw: [...ASKED, ...GIVEN]
        .map(([name], i) => `${name}: ${states[i] ?? 'unknown here'}`)
        .join('\n'),
    };
  },
};

export default permissions;
