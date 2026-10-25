import type { Access, Category } from '../probes/types';
import { ACCESS, AccessDot } from './Card';
import styles from './index.module.css';

export const SORTS = {
  revealing: 'Most revealing',
  category: 'By category',
  az: 'A to Z',
} as const;

export type Sort = keyof typeof SORTS;

export type Filters = {
  access: 'all' | Access;
  sort: Sort;
  category: 'all' | Category;
  hideEmpty: boolean;
};

export type ToolbarProps = {
  filters: Filters;
  counts: Record<'all' | Access, number>;
  categories: Category[];
  onChange: (filters: Filters) => void;
};

const ACCESS_KEYS = ['all', 'none', 'gesture', 'permission'] as const;

export default function Toolbar({
  filters,
  counts,
  categories,
  onChange,
}: ToolbarProps) {
  const update = (patch: Partial<Filters>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className={styles.tools}>
      <div className={styles.access} role="group" aria-label="Filter by access">
        {ACCESS_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.chip}
            aria-pressed={filters.access === key}
            onClick={() => update({ access: key })}
          >
            {key !== 'all' && <AccessDot access={key} />}
            {key === 'all' ? 'All' : ACCESS[key].label}
            <span className={styles.chipCount}>{counts[key]}</span>
          </button>
        ))}
      </div>
      <div className={styles.controls}>
        <label className={styles.select}>
          <span>Sort</span>
          <select
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as Sort })}
          >
            {Object.entries(SORTS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          <span>Category</span>
          <select
            value={filters.category}
            onChange={(e) =>
              update({ category: e.target.value as Filters['category'] })
            }
          >
            <option value="all">All</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={filters.hideEmpty}
            onChange={(e) => update({ hideEmpty: e.target.checked })}
          />
          <span>Hide what this browser keeps back</span>
        </label>
      </div>
    </div>
  );
}
