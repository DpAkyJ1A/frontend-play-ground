import type { Fact, Probe } from './types';
import { untilAsked } from './utils';

type BluetoothDevice = { id: string; name?: string };
type Bluetooth = {
  requestDevice: (options: {
    acceptAllDevices: boolean;
  }) => Promise<BluetoothDevice>;
};

const api = () => (navigator as unknown as { bluetooth?: Bluetooth }).bluetooth;

const EMPTY: Fact[] = [
  ['Device', null],
  ['Its ID here', null],
  ['Bluetooth', null],
];

const bluetooth: Probe = {
  id: 'bluetooth',
  title: 'Bluetooth nearby',
  category: 'Device',
  access: 'permission',
  weight: 4,
  compat: [
    'api.Bluetooth.requestDevice',
    'api.BluetoothDevice.name',
    'api.BluetoothDevice.id',
  ],
  how: 'navigator.bluetooth.requestDevice({ acceptAllDevices: true }): the browser lists the devices around you and hands over the one you pick',
  why: 'Headphones, watches and cars often carry their owner’s name, like “Sam’s AirPods”. The page sees only the device you pick, and keeps a stable ID for it on this site.',
  action: 'Find devices',
  note: 'Your browser shows a list. The page gets only the device you pick.',
  async collect() {
    return untilAsked(api(), EMPTY);
  },
  async request() {
    try {
      const device = await api()!.requestDevice({ acceptAllDevices: true });
      return {
        lead: device.name || 'A device with no name',
        facts: [
          ['Device', device.name || null],
          ['Its ID here', device.id ? `${device.id.slice(0, 12)}…` : null],
          ['Bluetooth', 'On'],
        ],
      };
    } catch (error) {
      if (
        /adapter|not available|unavailable/i.test(
          (error as Error)?.message ?? ''
        )
      )
        return {
          lead: 'Bluetooth is off',
          facts: [
            ['Device', null],
            ['Its ID here', null],
            ['Bluetooth', 'Off or missing'],
          ],
          final: true,
        };
      throw error;
    }
  },
};

export default bluetooth;
