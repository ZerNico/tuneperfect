//! USDB integration — browse and play songs from usdb.animux.de.
//!
//! USDB has no public API. We figured out the endpoints, HTML scraping, and
//! the #VIDEO meta tag format by reading through
//! [USDB Syncer](https://github.com/bohning/usdb_syncer) by bohning.
//! Big thanks to them for building and maintaining that project.
//!
//! YouTube ID regex from <https://regexr.com/531i0>.

pub mod client;
pub mod commands;
pub mod models;
pub mod parser;
