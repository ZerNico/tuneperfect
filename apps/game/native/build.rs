fn main() {
    napi_build::setup();
    // Link the MSVC runtime into the addon (the UCRT ships with Windows). Otherwise it needs
    // VCRUNTIME140.dll, which a fresh Windows doesn't have: the addon fails to load and the
    // game never starts. The Tauri build did the same, so its players never needed the
    // Visual C++ Redistributable. No effect on other platforms.
    static_vcruntime::metabuild();
}
