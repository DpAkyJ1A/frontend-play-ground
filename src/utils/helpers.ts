export function isNumber(variable: unknown) {
  return !isNaN(parseFloat(String(variable))) && isFinite(Number(variable));
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Canvas can't resolve CSS variables, and next/font exposes font families only
// through them (under generated names).
export function resolveCssVariables(
  value: string,
  element: Element = document.documentElement
) {
  const computed = getComputedStyle(element);
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) =>
    computed.getPropertyValue(name).trim()
  );
}
