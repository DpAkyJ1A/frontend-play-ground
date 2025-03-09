import { useCallback, useState } from 'react';

const keyFor = (id) => `tour-seen:${id}`;

const readSeen = (id) => {
  try {
    return localStorage.getItem(keyFor(id)) === '1';
  } catch {
    return true;
  }
};

const storeSeen = (id) => {
  try {
    localStorage.setItem(keyFor(id), '1');
    return true;
  } catch {
    return false;
  }
};

export default function useTourSeen(id) {
  const [seen, setSeen] = useState(() => readSeen(id));

  const markSeen = useCallback(() => {
    setSeen(true);
    storeSeen(id);
  }, [id]);

  return [seen, markSeen];
}
