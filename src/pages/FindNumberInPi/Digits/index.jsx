import { memo, useMemo } from 'react';
import styles from './index.module.css';
import Callout from '../Callout';

const CHUNK_SIZE = 100000;

const Chunk = memo(function Chunk({ digits, highlight }) {
  if (!highlight) return digits;

  const { id, from, to, isStart, isEnd, position, revealed, markRef } =
    highlight;

  return (
    <>
      {digits.slice(0, from)}
      <mark
        key={id}
        ref={isStart ? markRef : undefined}
        className={styles.mark}
        data-revealed={revealed}
      >
        {digits.slice(from, to)}
      </mark>
      {isEnd && revealed && (
        <Callout key={`callout-${id}`} position={position} />
      )}
      {digits.slice(to)}
    </>
  );
});

export default memo(function Digits({ digits, match, revealed, markRef }) {
  const chunks = useMemo(() => {
    const result = [];
    for (let offset = 0; offset < digits.length; offset += CHUNK_SIZE) {
      result.push(digits.slice(offset, offset + CHUNK_SIZE));
    }
    return result;
  }, [digits]);

  const highlightFor = (offset, length) => {
    if (!match) return null;
    const end = match.start + match.length;
    if (match.start >= offset + length || end <= offset) return null;

    return {
      id: match.id,
      from: Math.max(match.start - offset, 0),
      to: Math.min(end - offset, length),
      isStart: match.start >= offset,
      isEnd: end <= offset + length,
      position: match.start + 1,
      revealed,
      markRef,
    };
  };

  return (
    <p className={styles.digits}>
      <span className={styles.integer}>3.</span>
      {chunks.map((chunk, i) => (
        <Chunk
          key={i}
          digits={chunk}
          highlight={highlightFor(i * CHUNK_SIZE, chunk.length)}
        />
      ))}
    </p>
  );
});
