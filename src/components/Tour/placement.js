export const SHEET_MAX_WIDTH = 640;

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const SIDES = ['bottom', 'top', 'right', 'left'];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const findTargets = (name) =>
  name
    ? [...document.querySelectorAll(`[data-tour="${name}"]`)].filter(
        (el) => el.getClientRects().length > 0
      )
    : [];

export const measureTargets = (elements, padding) => {
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
  target,
  card,
  { placement = 'auto', gap = 12, margin = 12 } = {}
) => {
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
