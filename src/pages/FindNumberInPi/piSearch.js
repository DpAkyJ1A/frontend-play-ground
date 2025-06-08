const API_URL = 'https://v2.api.pisearch.joshkeegan.co.uk/api/v1/Lookup';

export const SEARCH_DEPTH = 5e9;

export async function lookup(query, occurrence, signal) {
  const params = new URLSearchParams({
    namedDigits: 'pi',
    find: query,
    resultId: occurrence,
  });
  const response = await fetch(`${API_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`PiSearch ${response.status}`);
  const { resultStringIdx, numResults } = await response.json();
  return { index: resultStringIdx, total: numResults };
}

export function findLocal(digits, query, occurrence, current) {
  if (!digits) return -1;
  if (!current) return occurrence === 0 ? digits.indexOf(query) : -1;
  if (occurrence > current.occurrence) {
    return digits.indexOf(query, current.start + 1);
  }
  if (current.start > digits.length - query.length) return -1;
  return digits.lastIndexOf(query, current.start - 1);
}
