//! Local-only guest input probe; game files are never embedded or distributed.
use dingooemu_core::{
    common::input::{BUTTON_A, BUTTON_DOWN, BUTTON_UP},
    Emulator,
};
fn main() {
    env_logger::Builder::new()
        .filter_module(
            "dingooemu_core::a320::runtime::sdk_hle::input",
            log::LevelFilter::Trace,
        )
        .filter_module(
            "dingooemu_core::a320::runtime::sdk_hle::gui",
            log::LevelFilter::Trace,
        )
        .init();
    let args: Vec<_> = std::env::args().collect();
    let mut emulator = Emulator::from_path(&args[1]).unwrap();
    emulator.set_jit_enabled(false);
    emulator.start();
    let output = std::path::Path::new(&args[2]);
    std::fs::create_dir_all(output).unwrap();
    for (label, buttons, frames) in [
        ("menu", 0, 120),
        ("down-tap", BUTTON_DOWN, 1),
        ("after-tap", 0, 30),
        ("down-held", BUTTON_DOWN, 6),
        ("after-held", 0, 30),
        ("up-held", BUTTON_UP, 6),
        ("after-up", 0, 30),
        ("a-held", BUTTON_A, 6),
        ("after-a", 0, 60),
    ] {
        for _ in 0..frames {
            emulator.set_buttons(buttons);
            emulator.tick().unwrap();
            emulator.take_audio_samples();
        }
        println!(
            "{label} frame={} buttons={buttons:#010x} crc={}",
            emulator.frame_count(),
            emulator.framebuffer_crc32()
        );
        #[cfg(feature = "screenshots")]
        emulator
            .save_screenshot(&output.join(format!("{label}.png")))
            .unwrap();
    }
    for call in emulator.unknown_hle_calls() {
        println!("unknown_hle={call:?}");
    }
}
