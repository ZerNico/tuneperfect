import { beatToMs } from "./bpm";
import type { LocalSong } from "./song";

interface PhraseAnalysis {
  startTime: number;
  endTime: number;
  noteCount: number;
  goldenNoteCount: number;
  notesDensity: number;
  lyricText: string;
}

/**
 * Finds a smart preview position by analyzing the song structure.
 * Looks for dense singing areas, repeated patterns, and golden notes.
 */
export function findSmartPreviewPosition(song: LocalSong): number | null {
  const phraseAnalysis = collectPhraseAnalysis(song);
  if (phraseAnalysis.length === 0) return null;

  const strategies = [
    () => findChorusCandidate(phraseAnalysis),
    () => findGoldenDenseArea(phraseAnalysis),
    () => findMiddleHighDensityArea(phraseAnalysis),
    () => findSkipEarlyArea(phraseAnalysis),
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result) {
      return result.startTime - 1;
    }
  }

  return null;
}

function collectPhraseAnalysis(song: LocalSong): PhraseAnalysis[] {
  if (!song.voices?.length) return [];

  const analysis: PhraseAnalysis[] = [];

  for (const voice of song.voices) {
    if (!voice?.phrases) continue;

    for (const phrase of voice.phrases) {
      if (!phrase?.notes?.length) continue;

      const firstNote = phrase.notes[0];
      const lastNote = phrase.notes[phrase.notes.length - 1];
      if (!firstNote || !lastNote) continue;

      const startTime = beatToMs(song, firstNote.startBeat) / 1000;
      const endTime = beatToMs(song, lastNote.startBeat + lastNote.length) / 1000;
      const duration = endTime - startTime;

      if (duration <= 0) continue;

      analysis.push({
        startTime,
        endTime,
        noteCount: phrase.notes.length,
        goldenNoteCount: phrase.notes.filter((note) => note.type === "Golden").length,
        notesDensity: phrase.notes.length / duration,
        lyricText: phrase.notes
          .map((note) => note.text || "")
          .join("")
          .toLowerCase(),
      });
    }
  }

  return analysis.sort((a, b) => a.startTime - b.startTime);
}

function findBestPhrase(phrases: PhraseAnalysis[], scoreFn: (phrase: PhraseAnalysis) => number): PhraseAnalysis | null {
  if (phrases.length === 0) return null;
  return phrases.reduce((best, current) => (scoreFn(current) > scoreFn(best) ? current : best));
}

function findChorusCandidate(phraseAnalysis: PhraseAnalysis[]): PhraseAnalysis | null {
  const textGroups = new Map<string, PhraseAnalysis[]>();

  // Group phrases by normalized lyrics
  for (const analysis of phraseAnalysis) {
    const normalizedText = analysis.lyricText.replace(/[^\w\s]/g, "").trim();
    if (normalizedText.length < 10) continue;

    if (!textGroups.has(normalizedText)) {
      textGroups.set(normalizedText, []);
    }
    textGroups.get(normalizedText)?.push(analysis);
  }

  const totalDuration = Math.max(...phraseAnalysis.map((p) => p.endTime));
  let bestCandidate: PhraseAnalysis | null = null;
  let bestScore = 0;

  for (const phrases of textGroups.values()) {
    if (phrases.length < 2) continue;

    // Sort by start time to prefer earlier occurrences
    phrases.sort((a, b) => a.startTime - b.startTime);

    // Only consider occurrences in the first 70% of the song
    const validPhrases = phrases.filter((p) => p.startTime / totalDuration < 0.7);
    if (validPhrases.length < 2) continue;

    // Calculate score for this repeated pattern
    const avgGoldenNotes = validPhrases.reduce((sum, p) => sum + p.goldenNoteCount, 0) / validPhrases.length;
    const avgDensity = validPhrases.reduce((sum, p) => sum + p.notesDensity, 0) / validPhrases.length;

    // Strong preference for earlier choruses
    const firstOccurrence = validPhrases[0];
    if (!firstOccurrence) continue;

    const positionInSong = firstOccurrence.startTime / totalDuration;
    const earlinessBonus = positionInSong < 0.3 ? 2.0 : positionInSong < 0.5 ? 1.5 : 1.0;

    const score = validPhrases.length * (1 + avgGoldenNotes) * avgDensity * earlinessBonus;

    if (score > bestScore) {
      bestScore = score;
      // Choose first or second occurrence, preferring first if it's not too early
      const chosenPhrase = positionInSong > 0.15 ? firstOccurrence : (validPhrases[1] ?? firstOccurrence);
      bestCandidate = findChorusStart(phraseAnalysis, chosenPhrase);
    }
  }

  return bestCandidate;
}

function findChorusStart(phraseAnalysis: PhraseAnalysis[], chorusPhrase: PhraseAnalysis): PhraseAnalysis {
  const chorusTime = chorusPhrase.startTime;

  // Look for phrases within 10 seconds before the detected chorus
  const candidateStarts = phraseAnalysis.filter(
    (p) => p.startTime >= chorusTime - 10 && p.startTime <= chorusTime && p.noteCount >= 2,
  );

  if (candidateStarts.length <= 1) return chorusPhrase;

  // Find the earliest phrase that has high energy or starts after a gap
  for (let i = 0; i < candidateStarts.length - 1; i++) {
    const currentPhrase = candidateStarts[i];
    const previousPhrase = candidateStarts[i - 1];

    if (!currentPhrase) continue;

    // If there's a gap before this phrase, it might be the chorus start
    if (i === 0 || (previousPhrase && currentPhrase.startTime - previousPhrase.endTime > 1.5)) {
      return currentPhrase;
    }

    // If this phrase has high energy (golden notes or high density), use it
    if (currentPhrase.goldenNoteCount > 0 || currentPhrase.notesDensity > 2) {
      return currentPhrase;
    }
  }

  // If no clear start found, use the earliest candidate that's not the detected phrase
  return candidateStarts[0] ?? chorusPhrase;
}

function findGoldenDenseArea(phraseAnalysis: PhraseAnalysis[]): PhraseAnalysis | null {
  const goldenPhrases = phraseAnalysis.filter((p) => p.goldenNoteCount > 0);
  return findBestPhrase(goldenPhrases, (p) => (p.goldenNoteCount / p.noteCount) * p.notesDensity);
}

function findMiddleHighDensityArea(phraseAnalysis: PhraseAnalysis[]): PhraseAnalysis | null {
  const totalDuration = Math.max(...phraseAnalysis.map((p) => p.endTime));
  const middlePhrases = phraseAnalysis.filter((p) => {
    const position = p.startTime / totalDuration;
    return position >= 0.25 && position <= 0.75 && p.noteCount >= 3;
  });

  return findBestPhrase(middlePhrases, (p) => p.notesDensity);
}

function findSkipEarlyArea(phraseAnalysis: PhraseAnalysis[]): PhraseAnalysis | null {
  const totalDuration = Math.max(...phraseAnalysis.map((p) => p.endTime));
  const laterPhrases = phraseAnalysis.filter((p) => p.startTime >= totalDuration * 0.25 && p.noteCount >= 2);

  return findBestPhrase(laterPhrases, (p) => p.noteCount * p.notesDensity);
}
