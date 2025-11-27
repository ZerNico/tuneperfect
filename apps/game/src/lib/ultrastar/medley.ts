import { beatToMs } from "./bpm";
import type { Phrase } from "./phrase";
import type { LocalSong } from "./song";

const MEDLEY_MIN_DURATION_MS = 30000; // 30 seconds
const MEDLEY_BUFFER_MS = 3000; // 3 seconds buffer before and after

export function getMedleySong(song: LocalSong) {
  const medleyBeats = getMedleyBeats(song);
  
  if (!medleyBeats) {
    // If no medley found, return original song
    return song;
  }

  const { startBeat, endBeat } = medleyBeats;
  const medleyStartMs = beatToMs(song, startBeat);
  const medleyEndMs = beatToMs(song, endBeat);

  // Filter phrases to only include those within the medley beat range
  const filteredVoices = song.voices.map(voice => {
    const filteredPhrases = (voice.phrases ?? []).filter(phrase => {
      // Include phrase if any of its notes fall within the medley range
      return phrase.notes.some(note => {
        const noteStartBeat = note.startBeat;
        const noteEndBeat = note.startBeat + note.length;
        // Phrase is included if it overlaps with the medley range
        return noteStartBeat < endBeat && noteEndBeat > startBeat;
      });
    });

    return {
      ...voice,
      phrases: filteredPhrases,
    };
  });

  return {
    ...song,
    start: medleyStartMs - MEDLEY_BUFFER_MS,
    end: medleyEndMs + MEDLEY_BUFFER_MS,
    voices: filteredVoices,
  };
}

function getMedleyBeats(song: LocalSong) {
  // If medley beats are explicitly set, use them
  if (song.medleyStartBeat !== null && song.medleyEndBeat !== null) {
    return {
      startBeat: song.medleyStartBeat,
      endBeat: song.medleyEndBeat,
    };
  }

  const phrases = getAllPhrases(song);
  
  if (phrases.length === 0) {
    return null;
  }

  // Find all medley candidates by detecting repeated sections
  const medleyCandidates = findRepeatedSections(phrases);

  // If no medley candidates found, fallback to middle estimate
  if (medleyCandidates.length === 0) {
    return getFallbackMedleyBeats(song, phrases);
  }

  // Find the longest medley candidate (backwards to take first longest, not last longest)
  const longestCandidate = findLongestCandidate(medleyCandidates);
  if (!longestCandidate) {
    return getFallbackMedleyBeats(song, phrases);
  }

  const { start: medleyStartLine, end: medleyEndLine } = longestCandidate;
  const medleyLineCount = medleyEndLine - medleyStartLine + 1;

  // Need at least 3 lines for a valid medley
  if (medleyLineCount <= 3) {
    return getFallbackMedleyBeats(song, phrases);
  }

  // Calculate beat positions
  const startPhrase = phrases[medleyStartLine];
  const endPhrase = phrases[medleyEndLine];
  
  if (!startPhrase || !endPhrase) {
    return getFallbackMedleyBeats(song, phrases);
  }

  const firstNote = startPhrase.notes[0];
  const lastNoteStart = startPhrase.notes[startPhrase.notes.length - 1];
  const lastNoteEnd = endPhrase.notes[endPhrase.notes.length - 1];
  
  if (!firstNote || !lastNoteStart || !lastNoteEnd) {
    return getFallbackMedleyBeats(song, phrases);
  }

  // Medley Start Beat: timestamp of the first note in the start line
  const medleyStartBeat = firstNote.startBeat;
  
  // Medley End Beat: timestamp of the last note in the start line plus the duration of the last note in the end line
  let medleyEndBeat = lastNoteStart.startBeat + lastNoteEnd.length;

  // Validate minimum duration - extend if needed
  const medleyStartMs = beatToMs(song, medleyStartBeat);
  const medleyEndMs = beatToMs(song, medleyEndBeat);
  const medleyDuration = medleyEndMs - medleyStartMs;

  if (medleyDuration < MEDLEY_MIN_DURATION_MS) {
    medleyEndBeat = extendToMinimumDuration(
      song,
      phrases,
      medleyStartBeat,
      medleyEndBeat,
    );
  }

  return {
    startBeat: medleyStartBeat,
    endBeat: medleyEndBeat,
  };
}

function getFallbackMedleyBeats(song: LocalSong, phrases: Phrase[]) {
  const lastPhrase = phrases[phrases.length - 1];
  const lastNote = lastPhrase?.notes[lastPhrase.notes.length - 1];
  
  if (!lastNote) {
    return null;
  }

  const songEndBeat = lastNote.startBeat + lastNote.length;
  const middleBeat = songEndBeat / 2;
  const bpm = song.bpm * 4;
  const medleyMinBeats = (MEDLEY_MIN_DURATION_MS * bpm) / (1000 * 60);
  const endBeat = middleBeat + medleyMinBeats;

  return {
    startBeat: middleBeat,
    endBeat,
  };
}

