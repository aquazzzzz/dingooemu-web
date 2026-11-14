//! Host-only elapsed PCM budget for the validated A330 Worker/AW64 path.
use dingooemu_core::Emulator;
#[path = "audio_elapsed.rs"]
mod elapsed;
static mut BUDGET: elapsed::Budget = elapsed::Budget::new();
static mut ORIGIN: Option<std::time::Instant> = None;
pub fn reset() {
    unsafe {
        BUDGET = elapsed::Budget::new();
        ORIGIN = None;
    }
}
pub fn take_samples(emulator: &mut Emulator) -> Vec<i16> {
    #[cfg(target_os = "emscripten")]
    if emulator.is_a330() {
        extern "C" {
            fn dingoo_audio_output_queue_ms() -> f64;
        }
        let queue = unsafe { dingoo_audio_output_queue_ms() };
        if queue.is_finite() && queue >= 0.0 {
            return unsafe {
                let now = ORIGIN
                    .get_or_insert_with(std::time::Instant::now)
                    .elapsed()
                    .as_nanos() as u64;
                let wanted = BUDGET.request(now);
                let samples = emulator.take_queued_a330_audio_samples(wanted).unwrap();
                BUDGET.debit(samples.len() / 2);
                samples
            };
        }
    }
    reset();
    emulator.take_audio_samples()
}
