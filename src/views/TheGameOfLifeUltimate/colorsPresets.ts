export type ColorPreset = {
  name: string;
  alive: string;
  dead: string;
  separator: string;
};

export const colorPresetsList: ColorPreset[] = [
  {
    name: 'ultraviolet',
    alive: '#b69cff',
    dead: '#15121f',
    separator: '#231f33',
  },
  {
    name: 'monochrome',
    alive: '#f2f2f2',
    dead: '#0a0a0a',
    separator: '#1c1c1c',
  },
  {
    name: 'phosphor',
    alive: '#4dff9a',
    dead: '#06130c',
    separator: '#0f2618',
  },
  {
    name: 'amber',
    alive: '#ffb000',
    dead: '#140d02',
    separator: '#2b1e07',
  },
  {
    name: 'blueprint',
    alive: '#e6f0ff',
    dead: '#0f2b4c',
    separator: '#1b3d66',
  },
  {
    name: 'galaxy',
    alive: '#ffd166',
    dead: '#0b1026',
    separator: '#19213f',
  },
  {
    name: 'cyberpunk',
    alive: '#ff2a6d',
    dead: '#0d0221',
    separator: '#1e0b3d',
  },
  {
    name: 'high contrast',
    alive: '#ffff00',
    dead: '#000000',
    separator: '#2e2e2e',
  },
  {
    name: 'paper',
    alive: '#1f1d1a',
    dead: '#f2f0eb',
    separator: '#e0ddd5',
  },
  {
    name: 'pip',
    alive: '#a07c62',
    dead: '#f8efe4',
    separator: '#f2dcd8',
  },
];
