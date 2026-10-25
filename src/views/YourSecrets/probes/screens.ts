import type { Fact, Probe } from './types';
import { listText, untilAsked } from './utils';

type ScreenDetailed = Screen & {
  label: string;
  isInternal: boolean;
  isPrimary: boolean;
  devicePixelRatio: number;
  left: number;
  top: number;
};

type WindowManagement = {
  getScreenDetails?: () => Promise<{
    screens: ScreenDetailed[];
    currentScreen: ScreenDetailed;
  }>;
};

const api = () => (window as unknown as WindowManagement).getScreenDetails;

const EMPTY: Fact[] = [
  ['How many', null],
  ['Names', null],
  ['This window is on', null],
  ['Main screen', null],
  ['Built in', null],
  ['Sizes', null],
];

const size = (s: ScreenDetailed) =>
  `${s.width} × ${s.height}${s.devicePixelRatio === 1 ? '' : ` at ${+s.devicePixelRatio.toFixed(2)}×`}`;

const screens: Probe = {
  id: 'screens',
  title: 'Your screens',
  category: 'Screen',
  access: 'permission',
  weight: 6,
  permission: 'window-management' as PermissionName,
  compat: [
    'api.Window.getScreenDetails',
    'api.ScreenDetailed.label',
    'api.ScreenDetailed.isInternal',
  ],
  how: 'window.getScreenDetails(): label, isInternal, isPrimary, size and devicePixelRatio of every screen',
  why: 'Made for slideshows and trading desks that open windows across monitors. Once allowed, any page reads the model name of each screen you have plugged in.',
  action: 'Show my screens',
  async collect() {
    return untilAsked(api(), EMPTY);
  },
  async request() {
    const { screens: list, currentScreen } = await api()!.call(window);
    const name = (s: ScreenDetailed | undefined) =>
      s ? s.label || 'No name given' : null;
    const internal = list.find((s) => s.isInternal);
    const names = list.map((s) => s.label).filter(Boolean);
    return {
      lead:
        list.length === 1
          ? name(list[0])
          : `${list.length} screens${names.length ? `: ${listText(names)}` : ''}`,
      facts: [
        ['How many', String(list.length)],
        ['Names', names.length ? names.join(', ') : null],
        ['This window is on', name(currentScreen)],
        ['Main screen', name(list.find((s) => s.isPrimary))],
        [
          'Built in',
          internal ? name(internal) : 'None: an external screen only',
        ],
        ['Sizes', list.map(size).join(', ')],
      ],
      raw: JSON.stringify(
        list.map(
          ({
            label,
            isInternal,
            isPrimary,
            left,
            top,
            width,
            height,
            devicePixelRatio,
          }) => ({
            label,
            isInternal,
            isPrimary,
            left,
            top,
            width,
            height,
            devicePixelRatio,
          })
        ),
        null,
        2
      ),
    };
  },
};

export default screens;
