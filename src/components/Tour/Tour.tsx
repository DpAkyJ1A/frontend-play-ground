import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Spotlight from './Spotlight';
import TourCard from './TourCard';
import {
  findTargets,
  measureTargets,
  placeCard,
  type CardPosition,
  type TargetRect,
  type TourPlacement,
} from './placement';
import styles from './index.module.css';

export type TourStep = {
  // `data-tour` name of the elements to highlight; none centers the card
  target?: string;
  title: ReactNode;
  body: ReactNode;
  placement?: TourPlacement;
  padding?: number;
  radius?: number;
  // awaited (may return a promise) before the targets are looked up
  onEnter?: () => unknown;
};

export type TourLabels = {
  back: ReactNode;
  next: ReactNode;
  done: ReactNode;
  skip: ReactNode;
  progress: (step: number, count: number) => ReactNode;
};

export type TourProps = {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  labels?: Partial<TourLabels>;
  className?: string;
};

type Direction = 1 | -1;
type StepRequest = { index: number; direction: Direction };
type Active = { index: number; rect: TargetRect | null };

const DEFAULT_LABELS: TourLabels = {
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

const rectKey = (rect: TargetRect | null) =>
  rect ? `${rect.top}|${rect.left}|${rect.width}|${rect.height}` : '';

const settle = async (
  elements: Element[],
  padding: number,
  isStale: () => boolean
) => {
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

const reveal = async (
  elements: Element[],
  padding: number,
  isStale: () => boolean
) => {
  let rect: TargetRect | null = null;
  for (let pass = 0; pass < 2 && !isStale(); pass++) {
    elements[0].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    rect = await settle(elements, padding, isStale);
  }
  return rect;
};

export default function Tour({
  steps,
  open,
  onClose,
  labels,
  className = '',
}: TourProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef(steps);
  const elementsRef = useRef<Element[]>([]);
  const runRef = useRef(0);
  const [request, setRequest] = useState<StepRequest>({
    index: 0,
    direction: 1,
  });
  const [active, setActive] = useState<Active | null>(null);
  const [position, setPosition] = useState<CardPosition | null>(null);
  const [animate, setAnimate] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const [wasOpen, setWasOpen] = useState(open);
  const text = { ...DEFAULT_LABELS, ...labels };

  // Closing rewinds the tour for the next run.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setRequest({ index: 0, direction: 1 });
      setActive(null);
      setPosition(null);
      setAnimate(false);
    }
  }

  // Effects and the async step logic read the latest steps without re-running.
  useLayoutEffect(() => {
    stepsRef.current = steps;
  });

  const activeIndex = active?.index ?? -1;
  const step = active ? steps[active.index] : null;

  useEffect(() => {
    const dialog = dialogRef.current!;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
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
      if (!isStale()) dialogRef.current!.close();
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

  const goTo = (index: number, direction: Direction) =>
    setRequest({ index, direction });

  const next = () => {
    if (activeIndex >= steps.length - 1) dialogRef.current!.close();
    else goTo(activeIndex + 1, 1);
  };

  const back = () => {
    if (activeIndex > 0) goTo(activeIndex - 1, -1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
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
          index={activeIndex}
          count={steps.length}
          labels={text}
          titleId={titleId}
          bodyId={bodyId}
          position={position}
          animate={animate}
          onBack={back}
          onNext={next}
          onSkip={() => dialogRef.current!.close()}
        />
      )}
    </dialog>
  );
}
