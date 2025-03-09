import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Spotlight from './Spotlight';
import TourCard from './TourCard';
import { findTargets, measureTargets, placeCard } from './placement';
import styles from './index.module.css';

const DEFAULT_LABELS = {
  back: 'Back',
  next: 'Next',
  done: 'Done',
  skip: 'Skip tour',
  progress: (step, count) => `${step} of ${count}`,
};
const DEFAULT_PADDING = 8;
const STABLE_FRAMES = 6;
const SETTLE_TIMEOUT = 1000;

const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

const rectKey = (rect) =>
  rect ? `${rect.top}|${rect.left}|${rect.width}|${rect.height}` : '';

const settle = async (elements, padding, isStale) => {
  const start = performance.now();
  let last = '';
  let stable = 0;
  while (stable < STABLE_FRAMES && performance.now() - start < SETTLE_TIMEOUT) {
    await nextFrame();
    if (isStale()) return null;
    const key = rectKey(measureTargets(elements, padding));
    stable = key === last ? stable + 1 : 0;
    last = key;
  }
  return measureTargets(elements, padding);
};

const reveal = async (elements, padding, isStale) => {
  let rect = null;
  for (let pass = 0; pass < 2 && !isStale(); pass++) {
    elements[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    rect = await settle(elements, padding, isStale);
  }
  return rect;
};

export default function Tour({ steps, open, onClose, labels, className = '' }) {
  const dialogRef = useRef(null);
  const cardRef = useRef(null);
  const stepsRef = useRef(steps);
  const elementsRef = useRef([]);
  const runRef = useRef(0);
  const [request, setRequest] = useState({ index: 0, direction: 1 });
  const [active, setActive] = useState(null);
  const [position, setPosition] = useState(null);
  const [animate, setAnimate] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const text = { ...DEFAULT_LABELS, ...labels };
  stepsRef.current = steps;

  const activeIndex = active?.index ?? -1;
  const step = active ? steps[active.index] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (open) return;
    if (dialog.open) dialog.close();
    setRequest({ index: 0, direction: 1 });
    setActive(null);
    setPosition(null);
    setAnimate(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const run = ++runRef.current;
    const isStale = () => run !== runRef.current;

    const show = async () => {
      const all = stepsRef.current;
      for (
        let index = request.index;
        index >= 0 && index < all.length;
        index += request.direction
      ) {
        const current = all[index];
        await current.onEnter?.();
        await nextFrame();
        await nextFrame();
        if (isStale()) return;
        const elements = findTargets(current.target);
        if (current.target && !elements.length) continue;
        const rect = current.target
          ? await reveal(elements, current.padding ?? DEFAULT_PADDING, isStale)
          : null;
        if (isStale()) return;
        elementsRef.current = elements;
        setActive({ index, rect });
        return;
      }
      if (!isStale()) dialogRef.current.close();
    };

    show();
    return () => {
      runRef.current += 1;
    };
  }, [open, request]);

  useEffect(() => {
    if (activeIndex < 0) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = stepsRef.current[activeIndex];
        const rect = current.target
          ? measureTargets(
              elementsRef.current,
              current.padding ?? DEFAULT_PADDING
            )
          : null;
        setActive((prev) =>
          prev && rectKey(prev.rect) !== rectKey(rect)
            ? { ...prev, rect }
            : prev
        );
      });
    };
    const observer = new ResizeObserver(update);
    elementsRef.current.forEach((el) => observer.observe(el));
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [activeIndex]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!active || !card) return;
    setPosition(
      placeCard(
        active.rect,
        { width: card.offsetWidth, height: card.offsetHeight },
        { placement: stepsRef.current[active.index].placement }
      )
    );
  }, [active]);

  useEffect(() => {
    if (!position || animate) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [position, animate]);

  useEffect(() => {
    if (activeIndex >= 0) cardRef.current?.focus({ preventScroll: true });
  }, [activeIndex]);

  const goTo = (index, direction) => setRequest({ index, direction });

  const next = () => {
    if (activeIndex >= steps.length - 1) dialogRef.current.close();
    else goTo(activeIndex + 1, 1);
  };

  const back = () => {
    if (activeIndex > 0) goTo(activeIndex - 1, -1);
  };

  const handleKeyDown = (e) => {
    if (activeIndex < 0) return;
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
    else return;
    e.preventDefault();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`${styles.tour} ${className}`}
      aria-labelledby={step ? titleId : undefined}
      aria-describedby={step ? bodyId : undefined}
      onKeyDown={handleKeyDown}
    >
      <Spotlight rect={active?.rect} radius={step?.radius} />
      {step && (
        <TourCard
          ref={cardRef}
          step={step}
          index={active.index}
          count={steps.length}
          labels={text}
          titleId={titleId}
          bodyId={bodyId}
          position={position}
          animate={animate}
          onBack={back}
          onNext={next}
          onSkip={() => dialogRef.current.close()}
        />
      )}
    </dialog>
  );
}
