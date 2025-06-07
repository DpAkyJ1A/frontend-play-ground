export function isNumber(variable) {
  return !isNaN(parseFloat(variable)) && isFinite(variable);
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
