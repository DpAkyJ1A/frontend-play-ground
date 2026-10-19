import { useLayoutEffect, useRef, useState } from 'react';
import styles from './index.module.css';
import { Typewriter } from '@/components';

const EDGE_GAP = 16;

type Props = { position: number };

export default function Callout({ position }: Props) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const [side, setSide] = useState<'right' | 'left'>('right');

  useLayoutEffect(() => {
    const { right } = boxRef.current!.getBoundingClientRect();
    if (right > document.documentElement.clientWidth - EDGE_GAP) {
      setSide('left');
    }
  }, []);

  return (
    <span className={styles.anchor}>
      <span ref={boxRef} className={styles.callout} data-side={side}>
        <Typewriter
          text={`i = ${position.toLocaleString('en-US')}`}
          delay={900}
        />
      </span>
    </span>
  );
}
