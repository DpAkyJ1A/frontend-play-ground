import { useCallback, useState } from 'react';

const keyFor = (id: string) => `tour-seen:${id}`;

// No localStorage (blocked, or on the server) counts as seen.
const readSeen = (id: string) => {
  try {
    return localStorage.getItem(keyFor(id)) === '1';
  } catch {
    return true;
  }
};

const storeSeen = (id: string) => {
  try {
    localStorage.setItem(keyFor(id), '1');
    return true;
  } catch {
    return false;
  }
};

export default function useTourSeen(
  id: string
): [seen: boolean, markSeen: () => void] {
  const [seen, setSeen] = useState(() => readSeen(id));

  const markSeen = useCallback(() => {
    setSeen(true);
    storeSeen(id);
  }, [id]);

  return [seen, markSeen];
}
