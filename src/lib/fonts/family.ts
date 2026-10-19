// The face's own family name, without next/font's metric-matched Arial
// fallback, so glyphs the face lacks (π) still come from the system fonts.
export const fontFamily = (font: { style: { fontFamily: string } }) =>
  font.style.fontFamily.split(',')[0];
