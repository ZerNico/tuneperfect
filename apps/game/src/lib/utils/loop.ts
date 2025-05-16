export function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function times(count: number) {
  return Array.from({ length: count }, (_, i) => i);
}
