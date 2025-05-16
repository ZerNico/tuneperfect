import type { User } from "~/lib/types";

export type Matchup = [User, User];

export function generateMatchups(users: User[]): Matchup[] {
  if (users.length < 2) {
    return [];
  }

  const matchups: Matchup[] = [];

  const participants: (User | null)[] = users.length % 2 === 1 ? [...users, null] : [...users];
  const n = participants.length;

  const range = (count: number) => [...Array(count).keys()];

  for (const _ of range(n - 1)) {
    const roundMatchups = range(Math.floor(n / 2))
      .map((i) => {
        const player1 = participants[i];
        const player2 = participants[n - 1 - i];

        return !!player1 && !!player2 ? ([player1, player2] as Matchup) : null;
      })
      .filter((matchup): matchup is Matchup => matchup !== null);

    matchups.push(...roundMatchups);

    if (n > 2) {
      const first = participants[0];
      if (first === undefined) continue;

      const last = participants[n - 1];
      if (last === undefined) continue;

      const middle = participants.slice(1, n - 1);

      const rotated = [first, last, ...middle];
      participants.splice(0, participants.length, ...rotated);
    }
  }

  return matchups;
}
