import type { Fact, Probe } from './types';
import { listText, untilAsked } from './utils';

type Contact = { name?: string[]; email?: string[]; tel?: string[] };
type Contacts = {
  getProperties?: () => Promise<string[]>;
  select: (
    properties: string[],
    options: { multiple: boolean }
  ) => Promise<Contact[]>;
};

const api = () => (navigator as unknown as { contacts?: Contacts }).contacts;

const EMPTY: Fact[] = [
  ['Picked', null],
  ['Names', null],
  ['Phone numbers', null],
  ['Email addresses', null],
];

const contacts: Probe = {
  id: 'contacts',
  title: 'Contacts',
  category: 'Device',
  access: 'gesture',
  weight: 4,
  compat: ['api.ContactsManager.select'],
  how: 'navigator.contacts.select(["name", "email", "tel"], { multiple: true }): your phone’s own contact picker, and only the people you tick reach the page',
  why: 'Made for inviting friends to an app. You choose who, but each name, number and email you tick belongs to someone who never agreed to share it.',
  action: 'Pick some contacts',
  note: 'Your phone shows its own list. The page gets only who you tick.',
  async collect() {
    return untilAsked(api(), EMPTY, 'Not on this device');
  },
  async request() {
    const list = await api()!.select(['name', 'email', 'tel'], {
      multiple: true,
    });
    if (!list.length) throw new DOMException('Nothing picked', 'AbortError');
    const names = list.map((c) => c.name?.[0]).filter(Boolean) as string[];
    const tels = list.flatMap((c) => c.tel ?? []);
    const emails = list.flatMap((c) => c.email ?? []);
    const some = (items: string[]) =>
      items.length
        ? `${items.length}: ${listText(items.slice(0, 2))}${items.length > 2 ? '…' : ''}`
        : 'None';
    return {
      lead: `${list.length} ${list.length === 1 ? 'contact' : 'contacts'}`,
      facts: [
        ['Picked', String(list.length)],
        [
          'Names',
          names.length
            ? listText(names.slice(0, 3)) + (names.length > 3 ? '…' : '')
            : 'None',
        ],
        ['Phone numbers', some(tels)],
        ['Email addresses', some(emails)],
      ],
    };
  },
};

export default contacts;
