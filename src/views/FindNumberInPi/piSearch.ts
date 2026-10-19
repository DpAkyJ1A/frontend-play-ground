const API_URL = 'https://v2.api.pisearch.joshkeegan.co.uk/api/v1/Lookup';

export const SEARCH_DEPTH = 5e9;

const RETRY_DELAY = 2000;
const MAX_RETRY_DELAY = 30000;

// PiSearch takes 4–45 s to count a one- or two-digit query (tens or hundreds of
// millions of hits), so those counts live here, indexed by the query's value.
// Taken from PiSearch on 2026-10-19; the digits never change.
const ONE_DIGIT_TOTALS: readonly number[] = [
  499_989_001, 500_034_127, 499_984_949, 499_990_321, 499_978_284,
  499_995_352, 500_019_818, 500_001_703, 499_990_522, 500_015_923,
];
const TWO_DIGIT_TOTALS: readonly number[] = [
  50_008_500, 50_003_171, 49_998_246, 50_001_384, 49_987_191,
  49_998_480, 49_989_611, 49_998_704, 50_002_997, 50_000_717,
  50_005_236, 49_996_454, 50_010_488, 50_000_619, 50_001_323,
  50_004_498, 50_002_712, 50_002_081, 50_014_765, 49_995_951,
  49_981_122, 50_010_719, 49_998_364, 50_011_499, 50_000_283,
  49_999_660, 50_002_000, 49_996_322, 49_998_035, 49_986_945,
  50_007_153, 50_005_978, 50_001_316, 49_989_171, 50_000_048,
  49_993_439, 49_990_603, 50_000_665, 49_995_795, 50_006_153,
  49_994_133, 49_996_410, 50_000_016, 50_000_892, 49_988_443,
  49_997_605, 49_996_080, 49_998_268, 49_995_958, 50_010_479,
  49_997_532, 50_005_883, 49_994_613, 49_996_218, 49_999_485,
  49_998_859, 49_994_277, 50_007_428, 49_994_827, 50_006_230,
  50_000_545, 50_003_299, 50_003_225, 49_989_752, 50_000_867,
  50_008_477, 50_006_999, 50_003_743, 50_002_253, 50_000_658,
  49_997_913, 50_002_220, 49_988_609, 50_006_713, 49_998_829,
  49_998_599, 50_004_616, 49_994_232, 50_000_460, 50_009_511,
  49_990_889, 49_996_377, 49_998_715, 50_000_499, 49_999_451,
  49_998_040, 50_016_888, 49_992_990, 49_999_419, 49_997_254,
  50_005_978, 50_013_615, 49_991_357, 49_993_574, 50_002_364,
  49_997_695, 50_016_032, 50_007_270, 49_986_013, 50_002_025,
];

/** `index` is the 0-based decimal place, or `null` when there's no such hit. */
export type LookupResult = { index: number | null; total: number };

/** The parts of a search that `findLocal` steps from. */
export type LocalCursor = { occurrence: number; start: number };

export async function lookup(
  query: string,
  occurrence: number,
  signal: AbortSignal
): Promise<LookupResult> {
  const params = new URLSearchParams({
    namedDigits: 'pi',
    find: query,
    resultId: String(occurrence),
  });
  const response = await fetch(`${API_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`PiSearch ${response.status}`);
  const {
    resultStringIdx,
    numResults,
  }: { resultStringIdx: unknown; numResults: unknown } = await response.json();
  if (
    (resultStringIdx !== null && typeof resultStringIdx !== 'number') ||
    typeof numResults !== 'number'
  ) {
    throw new Error('PiSearch returned a malformed result');
  }
  return { index: resultStringIdx, total: numResults };
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });

/** Occurrences of a one- or two-digit query, known without asking PiSearch. */
export const knownTotal = (query: string) =>
  (query.length === 1
    ? ONE_DIGIT_TOTALS[Number(query)]
    : query.length === 2
      ? TWO_DIGIT_TOTALS[Number(query)]
      : undefined) ?? null;

/** Occurrences of `query` in the first SEARCH_DEPTH digits, from PiSearch.
 * Retries until it gets an answer or `signal` aborts. */
export async function countOccurrences(query: string, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await lookup(query, 0, signal)).total;
    } catch (error) {
      if (signal.aborted) throw error;
      await wait(
        Math.min(RETRY_DELAY * 2 ** attempt, MAX_RETRY_DELAY),
        signal
      );
    }
  }
}

export function findLocal(
  digits: string | null,
  query: string,
  occurrence: number,
  current: LocalCursor | null
) {
  if (!digits) return -1;
  if (!current) {
    // A shared link can start at any occurrence: walk to it while it's local.
    let index = -1;
    for (let i = 0; i <= occurrence; i++) {
      index = digits.indexOf(query, index + 1);
      if (index < 0) return -1;
    }
    return index;
  }
  if (occurrence > current.occurrence) {
    return digits.indexOf(query, current.start + 1);
  }
  if (current.start > digits.length - query.length) return -1;
  return digits.lastIndexOf(query, current.start - 1);
}
