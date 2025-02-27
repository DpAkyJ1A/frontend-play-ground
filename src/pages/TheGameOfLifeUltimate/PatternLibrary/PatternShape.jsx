export default function PatternShape({
  shape,
  gap = 0,
  minWidth = 0,
  minHeight = 0,
  stretch = false,
  className,
  style,
}) {
  const { width, height, cells } = shape;
  const viewWidth = Math.max(width, minWidth);
  const viewHeight = Math.max(height, minHeight);
  const inset = gap / 2;
  const size = 1 - gap;
  const path = cells
    .map(([x, y]) => `M${x + inset} ${y + inset}h${size}v${size}h${-size}z`)
    .join('');

  return (
    <svg
      className={className}
      style={style}
      viewBox={`${(width - viewWidth) / 2} ${
        (height - viewHeight) / 2
      } ${viewWidth} ${viewHeight}`}
      preserveAspectRatio={stretch ? 'none' : 'xMidYMid meet'}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}