/**
 * Finds all repeated sections in the phrases by comparing each phrase
 * with phrases at least 4 positions later
 */
function findRepeatedSections(phrases: Phrase[]) {
  const candidates: { start: number; end: number }[] = [];

  for (let i = 0; i <= phrases.length - 2; i++) {
    const firstPhrase = phrases[i];
    if (!firstPhrase) continue;
    
    const firstLine = normalizePhraseText(firstPhrase);
    
    for (let j = i + 4; j <= phrases.length - 1; j++) {
      const secondPhrase = phrases[j];
      if (!secondPhrase) continue;
      
      const secondLine = normalizePhraseText(secondPhrase);
      
      if (firstLine === secondLine) {
        // Found a match, extend forward to find the full repeated block
        const tempMedleyStart = i;
        let tempMedleyEnd = i;
        
        const max = j + (j - i) - 1 > phrases.length - 1
          ? phrases.length - j - 1
          : j - i - 1;
        
        for (let k = 1; k <= max; k++) {
          const firstPhraseExtended = phrases[i + k];
          const secondPhraseExtended = phrases[j + k];
          
          if (!firstPhraseExtended || !secondPhraseExtended) break;
          
          const firstLineExtended = normalizePhraseText(firstPhraseExtended);
          const secondLineExtended = normalizePhraseText(secondPhraseExtended);
          
          if (firstLineExtended === secondLineExtended) {
            tempMedleyEnd = i + k;
          } else {
            break;
          }
        }
        
        candidates.push({
          start: tempMedleyStart,
          end: tempMedleyEnd,
        });
      }
    }
  }

  return candidates;
}

/**
 * Finds the longest medley candidate (backwards to take first longest, not last longest)
 */
function findLongestCandidate(candidates: { start: number; end: number }[]) {
  if (candidates.length === 0) return null;

  let longestIndex = 0;
  for (let l = candidates.length - 1; l >= 0; l--) {
    const candidate = candidates[l];
    const longestCandidate = candidates[longestIndex];
    
    if (!candidate || !longestCandidate) continue;
    
    const candidateLength = candidate.end - candidate.start;
    const longestLength = longestCandidate.end - longestCandidate.start;
    
    if (candidateLength >= longestLength) {
      longestIndex = l;
    }
  }

  return candidates[longestIndex] ?? null;
}

/**
 * Extends the medley end beat to meet the minimum duration requirement
 */
function extendToMinimumDuration(
  song: LocalSong,
  phrases: Phrase[],
  medleyStartBeat: number,
  medleyEndBeat: number,
) {
  // Calculate approximate end beat needed for minimum duration
  const bpm = song.bpm * 4; // Convert to actual BPM
  const medleyMinBeats = (MEDLEY_MIN_DURATION_MS * bpm) / (1000 * 60);
  const approximateEndBeat = medleyStartBeat + medleyMinBeats - 1;

  // Find the line that contains approximateEndBeat, set medleyEndBeat to last beat of this line
  for (const phrase of phrases) {
    for (const note of phrase.notes) {
      if (note.startBeat > approximateEndBeat) {
        // Found the line, use the last note of this line
        const phraseLastNote = phrase.notes[phrase.notes.length - 1];
        if (phraseLastNote) {
          return phraseLastNote.startBeat + phraseLastNote.length;
        }
        break;
      }
    }
  }

  return medleyEndBeat;
}

/**
 * Normalizes phrase text by joining all note texts, converting to lowercase,
 * and removing punctuation (commas, periods, exclamation marks, question marks, tildes, spaces)
 */
function normalizePhraseText(phrase: Phrase) {
  if (!phrase.notes?.length) {
    return "";
  }
  
  return phrase.notes
    .map(note => note.text)
    .join("")
    .toLowerCase()
    .replace(/[,.!?~ ]/g, "");
}

function getAllPhrases(song: LocalSong) {
  if (!song.voices?.length) return [];

  const phrases = song.voices
    .flatMap(voice => voice.phrases ?? [])
    .filter(phrase => phrase.notes?.length > 0);

  // Sort by start beat
  phrases.sort((a, b) => {
    const aStart = a.notes[0]?.startBeat ?? 0;
    const bStart = b.notes[0]?.startBeat ?? 0;
    return aStart - bStart;
  });

  return phrases;
}
