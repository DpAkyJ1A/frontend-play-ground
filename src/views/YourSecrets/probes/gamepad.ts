import type { Probe } from './types';

let connected = false;
const onConnect = () => {
  connected = true;
};

const gamepad: Probe = {
  id: 'gamepad',
  title: 'Gamepad',
  category: 'Device',
  access: 'gesture',
  weight: 2,
  live: true,
  compat: ['api.Navigator.getGamepads', 'api.Window.gamepadconnected_event'],
  how: 'navigator.getGamepads(), after the gamepadconnected event',
  why: 'Press one button and a page learns the model of your controller, and that you play on this machine.',
  action: 'Press any button on a gamepad',
  watchWhenSettled: true,
  watch() {
    window.addEventListener('gamepadconnected', onConnect);
    return () => window.removeEventListener('gamepadconnected', onConnect);
  },
  async collect() {
    if (!navigator.getGamepads)
      return {
        lead: 'Not supported here',
        guarded: true,
        facts: [
          ['Model', null],
          ['Buttons', null],
          ['Sticks and triggers', null],
        ],
        final: true,
      };
    const pad = connected && [...navigator.getGamepads()].find(Boolean);
    if (!pad)
      return {
        lead: null,
        facts: [
          ['Model', null],
          ['Buttons', null],
          ['Sticks and triggers', null],
        ],
      };
    const model = pad.id
      .replace(/\s*\((?:STANDARD GAMEPAD\s*)?Vendor.*\)$/i, '')
      .trim();
    return {
      lead: model || 'A gamepad',
      facts: [
        ['Model', pad.id],
        ['Buttons', String(pad.buttons.length)],
        ['Sticks and triggers', `${pad.axes.length} axes`],
      ],
      final: true,
    };
  },
};

export default gamepad;
