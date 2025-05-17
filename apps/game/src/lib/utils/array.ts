export function toShuffled<T>(array: T[]): T[] {
  if (array.length <= 1) {
    return [...array];
  }

  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // biome-ignore lint/style/noNonNullAssertion: Element is guaranteed to be defined
    const temp: T = result[i]!;
    // biome-ignore lint/style/noNonNullAssertion: Element is guaranteed to be defined
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}