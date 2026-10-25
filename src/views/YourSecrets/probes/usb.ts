import type { Fact, Probe } from './types';
import { hex4, untilAsked } from './utils';

type USBDevice = {
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  vendorId: number;
  productId: number;
  usbVersionMajor: number;
  usbVersionMinor: number;
};
type USB = {
  requestDevice: (options: { filters: object[] }) => Promise<USBDevice>;
};

const api = () => (navigator as unknown as { usb?: USB }).usb;

const EMPTY: Fact[] = [
  ['Device', null],
  ['Made by', null],
  ['Serial number', null],
  ['Vendor and product', null],
  ['USB version', null],
];

const usb: Probe = {
  id: 'usb',
  title: 'USB device',
  category: 'Device',
  access: 'permission',
  weight: 4,
  compat: [
    'api.USB.requestDevice',
    'api.USBDevice.productName',
    'api.USBDevice.serialNumber',
  ],
  how: 'navigator.usb.requestDevice({ filters: [] }): the browser lists what is plugged in and hands over the one you pick',
  why: 'Made for flashing boards and talking to lab gear. The device you pick hands over its name, its maker and its serial number: a number that follows the device, not the browser.',
  action: 'Find USB devices',
  note: 'Your browser shows a list. The page gets only the device you pick.',
  async collect() {
    return untilAsked(api(), EMPTY);
  },
  async request() {
    const device = await api()!.requestDevice({ filters: [] });
    return {
      lead: device.productName || 'A device with no name',
      facts: [
        ['Device', device.productName || null],
        ['Made by', device.manufacturerName || null],
        ['Serial number', device.serialNumber || 'None given'],
        [
          'Vendor and product',
          `${hex4(device.vendorId)}:${hex4(device.productId)}`,
        ],
        ['USB version', `${device.usbVersionMajor}.${device.usbVersionMinor}`],
      ],
    };
  },
};

export default usb;
