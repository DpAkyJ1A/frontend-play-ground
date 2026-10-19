import { forwardRef } from 'react';
import type { CardPosition } from './placement';
import type { TourLabels, TourStep } from './Tour';
import styles from './index.module.css';

export type TourCardProps = {
  step: TourStep;
  index: number;
  count: number;
  labels: TourLabels;
  titleId: string;
  bodyId: string;
  position: CardPosition | null;
  animate: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};

const TourCard = forwardRef<HTMLDivElement, TourCardProps>(function TourCard(
  {
    step,
    index,
    count,
    labels,
    titleId,
    bodyId,
    position,
    animate,
    onBack,
    onNext,
    onSkip,
  },
  ref
) {
  const isLast = index === count - 1;

  return (
    <div
      ref={ref}
      className={styles.card}
      style={position ?? undefined}
      data-hidden={position ? undefined : ''}
      data-animate={animate ? '' : undefined}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      <p className={styles.progress}>{labels.progress(index + 1, count)}</p>
      <h2 id={titleId} className={styles.title}>
        {step.title}
      </h2>
      <p id={bodyId} className={styles.body}>
        {step.body}
      </p>
      <div className={styles.actions}>
        {!isLast && (
          <button className={styles.skip} onClick={onSkip}>
            {labels.skip}
          </button>
        )}
        {index > 0 && (
          <button className={styles.button} onClick={onBack}>
            {labels.back}
          </button>
        )}
        <button
          className={`${styles.button} ${styles.primary}`}
          onClick={onNext}
        >
          {isLast ? labels.done : labels.next}
        </button>
      </div>
    </div>
  );
});

export default TourCard;
