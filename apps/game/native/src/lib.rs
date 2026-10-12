//! Native half of the desktop app, loaded by Electron's main process as a Node-API addon.
//! Audio capture and pitch detection, UltraStar parsing and USDB access live here;
//! `napi_api` is the JavaScript-facing surface. Serving files to the renderer is the main
//! process's job (`electron/protocols/`).

// Test builds don't register the napi exports, so everything reachable only through them
// looks unused there.
#![cfg_attr(test, allow(dead_code))]

mod audio;
mod commands;
mod error;
mod logging;
mod napi_api;
mod path_allowlist;
mod state;
mod ultrastar;
mod usdb;

#[cfg(any(test, feature = "typegen"))]
mod typescript;
