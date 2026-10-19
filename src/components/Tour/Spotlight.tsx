import type { TargetRect } from './placement';
import styles from './index.module.css';

export type SpotlightProps = {
  rect?: TargetRect | null;
  radius?: number;
};

export default function Spotlight({ rect, radius = 12 }: SpotlightProps) {
  const style = rect
    ? { ...rect, borderRadius: radius }
    : { top: '50%', left: '50%', width: 0, height: 0, borderRadius: 0 };

  return <div className={styles.spotlight} style={style} aria-hidden="true" />;
}
