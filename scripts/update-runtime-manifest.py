#!/usr/bin/env python3
"""Record both built runtimes and the exact core/bridge source content."""
import hashlib
import json
from pathlib import Path
import subprocess


def main():
    root = Path(__file__).resolve().parent.parent
    manifest_path = root / "runtime-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    public = root / "web/public"
    for asset in (public / "runtime/worker").glob("dingooemu_libretro.*"):
        manifest["runtime_files"].setdefault(asset.relative_to(public).as_posix(), {})
    for asset in (public / "runtime/frontend").glob("*"):
        manifest["runtime_files"].setdefault(asset.relative_to(public).as_posix(), {})
    for relative in manifest["runtime_files"]:
        data = (public / relative).read_bytes()
        manifest["runtime_files"][relative] = {
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()
        }

    sources = [root / "core/Cargo.toml", root / "core/Cargo.lock",
               root / "core/rust-toolchain.toml", root / "retroarch-src/Makefile.emscripten"]
    sources.extend((root / "core/crates").glob("*/Cargo.toml"))
    sources.extend((root / "core/crates").glob("*/src/**/*.rs"))
    sources.extend(root / "scripts" / name for name in (
        "build-runtime.sh", "build-audioworklet.sh", "build-worker.sh", "toolchain.sh",
        "library_dingoo_wasm_jit.js", "library_dingoo_worker.js", "pack-frontend.py"))
    sources.extend(root / name for name in ("retroarch-src/frontend/drivers/platform_emscripten.c", "retroarch-src/frontend/drivers/platform_emscripten.h", "retroarch-src/emscripten/library_platform_emscripten.js", "retroarch-src/audio/drivers/audioworklet.c", "retroarch-src/runloop.c", "retroarch-src/command.c", "retroarch-src/menu/cbs/menu_cbs_ok.c", "retroarch-src/menu/cbs/menu_cbs_sublabel.c", "retroarch-src/menu/menu_displaylist.c"))
    digest = hashlib.sha256()
    sources.append(root / "retroarch-src/gfx/video_driver.c")
    sources.append(root / "retroarch-src/input/input_driver.c")
    for source in sorted(sources):
        digest.update(source.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        digest.update(source.read_bytes())
        digest.update(b"\0")
    manifest["runtime_build"] = {
        "baseline_git_commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(),
        "core_and_bridge_source_sha256": digest.hexdigest(),
        "features": ["wasm-jit"],
        "remote_play": {
            "host_runtime": "Worker + AudioWorklet",
            "video": "Capture the actual Worker-rendered HTML canvas; browser WebRTC encoding",
            "audio": "Optional MediaStream branch from the existing AudioWorklet node; independent local monitor mute",
            "pairing": "Versioned manual offer/answer or local Python server with one-time code and remembered approved devices; fresh LAN ICE with optional same-server UDP STUN address discovery; no TURN",
            "frontend": "Approved phone can bootstrap windowed host RetroArch; native or web controller; runtime changes replace media on the same connection; authorized pause/resume closes game menu; watchdog releases input",
            "input": "Reliable control channel; unordered input snapshots without retransmission; 500 ms release watchdog",
            "validation": "See docs/remote-play.md; real-game two-context WebRTC and 5-minute stream stability"
        },
        "core_worker": {
            "enabled_by_default_when_supported": True,
            "requires": ["AudioWorklet", "SharedArrayBuffer isolation", "Worker WebGL / OffscreenCanvas"],
            "fallback": "Existing main-thread runtime on missing features or startup failure",
            "audio_buffer_default_ms": 64
        },
        "audio_worker_wait": {
            "budget_ms": 24,
            "slice_ms": 3,
            "early_notifications": "Do not exhaust the elapsed-time budget",
            "validation": "See docs/wasm-audio-wait.md; shared-memory JIT-on A-H ABBA and 5-minute H stability run"
        },
        "audio_refresh_wait": {
            "reserve_core_frames": 2,
            "maximum_ms": 100,
            "active_output": "Limit Worker refresh wait to queued audio minus two nominal core frames",
            "inactive_output": "Retain existing 100 ms refresh wait for paused, suspended, nonblocking or unavailable output",
            "validation": "See docs/wasm-refresh-audio-budget.md; shared-memory JIT-on A-H ABBA and 5-minute D/H stability runs"
        },
        "experimental_wasm_jit": {
            "abi": 4, "enabled_by_default": True,
            "live_switch": "Page selector; preserves guest state; runs on the owning core thread",
            "scope": "A320 integer/MUL, MULT/MULTU, MADD/MADDU, MFHI/MFLO, MOVZ/MOVN and bounded RAM/framebuffer prefixes; terminal BEQ/BNE delay pairs and bounded single-store self-loops without HI/LO writes",
            "validation": "See docs/wasm-jit-generated-guards.md for current shared/JIT-on full-code guards in generated RAM blocks, A-H complete-state/core screen, 32 browser ABBA samples and 5-minute H stability; docs/wasm-jit-fast-fallback.md for retained fallback optimization; docs/wasm-jit-hilo.md for HI/LO semantics and JIT-off tradeoff; docs/wasm-jit-ui.md for live-switch checks; docs/wasm-jit-framebuffer-install.md and docs/wasm-jit-framebuffer.md for prior adoption and measurements"
        }
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
