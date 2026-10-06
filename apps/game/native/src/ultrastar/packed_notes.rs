//! A song's voices packed into bytes, for the scanned library.
//!
//! As JSON, every note of a big library is around a gigabyte (and millions of objects the
//! renderer's garbage collector keeps walking). Packed, a note is about ten bytes, crosses IPC
//! as one buffer and is unpacked per song when it's played or previewed
//! (`src/lib/ultrastar/packed-notes.ts`, which has to match this format).
//!
//! Integers are LEB128 varints; signed ones are zigzag-encoded first.
//!
//! ```text
//! voices:  count, voice*
//! voice:   phrase count, phrase*
//! phrase:  disappearBeat (signed), note count, note*
//! note:    type (byte), startBeat - previous note's startBeat in the voice (signed),
//!          length (signed), txtPitch (signed), text byte length, text (UTF-8)
//! ```
//!
//! `midiNote` isn't stored: it's always `txtPitch + 60`.

use super::song::{NoteType, Voice};

pub fn pack_voices(voices: &[Voice]) -> Vec<u8> {
    let mut out = Vec::new();
    write_unsigned(&mut out, voices.len() as u64);
    for voice in voices {
        write_unsigned(&mut out, voice.phrases.len() as u64);
        let mut previous_start = 0i64;
        for phrase in &voice.phrases {
            write_signed(&mut out, phrase.disappear_beat.into());
            write_unsigned(&mut out, phrase.notes.len() as u64);
            for note in &phrase.notes {
                out.push(note_type_code(&note.note_type));
                write_signed(&mut out, i64::from(note.start_beat) - previous_start);
                previous_start = note.start_beat.into();
                write_signed(&mut out, note.length.into());
                write_signed(&mut out, note.txt_pitch.into());
                write_unsigned(&mut out, note.text.len() as u64);
                out.extend_from_slice(note.text.as_bytes());
            }
        }
    }
    out
}

fn note_type_code(note_type: &NoteType) -> u8 {
    match note_type {
        NoteType::Normal => 0,
        NoteType::Golden => 1,
        NoteType::Freestyle => 2,
        NoteType::Rap => 3,
        NoteType::RapGolden => 4,
    }
}

fn write_unsigned(out: &mut Vec<u8>, mut value: u64) {
    while value >= 0x80 {
        out.push((value as u8 & 0x7f) | 0x80);
        value >>= 7;
    }
    out.push(value as u8);
}

fn write_signed(out: &mut Vec<u8>, value: i64) {
    write_unsigned(out, ((value << 1) ^ (value >> 63)) as u64);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ultrastar::song::{Note, Phrase};

    fn note(note_type: NoteType, start_beat: i32, length: i32, txt_pitch: i32, text: &str) -> Note {
        Note {
            note_type,
            start_beat,
            length,
            text: text.to_string(),
            txt_pitch,
            midi_note: txt_pitch.wrapping_add(60),
        }
    }

    /// The same bytes are unpacked in `src/lib/ultrastar/packed-notes.test.ts`: change both together.
    #[test]
    fn packs_the_shared_fixture() {
        let voices = vec![
            Voice {
                phrases: vec![
                    Phrase {
                        disappear_beat: 10,
                        notes: vec![
                            note(NoteType::Normal, 0, 4, 5, "Hel"),
                            note(NoteType::Golden, 4, 2, -3, "lo "),
                        ],
                    },
                    Phrase {
                        disappear_beat: 300,
                        notes: vec![note(NoteType::Freestyle, 200, 100, 0, "wörld")],
                    },
                ],
            },
            Voice {
                phrases: vec![Phrase {
                    disappear_beat: -1,
                    notes: vec![
                        note(NoteType::Rap, -2, 1, 12, ""),
                        note(NoteType::RapGolden, 1, 1, 12, "~"),
                    ],
                }],
            },
        ];

        assert_eq!(
            pack_voices(&voices),
            [
                2, // voices
                2, // phrases
                20, 2, // disappear 10, 2 notes
                0, 0, 8, 10, 3, b'H', b'e', b'l', // Normal +0 len 4 pitch 5 "Hel"
                1, 8, 4, 5, 3, b'l', b'o', b' ', // Golden +4 len 2 pitch -3 "lo "
                216, 4, 1, // disappear 300, 1 note
                2, 136, 3, 200, 1, 0, 6, b'w', 0xc3, 0xb6, b'r', b'l',
                b'd', // Freestyle +196 len 100 pitch 0 "wörld"
                1,    // phrases
                1, 2, // disappear -1, 2 notes
                3, 3, 2, 24, 0, // Rap -2 len 1 pitch 12 ""
                4, 6, 2, 24, 1, b'~', // RapGolden +3 len 1 pitch 12 "~"
            ]
        );
    }

    #[test]
    fn deltas_cover_the_whole_beat_range() {
        let voices = vec![Voice {
            phrases: vec![Phrase {
                disappear_beat: i32::MAX,
                notes: vec![
                    note(NoteType::Normal, i32::MIN, i32::MAX, i32::MIN, ""),
                    note(NoteType::Normal, i32::MAX, i32::MIN, i32::MAX, ""),
                ],
            }],
        }];
        // i32::MAX - i32::MIN doesn't fit an i32; the delta is taken as an i64.
        assert!(!pack_voices(&voices).is_empty());
    }
}
