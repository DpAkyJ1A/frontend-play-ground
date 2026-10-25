import type { Fact, Probe } from './types';
import { listText, untilAsked } from './utils';

type Port = { name: string | null; manufacturer: string | null };
type Access = { inputs: Map<string, Port>; outputs: Map<string, Port> };

const api = () =>
  (
    navigator as unknown as {
      requestMIDIAccess?: (o: object) => Promise<Access>;
    }
  ).requestMIDIAccess;

const EMPTY: Fact[] = [
  ['Devices', null],
  ['Made by', null],
  ['Inputs', null],
  ['Outputs', null],
];

const midi: Probe = {
  id: 'midi',
  title: 'Music gear',
  category: 'Device',
  access: 'permission',
  weight: 4,
  permission: 'midi' as PermissionName,
  compat: [
    'api.Navigator.requestMIDIAccess',
    'api.MIDIPort.name',
    'api.MIDIPort.manufacturer',
  ],
  how: 'navigator.requestMIDIAccess(): the name and maker of every MIDI input and output, without system-exclusive messages',
  why: 'Made for web synths and DAWs. Once allowed, a page sees every keyboard, controller and audio interface you plug in, by model: rare gear makes you easy to pick out.',
  action: 'Allow MIDI',
  async collect() {
    return untilAsked(api(), EMPTY);
  },
  async request() {
    const access = await api()!.call(navigator, { sysex: false });
    const ports = [...access.inputs.values(), ...access.outputs.values()];
    const devices = [
      ...new Set(ports.map((p) => p.name).filter(Boolean) as string[]),
    ];
    const makers = [
      ...new Set(ports.map((p) => p.manufacturer).filter(Boolean) as string[]),
    ];
    return {
      lead: devices.length ? devices[0] : 'Nothing plugged in',
      facts: [
        ['Devices', devices.length ? listText(devices.slice(0, 4)) : 'None'],
        [
          'Made by',
          makers.length
            ? listText(makers.slice(0, 4))
            : devices.length
              ? null
              : 'None',
        ],
        ['Inputs', String(access.inputs.size)],
        ['Outputs', String(access.outputs.size)],
      ],
    };
  },
};

export default midi;
