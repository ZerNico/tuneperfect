export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function loop(value: number, min: number, max: number): number {
  return value < min ? max : value > max ? min : value;
}
