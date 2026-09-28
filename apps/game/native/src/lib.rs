//! Native half of the desktop app, loaded by Electron's main process as a Node-API addon.
//! Audio capture and pitch detection, UltraStar parsing, USDB access and the loopback
//! media server live here; `napi_api` is the JavaScript-facing surface.

// Test builds don't register the napi exports, so everything reachable only through them
// looks unused there.
#![cfg_attr(test, allow(dead_code))]

mod audio;
mod commands;
mod error;
mod local_server;
mod logging;
mod napi_api;
mod path_allowlist;
mod state;
mod ultrastar;
mod usdb;

#[cfg(any(test, feature = "typegen"))]
mod typescript;
