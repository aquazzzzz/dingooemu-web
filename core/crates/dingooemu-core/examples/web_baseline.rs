//! Deterministic native interpreter reference for the original Web fixture.
use dingooemu_core::{common::input::BUTTON_A, Emulator};
fn main() {
    let path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "web/public/test-apps/smoke.app".into());
    let mut emulator = Emulator::from_path(path).unwrap();
    emulator.set_jit_enabled(false);
    emulator.start();
    for buttons in [0, BUTTON_A, 0] {
        emulator.set_buttons(buttons);
        emulator.tick().unwrap();
        emulator.take_audio_samples();
        println!(
            "frame={} guest_count={} buttons={} crc={} instructions={}",
            emulator.frame_count(),
            emulator.read_memory_u32(0x1000).unwrap(),
            emulator.read_memory_u32(0x1004).unwrap(),
            emulator.framebuffer_crc32(),
            emulator.instruction_count()
        );
        assert_eq!(emulator.read_memory_u32(0x1004).unwrap(), buttons);
        let expected = if buttons == 0 { [0x1f, 0] } else { [0, 0xf8] };
        assert!(emulator
            .framebuffer()
            .chunks_exact(2)
            .all(|pixel| pixel == expected));
    }
}
