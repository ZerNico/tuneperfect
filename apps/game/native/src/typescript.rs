//! Generates `src/lib/native/types.gen.ts`, the renderer's view of the values this addon
//! exchanges with it. Regenerate with `bun run native:types`; CI fails if the committed
//! file is out of date.

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

const OUTPUT: &str = "../src/lib/native/types.gen.ts";

#[test]
fn export_typescript_types() {
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

    Typescript::default()
        .header("// Generated from the Rust types in `native/src` by `bun run native:types`. Don't edit.")
        .export_to(OUTPUT, &types, specta_serde::Format)
        .expect("failed to export TypeScript types");
}
