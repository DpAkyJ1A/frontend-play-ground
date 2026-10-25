import { useMemo, useState } from 'react';
import { PROBES } from '../probes';
import { completeness, shared } from '../probes/score';
import type { Access, Category, Probe, ProbeResult } from '../probes/types';
import { ACCESS } from './Card';
import Grid from './Grid';
import Toolbar, { type Filters } from './Toolbar';
import styles from './index.module.css';

const CATEGORIES = [
  ...new Set(PROBES.map((probe) => probe.category)),
] as Category[];

const COUNTS = {
  all: PROBES.length,
  none: PROBES.filter((p) => p.access === 'none').length,
  gesture: PROBES.filter((p) => p.access === 'gesture').length,
  permission: PROBES.filter((p) => p.access === 'permission').length,
} satisfies Record<'all' | Access, number>;

const byWeight = (a: Probe, b: Probe) => b.weight - a.weight;

const fullness = (probe: Probe, results: ReadonlyMap<string, ProbeResult>) =>
  probe.access === 'none' ? completeness(results.get(probe.id)) : 0;

export type ResultsProps = {
  results: ReadonlyMap<string, ProbeResult>;
  done: boolean;
  onResult: (id: string, result: ProbeResult) => void;
  onInfo: (probe: Probe) => void;
};

export default function Results({
  results,
  done,
  onResult,
  onInfo,
}: ResultsProps) {
  const [filters, setFilters] = useState<Filters>({
    access: 'all',
    sort: 'revealing',
    category: 'all',
    hideEmpty: false,
  });

  const order = useMemo(() => {
    const list = [...PROBES];
    if (!done) return list.sort(byWeight);
    if (filters.sort === 'az')
      return list.sort((a, b) => a.title.localeCompare(b.title));
    if (filters.sort === 'category')
      return list.sort(
        (a, b) => a.category.localeCompare(b.category) || byWeight(a, b)
      );
    return list.sort(
      (a, b) =>
        ACCESS[a.access].rank - ACCESS[b.access].rank ||
        fullness(b, results) - fullness(a, results) ||
        byWeight(a, b)
    );
  }, [done, filters.sort, results]);

  const isVisible = (probe: Probe) => {
    if (filters.access !== 'all' && probe.access !== filters.access)
      return false;
    if (filters.category !== 'all' && probe.category !== filters.category)
      return false;
    const result = results.get(probe.id);
    if (
      filters.hideEmpty &&
      probe.access === 'none' &&
      result &&
      !shared(result)
    )
      return false;
    return true;
  };

  return (
    <section aria-labelledby="results">
      <div className={styles.head}>
        <h2 id="results">Everything it found</h2>
        <span>{PROBES.length} cards</span>
      </div>
      <Toolbar
        filters={filters}
        counts={COUNTS}
        categories={CATEGORIES}
        onChange={setFilters}
      />
      <Grid
        order={order}
        isVisible={isVisible}
        results={results}
        hideEmpty={filters.hideEmpty}
        onResult={onResult}
        onInfo={onInfo}
      />
    </section>
  );
}
