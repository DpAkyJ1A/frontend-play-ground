// The loupe: when the gaze settles where buttons are crowded, the area around it
// is shown magnified and the choice is made in there. The gaze error stays the
// same in screen pixels, so at ×3 it shrinks to a third of the button spacing.

const MARGIN = 16;
// room around the buttons, so their edges and the aim ring aren't cut off
const PADDING = 12;

// What the loupe shows: everything within `reach` of the gaze — where the button
// you mean almost surely is — plus the whole of every button that reaches into
// that circle, so none is cut in half. Magnified by `zoom`, or less if that
// wouldn't fit: a loupe that cuts off the right button is worse than a weaker
// one. The spot you looked at stays where it was, unless the loupe has to be
// pushed back inside the viewport.
export function layoutLoupe(anchor, reach, rects, zoom, viewport) {
  const region = {
    left: Math.min(anchor.x - reach, ...rects.map((r) => r.left - PADDING)),
    top: Math.min(anchor.y - reach, ...rects.map((r) => r.top - PADDING)),
    right: Math.max(anchor.x + reach, ...rects.map((r) => r.right + PADDING)),
    bottom: Math.max(anchor.y + reach, ...rects.map((r) => r.bottom + PADDING)),
  };
  const regionWidth = region.right - region.left;
  const regionHeight = region.bottom - region.top;
  const scale = Math.max(
    1,
    Math.min(
      zoom,
      (viewport.width - MARGIN * 2) / regionWidth,
      (viewport.height - MARGIN * 2) / regionHeight
    )
  );
  const width = regionWidth * scale;
  const height = regionHeight * scale;
  const place = (start, size, extent) =>
    Math.min(Math.max(start, MARGIN), Math.max(extent - MARGIN - size, MARGIN));

  return {
    anchor,
    region,
    zoom: scale,
    width,
    height,
    left: place(anchor.x - (anchor.x - region.left) * scale, width, viewport.width),
    top: place(anchor.y - (anchor.y - region.top) * scale, height, viewport.height),
  };
}

export const insideLoupe = (loupe, point, margin = 0) =>
  point.x >= loupe.left - margin &&
  point.x <= loupe.left + loupe.width + margin &&
  point.y >= loupe.top - margin &&
  point.y <= loupe.top + loupe.height + margin;

// The part of a rect (viewport coordinates) that shows through the loupe.
export function visibleInLoupe(loupe, rect) {
  const left = Math.max(rect.left, loupe.left);
  const top = Math.max(rect.top, loupe.top);
  const right = Math.min(rect.right, loupe.left + loupe.width);
  const bottom = Math.min(rect.bottom, loupe.top + loupe.height);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

// Puts a point of the page (viewport coordinates) where it shows in the loupe.
export const loupeTransform = ({ region, zoom }) =>
  `translate(${-region.left * zoom}px, ${-region.top * zoom}px) scale(${zoom})`;
