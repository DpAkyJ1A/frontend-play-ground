import type { Probe, ProbeResult } from './types';

const clipboard: Probe = {
  id: 'clipboard',
  title: 'Clipboard',
  category: 'Behaviour',
  access: 'gesture',
  weight: 6,
  compat: ['api.Element.paste_event', 'api.ClipboardEvent.clipboardData'],
  how: 'The paste event: clipboardData on paste needs no permission',
  why: 'Reading the clipboard on its own needs permission, but anything you paste into a page is the page’s to read, files and images included.',
  action: 'Paste anything here',
  async collect() {
    return {
      lead: null,
      facts: [
        ['Type', null],
        ['Size', null],
        ['Preview', null],
      ],
    };
  },
};

const isLink = (text: string) => {
  if (!/^https?:\/\/\S+$/i.test(text)) return null;
  try {
    return new URL(text);
  } catch {
    return null;
  }
};

export const readPaste = (data: DataTransfer): ProbeResult => {
  const file = data.files[0];
  const text = data.getData('text/plain');
  const types = [...data.types].filter((t) => t !== 'Files');
  if (file) {
    return {
      lead: file.type.startsWith('image/') ? 'An image' : 'A file',
      facts: [
        ['Type', file.type || null],
        ['Size', `${Math.max(1, Math.round(file.size / 1024))} KB`],
        ['Preview', file.name || null],
      ],
    };
  }
  const link = isLink(text.trim());
  if (link) {
    return {
      lead: 'A link',
      facts: [
        ['Type', types.join(', ') || null],
        ['Size', `${new Blob([text]).size} B`],
        ['Preview', link.host + (link.pathname === '/' ? '' : link.pathname)],
      ],
    };
  }
  return {
    lead: text ? `${text.length} characters` : 'Empty',
    facts: [
      ['Type', types.join(', ') || null],
      ['Size', `${new Blob([text]).size} B`],
      [
        'Preview',
        text ? text.slice(0, 48) + (text.length > 48 ? '…' : '') : null,
      ],
    ],
  };
};

export default clipboard;
