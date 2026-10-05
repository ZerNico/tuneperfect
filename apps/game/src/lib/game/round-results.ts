import { useMutation, useQuery } from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal } from "solid-js";

import { client } from "~/lib/orpc";
import { highscoreQueryOptions } from "~/lib/queries";
import type { User } from "~/lib/types";
import { getMaxScore, getRelativeScore, getTier, MAX_POSSIBLE_SCORE, type TierId } from "~/lib/utils/score";
import { isGuestUser, isLocalUser } from "~/lib/utils/user";
import { lobbyStore } from "~/stores/lobby";
import { localStore } from "~/stores/local";
import { createEmptyStats, type PlayerStats, roundStore, type Score } from "~/stores/round";
import { settingsStore } from "~/stores/settings";

export interface PlayerResult {
  player: User;
  micColor: string;
  total: number;
  tier: TierId;
  stats: PlayerStats;
}

/**
 * Everything the results screen needs about the finished round: each player's
 * total (summed over a medley), tier and stats, plus highscores. Also saves the
 * new scores and remembers each player's previous best to detect new records.
 */
export function useRoundResults() {
  const results = () => roundStore.results();
  const difficulty = () => settingsStore.general().difficulty;
  const songHash = () => results()[0]?.song.song.hash;

  /** Only single, full-length songs count for highscores. */
  const tracksHighscore = () => {
    const res = results();
    return res.length === 1 && res[0]?.song.mode === "single" && res[0]?.song.length === "full";
  };

  /** Best possible total: 100k per song in the round. */
  const maxScore = () => results().length * MAX_POSSIBLE_SCORE;

  const players = createMemo<PlayerResult[]>(() => {
    const all = results();
    const first = all[0];
    if (!first) return [];

    // The players of the first song are the players of the whole round.
    return first.song.players.flatMap((selection, index) => {
      if (!selection) return [];

      const score: Score = { normal: 0, golden: 0, bonus: 0 };
      const stats = createEmptyStats();

      for (const result of all) {
        const songStats = result.stats[index];
        if (songStats) {
          stats.maxCombo = Math.max(stats.maxCombo, songStats.maxCombo);
          stats.notesHit += songStats.notesHit;
          stats.notesTotal += songStats.notesTotal;
          stats.goldenNotesHit += songStats.goldenNotesHit;
          stats.goldenNotesTotal += songStats.goldenNotesTotal;
          stats.perfectPhrases += songStats.perfectPhrases;
          stats.phrasesTotal += songStats.phrasesTotal;
        }

        const voiceIndex = result.song.players[index]?.voice;
        const voice = voiceIndex === undefined ? undefined : result.song.song.voices[voiceIndex];
        if (!voice) continue;

        const relative = getRelativeScore(
          result.scores[index] ?? { normal: 0, golden: 0, bonus: 0 },
          getMaxScore(voice),
        );
        score.normal += relative.normal;
        score.golden += relative.golden;
        score.bonus += relative.bonus;
      }

      const total = Math.floor(score.normal + score.golden + score.bonus);
      return [
        {
          player: selection.player,
          micColor: selection.microphone.color,
          total,
          tier: getTier(total, maxScore()).id,
          stats,
        },
      ];
    });
  });

  const topScore = createMemo(() => Math.max(0, ...players().map((result) => result.total)));

  const onlineEnabled = () => tracksHighscore() && !!songHash();
  const onlineHighscores = useQuery(() => {
    const options = highscoreQueryOptions(songHash() ?? "", difficulty());
    return { ...options, enabled: onlineEnabled() };
  });

  /** Online and local highscores plus this round's scores (the list de-duplicates per player). */
  const highscores = () => {
    const hash = songHash();
    if (!tracksHighscore() || !hash) return [];

    return [
      ...(onlineHighscores.data ?? []),
      ...localStore.getScoresForSong(hash, difficulty()),
      ...players()
        .filter((result) => !isGuestUser(result.player) && result.total > 0)
        .map((result) => ({ user: result.player, score: result.total })),
    ];
  };

  // Each player's best before this round, captured before the new scores are saved.
  const [previousBest, setPreviousBest] = createSignal<ReadonlyMap<string, number>>(new Map());
  const rememberBest = (scores: { user: User; score: number }[]) => {
    setPreviousBest((previous) => {
      const next = new Map(previous);
      for (const { user, score } of scores) {
        const id = String(user.id);
        next.set(id, Math.max(next.get(id) ?? 0, score));
      }
      return next;
    });
  };

  const save = useMutation(() => ({
    mutationFn: async () => {
      const hash = songHash();
      if (!tracksHighscore() || !hash) return;

      const online: Promise<unknown>[] = [];
      for (const result of players()) {
        if (isGuestUser(result.player) || result.total <= 0) continue;

        if (isLocalUser(result.player)) {
          localStore.addScore(result.player.id, hash, difficulty(), result.total);
          continue;
        }

        // API users can only be saved with a lobby connection.
        if (!lobbyStore.lobby()) continue;

        online.push(
          client.highscore.setHighscore.call({
            hash,
            userId: result.player.id.toString(),
            score: result.total,
            difficulty: difficulty(),
          }),
        );
      }

      // One failed upload (someone left the lobby, the API is down) mustn't skip the others.
      for (const outcome of await Promise.allSettled(online)) {
        if (outcome.status === "rejected") console.error("Failed to save an online highscore:", outcome.reason);
      }
    },
  }));

  const [committed, setCommitted] = createSignal(false);
  const onlineSettled = () => !onlineEnabled() || !onlineHighscores.isPending;

  // Saves once the online scores are in (the query never fails, it returns null offline), so
  // they are the ones from before this round and a record is never missed.
  createEffect(() => {
    if (!committed() || !onlineSettled() || !save.isIdle) return;

    const online = onlineHighscores.data;
    if (online) rememberBest(online);
    save.mutate();
  });

  const isNewRecord = (result: PlayerResult) => {
    if (!tracksHighscore() || isGuestUser(result.player)) return false;
    const best = previousBest().get(String(result.player.id));
    return best !== undefined && result.total > best;
  };

  /** Call once when the screen opens: marks songs as played and saves the scores. */
  const commit = () => {
    for (const result of results()) {
      localStore.markSongPlayed(result.song.song.hash);
    }

    const hash = songHash();
    if (tracksHighscore() && hash) {
      rememberBest(localStore.getScoresForSong(hash, difficulty()));
    }

    setCommitted(true);
  };

  return {
    players,
    maxScore,
    topScore,
    tracksHighscore,
    highscores,
    isNewRecord,
    commit,
    saving: () => committed() && (save.isIdle || save.isPending),
  };
}
