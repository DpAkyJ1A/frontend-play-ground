import { useState } from 'react';
import { parsePatternText, type PatternError } from './rle';
import type { Pattern } from './library';

const STORAGE_KEY = 'game-of-life-custom-patterns';

export type CustomPattern = Pattern & { text: string };

export type AddPatternResult =
  | { error: PatternError; pattern?: undefined }
  | { pattern: CustomPattern; error?: undefined };

// Only the text is stored; the shape is parsed again on load.
type StoredPattern = Pick<CustomPattern, 'id' | 'name' | 'text'>;

const isStoredPattern = (entry: unknown): entry is StoredPattern => {
  if (typeof entry !== 'object' || entry === null) return false;
  const { id, name, text } = entry as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    typeof text === 'string'
  );
};

const toPattern = (
  { id, name, text }: StoredPattern,
  maxSize: number
): CustomPattern | null => {
  const { pattern } = parsePatternText(text, maxSize);
  return pattern ? { ...pattern, id, name, text, meta: 'yours' } : null;
};

const readStored = (maxSize: number): CustomPattern[] => {
  try {
    const stored: unknown =
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? [];
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(isStoredPattern)
      .map((entry) => toPattern(entry, maxSize))
      .filter((pattern) => pattern !== null);
  } catch {
    return [];
  }
};

const store = (patterns: CustomPattern[]) => {
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

export default function useCustomPatterns(maxSize: number) {
  const [patterns, setPatterns] = useState(() => readStored(maxSize));

  const add = (text: string, name: string): AddPatternResult => {
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

  const remove = (id: string) => {
    const next = patterns.filter((pattern) => pattern.id !== id);
    setPatterns(next);
    store(next);
  };

  return [patterns, add, remove] as const;
}
