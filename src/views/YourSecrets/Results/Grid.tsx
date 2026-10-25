import { useLayoutEffect, useRef } from 'react';
import type { Probe, ProbeResult } from '../probes/types';
import Card from './Card';
import styles from './index.module.css';

export type GridProps = {
  order: Probe[];
  isVisible: (probe: Probe) => boolean;
  results: ReadonlyMap<string, ProbeResult>;
  hideEmpty: boolean;
  onResult: (id: string, result: ProbeResult) => void;
  onInfo: (probe: Probe) => void;
};

type Spot = { x: number; y: number };

export default function Grid({
  order,
  isVisible,
  results,
  hideEmpty,
  onResult,
  onInfo,
}: GridProps) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const spots = useRef(new Map<string, Spot>());
  const lastKey = useRef<string | null>(null);
  const key = `${order.map((p) => (isVisible(p) ? p.id : `-${p.id}`)).join(' ')} ${hideEmpty}`;

  useLayoutEffect(() => {
    const before = spots.current;
    const after = new Map<string, Spot>();
    for (const [id, node] of nodes.current) {
      if (!node.hidden)
        after.set(id, { x: node.offsetLeft, y: node.offsetTop });
    }
    spots.current = after;
    const changed = lastKey.current !== null && lastKey.current !== key;
    lastKey.current = key;
    if (
      !changed ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    for (const [id, to] of after) {
      const node = nodes.current.get(id)!;
      const from = before.get(id);
      if (!from) {
        node.animate(
          [
            { opacity: 0, transform: 'scale(0.97)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 320, easing: 'ease-out' }
        );
        continue;
      }
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      if (dx || dy)
        node.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );
    }
  });

  return (
    <div className={styles.grid}>
      {order.map((probe) => (
        <Card
          key={probe.id}
          probe={probe}
          result={results.get(probe.id)}
          hidden={!isVisible(probe)}
          hideEmpty={hideEmpty}
          cardRef={(node) => {
            if (node) nodes.current.set(probe.id, node);
            else nodes.current.delete(probe.id);
          }}
          onResult={onResult}
          onInfo={onInfo}
        />
      ))}
    </div>
  );
}
