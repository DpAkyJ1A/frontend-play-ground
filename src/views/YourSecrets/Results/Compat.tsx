import COMPAT from '../probes/compat.json';
import styles from './Compat.module.css';

const BROWSERS = [
  ['chrome', 'Chrome'],
  ['edge', 'Edge'],
  ['firefox', 'Firefox'],
  ['safari', 'Safari'],
  ['safari_ios', 'Safari iOS'],
  ['chrome_android', 'Chrome Android'],
] as const;

type Entry = {
  name: string;
  support: Record<(typeof BROWSERS)[number][0], string | null>;
};

const TABLE = COMPAT as Record<string, Entry>;

export default function Compat({ keys }: { keys: string[] }) {
  const rows = keys.flatMap((key) => (TABLE[key] ? [TABLE[key]] : []));
  if (!rows.length) return null;
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption>Browser support, from version</caption>
        <thead>
          <tr>
            {BROWSERS.map(([id, label]) => (
              <th key={id} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        {rows.map(({ name, support }) => (
          <tbody key={name}>
            <tr>
              <th scope="rowgroup" colSpan={BROWSERS.length}>
                {name}
              </th>
            </tr>
            <tr>
              {BROWSERS.map(([id]) => (
                <td key={id} data-none={support[id] ? undefined : ''}>
                  {support[id] ?? 'No'}
                </td>
              ))}
            </tr>
          </tbody>
        ))}
      </table>
    </div>
  );
}
