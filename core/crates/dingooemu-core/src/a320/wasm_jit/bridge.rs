//! Browser imports supplied by scripts/library_dingoo_wasm_jit.js.
//! Function-table entries are owned by one runtime session, never by save states.

#[cfg(target_os = "emscripten")]
extern "C" {
    fn dingoo_wasm_jit_create() -> u32;
    fn dingoo_wasm_jit_shared() -> u32;
    fn dingoo_wasm_jit_submit(session: u32, bytes: *const u8, len: u32) -> u32;
    fn dingoo_wasm_jit_poll(session: u32, request: u32) -> i32;
    fn dingoo_wasm_jit_forget(session: u32, request: u32);
    fn dingoo_wasm_jit_clear(session: u32);
    fn dingoo_wasm_jit_release(session: u32);
}

pub(super) fn create() -> u32 {
    #[cfg(target_os = "emscripten")]
    unsafe {
        return dingoo_wasm_jit_create();
    }
    #[cfg(not(target_os = "emscripten"))]
    0
}

pub(super) fn shared() -> bool {
    #[cfg(target_os = "emscripten")]
    unsafe {
        return dingoo_wasm_jit_shared() != 0;
    }
    #[cfg(not(target_os = "emscripten"))]
    false
}

pub(super) fn submit(session: u32, bytes: &[u8]) -> u32 {
    #[cfg(target_os = "emscripten")]
    unsafe {
        return dingoo_wasm_jit_submit(session, bytes.as_ptr(), bytes.len() as u32);
    }
    #[cfg(not(target_os = "emscripten"))]
    {
        let _ = (session, bytes);
        0
    }
}

/// Zero means pending, -1 failed; positive values encode table index + 1.
pub(super) fn poll(session: u32, request: u32) -> i32 {
    #[cfg(target_os = "emscripten")]
    unsafe {
        return dingoo_wasm_jit_poll(session, request);
    }
    #[cfg(not(target_os = "emscripten"))]
    {
        let _ = (session, request);
        -1
    }
}

pub(super) fn forget(session: u32, request: u32) {
    #[cfg(target_os = "emscripten")]
    unsafe {
        dingoo_wasm_jit_forget(session, request);
    }
    #[cfg(not(target_os = "emscripten"))]
    let _ = (session, request);
}

pub(super) fn clear(session: u32) {
    #[cfg(target_os = "emscripten")]
    unsafe {
        dingoo_wasm_jit_clear(session);
    }
    #[cfg(not(target_os = "emscripten"))]
    let _ = session;
}

pub(super) fn release(session: u32) {
    #[cfg(target_os = "emscripten")]
    unsafe {
        dingoo_wasm_jit_release(session);
    }
    #[cfg(not(target_os = "emscripten"))]
    let _ = session;
}
