//! Local guest comparison. No game package is embedded in the executable.
use dingooemu_core::{
    common::input::{BUTTON_A, BUTTON_B, BUTTON_DOWN, BUTTON_RIGHT, BUTTON_UP},
    Emulator,
};
use serde_json::{json, Value};
use std::{path::Path, time::Instant};

fn run(app: &Path, output: &Path, directional: bool) -> anyhow::Result<Value> {
    let mut emulator = Emulator::from_path(app)?;
    emulator.set_jit_enabled(false);
    emulator.start();
    let mut rows = Vec::new();
    let mut nonzero_audio = 0usize;
    for (label, mask, ticks) in [
        ("menu", 0, 120),
        ("confirm", BUTTON_A, 6),
        ("gameplay", 0, 60),
        ("up", if directional { BUTTON_UP } else { 0 }, 6),
        ("after-up", 0, 12),
        ("down", if directional { BUTTON_DOWN } else { 0 }, 6),
        ("after-down", 0, 12),
        ("right", if directional { BUTTON_RIGHT } else { 0 }, 6),
        ("after-right", 0, 12),
        ("b", if directional { BUTTON_B } else { 0 }, 6),
        ("after-b", 0, 12),
    ] {
        let mut costs = Vec::new();
        for _ in 0..ticks {
            emulator.set_buttons(mask);
            let before = Instant::now();
            emulator.tick()?;
            costs.push(before.elapsed().as_secs_f64() * 1000.0);
            nonzero_audio += emulator
                .take_audio_samples()
                .iter()
                .filter(|&&s| s != 0)
                .count();
        }
        costs.sort_by(f64::total_cmp);
        rows.push(json!({"label":label,"buttons":mask,"ticks":ticks,
            "frames":emulator.frame_count(),"crc":emulator.framebuffer_crc32(),
            "instructions":emulator.instruction_count(),"running":emulator.is_running(),
            "tickP50":costs[costs.len()/2],"tickP95":costs[costs.len()*95/100]}));
        #[cfg(feature = "screenshots")]
        emulator.save_screenshot(&output.join(format!(
            "{}-{label}.png",
            if directional { "input" } else { "control" }
        )))?;
    }
    let unknown: Vec<_> = emulator
        .unknown_hle_calls()
        .map(|call| format!("{call:?}"))
        .collect();
    Ok(json!({"rows":rows,"nonzeroAudioSamples":nonzero_audio,"unknownHle":unknown}))
}

fn main() -> anyhow::Result<()> {
    let args: Vec<_> = std::env::args_os().collect();
    anyhow::ensure!(
        args.len() == 3,
        "Usage: compatibility_probe APP OUTPUT_DIRECTORY"
    );
    let app = Path::new(&args[1]);
    let output = Path::new(&args[2]);
    std::fs::create_dir_all(output)?;
    let report = json!({"app":app.file_name().unwrap_or_default().to_string_lossy(),"mode":"native cached interpreter, JIT disabled",
        "input":run(app,output,true)?,"control":run(app,output,false)?});
    std::fs::write(
        output.join("native.json"),
        serde_json::to_vec_pretty(&report)?,
    )?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}
