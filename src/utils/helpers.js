export function isNumber(variable) {
  return !isNaN(parseFloat(variable)) && isFinite(variable);
}
