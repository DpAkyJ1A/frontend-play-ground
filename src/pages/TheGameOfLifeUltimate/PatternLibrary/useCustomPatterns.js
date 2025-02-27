import { useState } from 'react';
import { parsePatternText } from './rle';

const STORAGE_KEY = 'game-of-life-custom-patterns';

const toPattern = ({ id, name, text }, maxSize) => {
  const { pattern } = parsePatternText(text, maxSize);
  return pattern ? { ...pattern, id, name, text, meta: 'yours' } : null;
};

const readStored = (maxSize) => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
    return stored.map((entry) => toPattern(entry, maxSize)).filter(Boolean);
  } catch {
    return [];
  }
};

const store = (patterns) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(patterns.map(({ id, name, text }) => ({ id, name, text })))
    );
    return true;
  } catch {
    return false;
  }
};

export default function useCustomPatterns(maxSize) {
  const [patterns, setPatterns] = useState(() => readStored(maxSize));

  const add = (text, name) => {
    const result = parsePatternText(text, maxSize);
    if (result.error) return result;
    const pattern = {
      ...result.pattern,
      id: `custom-${Date.now().toString(36)}`,
      name:
        name.trim() ||
        result.pattern.name ||
        `My pattern ${patterns.length + 1}`,
      text,
      meta: 'yours',
    };
    const next = [...patterns, pattern];
    setPatterns(next);
    store(next);
    return { pattern };
  };

  const remove = (id) => {
    const next = patterns.filter((pattern) => pattern.id !== id);
    setPatterns(next);
    store(next);
  };

  return [patterns, add, remove];
}
