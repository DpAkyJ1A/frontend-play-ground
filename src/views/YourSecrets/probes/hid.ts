import type { Fact, Probe } from './types';
import { hex4, untilAsked } from './utils';

type Collection = { usagePage: number; usage: number };
type HIDDevice = {
  productName: string;
  vendorId: number;
  productId: number;
  collections: Collection[];
};
type HID = {
  requestDevice: (options: { filters: object[] }) => Promise<HIDDevice[]>;
};

const api = () => (navigator as unknown as { hid?: HID }).hid;

const KINDS: [page: number, usage: number | null, kind: string][] = [
  [0x01, 0x04, 'A joystick'],
  [0x01, 0x05, 'A gamepad'],
  [0x01, 0x02, 'A mouse'],
  [0x01, 0x06, 'A keyboard'],
  [0x0c, null, 'Media keys'],
  [0x0b, null, 'A headset or a phone'],
  [0x0d, null, 'A pen or a touch screen'],
  [0x0f, null, 'A force-feedback device'],
  [0x20, null, 'A sensor'],
  [0x59, null, 'Lights'],
];

const kindOf = (device: HIDDevice) =>
  device.collections
    .map(
      ({ usagePage, usage }) =>
        KINDS.find(
          ([p, u]) => p === usagePage && (u === null || u === usage)
        )?.[2]
    )
    .find(Boolean) ??
  (device.collections.some((c) => c.usagePage >= 0xff00)
    ? 'Vendor-specific'
    : null);

const EMPTY: Fact[] = [
  ['Device', null],
  ['Kind', null],
  ['Vendor and product', null],
];

const hid: Probe = {
  id: 'hid',
  title: 'Input gear',
  category: 'Device',
  access: 'permission',
  weight: 3,
  compat: [
    'api.HID.requestDevice',
    'api.HIDDevice.productName',
    'api.HIDDevice.collections',
  ],
  how: 'navigator.hid.requestDevice({ filters: [] }): the browser lists game controllers, headsets and other HID gear and hands over the one you pick',
  why: 'Made for configuring gaming mice, controllers and stream decks from a web page. The device you pick hands over its exact model, down to the vendor and product number.',
  action: 'Find input devices',
  note: 'Your browser shows a list. The page gets only the device you pick.',
  async collect() {
    return untilAsked(api(), EMPTY);
  },
  async request() {
    const [device] = await api()!.requestDevice({ filters: [] });
    if (!device) throw new DOMException('Nothing picked', 'AbortError');
    return {
      lead: device.productName || 'A device with no name',
      facts: [
        ['Device', device.productName || null],
        ['Kind', kindOf(device)],
        [
          'Vendor and product',
          `${hex4(device.vendorId)}:${hex4(device.productId)}`,
        ],
      ],
    };
  },
};

export default hid;
