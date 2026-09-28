//! Routes the `log` macros to the host process, which writes them to the app's log file
//! alongside its own messages. Until a sink is set (e.g. when the addon is used from plain
//! Node), records go to stderr.

use std::sync::OnceLock;

use log::{Level, LevelFilter, Log, Metadata, Record};
use serde::Serialize;

#[derive(Serialize)]
pub struct LogRecord {
    pub level: &'static str,
    pub target: String,
    pub message: String,
}

pub type LogSink = Box<dyn Fn(LogRecord) + Send + Sync>;

static SINK: OnceLock<LogSink> = OnceLock::new();

/// Dependencies whose warnings are noise here: lofty reports every tag it doesn't
/// understand in a song library, and the HTML parser behind the USDB scraper reports
/// malformed markup it copes with anyway.
const QUIET_TARGETS: &[&str] = &["lofty", "html5ever", "selectors"];

struct Logger;

impl Log for Logger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Info
            && !QUIET_TARGETS
                .iter()
                .any(|target| metadata.target().starts_with(target))
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }

        let record = LogRecord {
            level: match record.level() {
                Level::Error => "ERROR",
                Level::Warn => "WARN",
                Level::Info => "INFO",
                Level::Debug => "DEBUG",
                Level::Trace => "TRACE",
            },
            target: record.target().to_string(),
            message: record.args().to_string(),
        };

        match SINK.get() {
            Some(sink) => sink(record),
            None => eprintln!("[{}][{}] {}", record.level, record.target, record.message),
        }
    }

    fn flush(&self) {}
}

static LOGGER: Logger = Logger;

pub fn init() {
    if log::set_logger(&LOGGER).is_ok() {
        log::set_max_level(LevelFilter::Info);
    }
}

/// Only the first sink is kept; the addon is loaded once per process.
pub fn set_sink(sink: LogSink) {
    let _ = SINK.set(sink);
}
