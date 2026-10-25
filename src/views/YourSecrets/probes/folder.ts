import type { Fact, Probe } from './types';
import { MONTHS, fileSize, listText, nextTask, untilAsked } from './utils';

type Entry = {
  kind: 'file' | 'directory';
  name: string;
  getFile?: () => Promise<File>;
};
type Directory = { name: string; values: () => AsyncIterable<Entry> };

const api = () =>
  (
    window as unknown as {
      showDirectoryPicker?: (o?: object) => Promise<Directory>;
    }
  ).showDirectoryPicker;

const MAX_ENTRIES = 2000;
const MAX_SIZES = 300;

type Types = Map<string, number>;

const counted = (types: Types, ...extensions: string[]) =>
  extensions.reduce((sum, ext) => sum + (types.get(ext) ?? 0), 0);

const KINDS: [
  label: string,
  test: (names: Set<string>, types: Types) => boolean,
][] = [
  ['a git repository', (n) => n.has('.git')],
  ['a JavaScript project', (n) => n.has('package.json')],
  [
    'a Python project',
    (n) => n.has('pyproject.toml') || n.has('requirements.txt'),
  ],
  ['photos', (_, t) => counted(t, 'jpg', 'jpeg', 'heic', 'png') > 10],
  ['music', (_, t) => counted(t, 'mp3', 'm4a', 'flac') > 5],
  ['documents', (_, t) => counted(t, 'pdf', 'docx', 'xlsx') > 5],
];

const day = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

const EMPTY: Fact[] = [
  ['Folder', null],
  ['Inside', null],
  ['Hidden files', null],
  ['Most common', null],
  ['Size', null],
  ['Newest file', null],
  ['Looks like', null],
];

const folder: Probe = {
  id: 'folder',
  title: 'Folder contents',
  category: 'Behaviour',
  access: 'permission',
  weight: 5,
  compat: [
    'api.Window.showDirectoryPicker',
    'api.FileSystemDirectoryHandle.values',
  ],
  how: 'window.showDirectoryPicker(), then the names of the entries in the folder you pick and the size and date of up to 300 of its files. Nothing is uploaded.',
  why: 'Made for editors that open a whole project. One folder you hand over gives away every file name in it, hidden ones included: a project’s name, a client, a holiday, a .git folder.',
  action: 'Pick a folder',
  note: 'Your browser shows a folder picker, then asks once more. Nothing leaves your device.',
  async collect() {
    return untilAsked(api(), EMPTY);
  },
  async request() {
    const dir = await api()!.call(window, { mode: 'read' });
    const names = new Set<string>();
    const types = new Map<string, number>();
    const files: Entry[] = [];
    let folders = 0;
    let hidden = 0;
    let more = false;
    for await (const entry of dir.values()) {
      if (names.size >= MAX_ENTRIES) {
        more = true;
        break;
      }
      names.add(entry.name);
      if (entry.name.startsWith('.')) hidden++;
      if (entry.kind === 'directory') folders++;
      else {
        files.push(entry);
        const ext = entry.name.includes('.')
          ? entry.name.split('.').pop()!.toLowerCase()
          : '';
        if (ext && !entry.name.startsWith('.'))
          types.set(ext, (types.get(ext) ?? 0) + 1);
      }
      if (names.size % 200 === 0) await nextTask();
    }
    let size = 0;
    let newest: File | null = null;
    for (let i = 0; i < Math.min(files.length, MAX_SIZES); i += 30) {
      const batch = await Promise.all(
        files
          .slice(i, i + 30)
          .map((entry) => entry.getFile?.().catch(() => null) ?? null)
      );
      for (const file of batch) {
        if (!file) continue;
        size += file.size;
        if (!newest || file.lastModified > newest.lastModified) newest = file;
      }
    }
    const common = [...types].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const kind = KINDS.find(([, test]) => test(names, types))?.[0];
    const count = `${files.length.toLocaleString('en')}${more ? '+' : ''} files, ${folders.toLocaleString('en')} folders`;
    return {
      lead: `“${dir.name}”: ${count}`,
      facts: [
        ['Folder', dir.name],
        ['Inside', count],
        [
          'Hidden files',
          hidden
            ? `${hidden}, like ${[...names].find((n) => n.startsWith('.'))}`
            : 'None',
        ],
        [
          'Most common',
          common.length
            ? listText(common.map(([ext, n]) => `.${ext} (${n})`))
            : 'No file types',
        ],
        [
          'Size',
          files.length
            ? `${fileSize(size)}${files.length > MAX_SIZES ? ` in the first ${MAX_SIZES} files` : ''}`
            : null,
        ],
        [
          'Newest file',
          newest ? `${newest.name}, ${day(newest.lastModified)}` : null,
        ],
        [
          'Looks like',
          kind
            ? kind.replace(/^./, (c) => c.toUpperCase())
            : 'Nothing in particular',
        ],
      ],
      raw: [...names].slice(0, 200).join('\n'),
    };
  },
};

export default folder;
