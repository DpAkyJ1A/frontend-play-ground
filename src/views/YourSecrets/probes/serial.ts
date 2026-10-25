import type { Fact, Probe } from './types';
import { hex4, untilAsked } from './utils';

type Port = {
  getInfo: () => {
    usbVendorId?: number;
    usbProductId?: number;
    bluetoothServiceClassId?: number | string;
  };
};
type Serial = { requestPort: (options?: object) => Promise<Port> };

const api = () => (navigator as unknown as { serial?: Serial }).serial;

const VENDORS: Record<number, string> = {
  0x2341: 'Arduino',
  0x2a03: 'Arduino',
  0x1a86: 'WCH (CH340), on cheap Arduino clones',
  0x10c4: 'Silicon Labs (CP210x)',
  0x0403: 'FTDI',
  0x303a: 'Espressif (ESP32)',
  0x2e8a: 'Raspberry Pi (Pico)',
  0x239a: 'Adafruit',
  0x1366: 'SEGGER (J-Link)',
  0x0483: 'STMicroelectronics',
  0x1915: 'Nordic Semiconductor',
  0x16c0: 'Teensy',
};

const EMPTY: Fact[] = [
  ['Port', null],
  ['Made by', null],
  ['Vendor and product', null],
];

const serial: Probe = {
  id: 'serial',
  title: 'Serial port',
  category: 'Device',
  access: 'permission',
  weight: 2,
  compat: ['api.Serial.requestPort', 'api.SerialPort.getInfo'],
  how: 'navigator.serial.requestPort(): the browser lists serial ports, from boards plugged in by USB to paired Bluetooth devices, and hands over the one you pick',
  why: 'Made for flashing microcontrollers and talking to lab gear. The port you pick says which chip or board is behind it: an Arduino, an ESP32, a 3D printer.',
  action: 'Find serial ports',
  note: 'Your browser shows a list. The page gets only the port you pick.',
  async collect() {
    return untilAsked(api(), EMPTY);
  },
  async request() {
    const info = (await api()!.requestPort()).getInfo();
    const vendor = info.usbVendorId;
    const usb = vendor !== undefined;
    const port = usb
      ? 'USB'
      : info.bluetoothServiceClassId !== undefined
        ? 'Bluetooth'
        : null;
    const known = usb ? VENDORS[vendor] : undefined;
    return {
      lead: known
        ? `A USB serial port: ${known.split(' (')[0]}`
        : port
          ? `A ${port} serial port`
          : 'A serial port',
      facts: [
        ['Port', port ?? 'Built in'],
        ['Made by', usb ? (known ?? 'Not one this page knows') : null],
        [
          'Vendor and product',
          usb && info.usbProductId !== undefined
            ? `${hex4(vendor)}:${hex4(info.usbProductId)}`
            : null,
        ],
      ],
    };
  },
};

export default serial;
