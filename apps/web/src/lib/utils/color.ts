type ColorShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export function getColorVar(color: string, shade: ColorShade) {
  return `var(--color-${color}-${shade})`;
}
