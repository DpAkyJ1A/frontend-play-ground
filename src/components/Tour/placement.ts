export const SHEET_MAX_WIDTH = 640;

export type TourSide = 'top' | 'bottom' | 'left' | 'right';
// `auto` tries bottom, top, right, left in that order
export type TourPlacement = TourSide | 'auto';

// viewport box around a step's targets, padding included
export type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
export type CardSize = { width: number; height: number };
export type CardPosition = { top: number; left: number };
export type PlaceCardOptions = {
  placement?: TourPlacement;
  gap?: number;
  margin?: number;
};

const OPPOSITE: Record<TourSide, TourSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};
const SIDES: TourSide[] = ['bottom', 'top', 'right', 'left'];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const findTargets = (name: string | undefined) =>
  name
    ? [...document.querySelectorAll(`[data-tour="${name}"]`)].filter(
        (el) => el.getClientRects().length > 0
      )
    : [];

export const measureTargets = (
  elements: Element[],
  padding: number
): TargetRect | null => {
  if (!elements.length) return null;
  const rects = elements.map((el) => el.getBoundingClientRect());
  const top = Math.max(Math.min(...rects.map((r) => r.top)) - padding, 0);
  const left = Math.max(Math.min(...rects.map((r) => r.left)) - padding, 0);
  const bottom = Math.min(
    Math.max(...rects.map((r) => r.bottom)) + padding,
    window.innerHeight
  );
  const right = Math.min(
    Math.max(...rects.map((r) => r.right)) + padding,
    window.innerWidth
  );
  return { top, left, width: right - left, height: bottom - top };
};

export const placeCard = (
  target: TargetRect | null,
  card: CardSize,
  { placement = 'auto', gap = 12, margin = 12 }: PlaceCardOptions = {}
): CardPosition => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!target) {
    return {
      top: (vh - card.height) / 2,
      left: (vw - card.width) / 2,
    };
  }

  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;

  if (vw <= SHEET_MAX_WIDTH) {
    return {
      top: centerY < vh / 2 ? vh - margin - card.height : margin,
      left: margin,
    };
  }

  const x = clamp(centerX - card.width / 2, margin, vw - margin - card.width);
  const y = clamp(centerY - card.height / 2, margin, vh - margin - card.height);
  const positions = {
    bottom: { top: target.top + target.height + gap, left: x },
    top: { top: target.top - gap - card.height, left: x },
    right: { top: y, left: target.left + target.width + gap },
    left: { top: y, left: target.left - gap - card.width },
  };
  const fits = {
    bottom: positions.bottom.top + card.height <= vh - margin,
    top: positions.top.top >= margin,
    right: positions.right.left + card.width <= vw - margin,
    left: positions.left.left >= margin,
  };
  const order =
    placement === 'auto'
      ? SIDES
      : [
          placement,
          OPPOSITE[placement],
          ...SIDES.filter((s) => s !== placement && s !== OPPOSITE[placement]),
        ];
  const side = order.find((s) => fits[s]);
  return side ? positions[side] : { top: vh - margin - card.height, left: x };
};
