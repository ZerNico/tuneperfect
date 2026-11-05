export function toShuffled<T>(array: T[]): T[] {
  if (array.length <= 1) {
    return [...array];
  }

  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp: T = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Where the item `id` was in `previous` turned up in `items` after it went away: the index of
 * its nearest neighbour from `previous` that is still there (the next one first), or 0.
 */
export function nearestSurvivorIndex<T>(previous: T[], items: T[], id: string, getId: (item: T) => string): number {
  const at = previous.findIndex((item) => getId(item) === id);
  if (at === -1) return 0;
  const indices = new Map(items.map((item, index) => [getId(item), index]));
  for (let distance = 1; distance < previous.length; distance++) {
    for (const neighbour of [previous[at + distance], previous[at - distance]]) {
      const index = neighbour === undefined ? undefined : indices.get(getId(neighbour));
      if (index !== undefined) return index;
    }
  }
  return 0;
}
