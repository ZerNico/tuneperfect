//! Generates `src/lib/native/types.gen.ts`, the renderer's view of the values this addon
//! exchanges with it. `bun run dev` regenerates it after every native rebuild (through the
//! `typegen` feature's `exportTypescriptTypes` export); `bun run native:types` does it
//! without the dev loop. CI fails if the committed file is out of date.

use std::path::Path;

use specta::Types;
use specta_typescript::Typescript;

use crate::{
    audio::MicrophoneOptions,
    commands::{microphones::Microphone, songs::ParseEvent, songs::SongGroup},
    error::AppError,
    usdb::{
        commands::UsdbSyncProgressEvent,
        models::{UsdbSearchEntry, UsdbSong, UsdbSongPreview},
    },
};

/// Writes the TypeScript types to `path`, leaving the file untouched if nothing changed.
pub fn export(path: &Path) -> Result<(), String> {
    let types = Types::default()
        .register::<AppError>()
        .register::<Microphone>()
        .register::<MicrophoneOptions>()
        .register::<SongGroup>()
        .register::<ParseEvent>()
        .register::<UsdbSearchEntry>()
        .register::<UsdbSong>()
        .register::<UsdbSongPreview>()
        .register::<UsdbSyncProgressEvent>();

    let contents = Typescript::default()
        .header("// Generated from the Rust types in `native/src` by `bun run native:types`. Don't edit.")
        .export(&types, specta_serde::Format)
        .map_err(|e| e.to_string())?;

    if std::fs::read_to_string(path).is_ok_and(|current| current == contents) {
        return Ok(());
    }
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[test]
fn export_typescript_types() {
    let output = Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/lib/native/types.gen.ts");
    export(&output).expect("failed to export TypeScript types");
}
