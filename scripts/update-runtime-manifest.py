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
    sources.extend(root / name for name in ("retroarch-src/frontend/drivers/platform_emscripten.c", "retroarch-src/frontend/drivers/platform_emscripten.h", "retroarch-src/emscripten/library_platform_emscripten.js", "retroarch-src/audio/audio_driver.c", "retroarch-src/audio/drivers/audioworklet.c", "retroarch-src/runloop.c", "retroarch-src/command.c", "retroarch-src/menu/cbs/menu_cbs_ok.c", "retroarch-src/menu/cbs/menu_cbs_sublabel.c", "retroarch-src/menu/menu_displaylist.c"))
    sources.extend(root / name for name in ("web/src/emulator/client.ts", "web/src/emulator/readback-prewarm.ts"))
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
        "readback_prewarm": {
            "worker_only": True,
            "wait_budget_after_restore_rpc_ms": 50,
            "failure": "Cancel the new generation before resume; restore previous guest state and files on transaction failure; stay paused if rollback fails",
            "audio": "Consume the existing once-only topup before core work on ready blocking Worker AudioWorklet; other paths retain first-flush fallback",
            "validation": "docs/wasm-j-topup-once.md, docs/wasm-j-formal-prewarm.md, docs/wasm-j-install.md"
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
            "active_output": "A330 Worker AW64 bypasses positive refresh wait; other paths retain queued audio minus two nominal frames",
            "inactive_output": "Retain existing 100 ms refresh wait for paused, suspended, nonblocking or unavailable output",
            "validation": "See docs/wasm-refresh-audio-budget.md; shared-memory JIT-on A-H ABBA and 5-minute D/H stability runs"
        },
        "a330_wasm_jit": {
            "enabled_by_default": True,
            "scope": "ARM integer, shifts/NZCV, multiply, long multiply, CLZ, guarded single transfers and B/BL",
            "fallback": "Interpreter for Thumb, unsupported instructions, device access, program-image stores and compilation failure",
            "limits": {"entries": 2048, "requests": 320, "generated_bytes": 1048576},
            "validation": "docs/wasm-a330-jit.md; five complete-state comparisons, 20 browser ABBA samples, 300-second stability",
            "game_specific_folds": {
                "enabled": False,
                "reason": "Removed at user request on 2026-10-24; generic ARM JIT remains",
                "validation": "docs/wasm-a330-time-conversion.md"
            },
            "generic_short_code_guard": {
                "scalar_lengths_bytes": [8, 12, 16, 20, 24, 28],
                "protection": "Every byte compared at existing admission/execution guards; longer lengths use complete bounded-group comparison with a full remainder",
                "validation": "docs/wasm-a330-guard-width-install.md, docs/wasm-a330-guard-20-28-acceptance.md, docs/wasm-a330-guard-20-28-install.md"
            },
            "generic_long_code_guard": {
                "enabled": True, "minimum_bytes": 32, "group_bytes": 32,
                "protection": "Complete byte comparison in bounded groups and full remainder on every admission/execution; no generation-only shortcut",
                "validation": "docs/wasm-a330-long-guard-acceptance.md, docs/wasm-a330-long-guard-install.md"
            },
            "bounded_extra_jit": {
                "enabled": True, "base_identities": 256, "extra_requests": 64,
                "minimum_extra_instructions": 8, "normal_quantum_only": True,
                "default_activation": "Natural from reset after the first256 identities; session320, A320 default256 unchanged",
                "protection": "Extra generated prefix resumes its original decoded suffix in the same call, preserving all original returns, input/quantum boundaries and full code checks",
                "validation": "docs/wasm-a330-long-guard-acceptance.md, docs/wasm-a330-long-guard-install.md"
            },
            "direct_cpu_arguments": {
                "enabled": True, "a330_parameters": 4, "a320_parameters": 2,
                "lifetime": "Current exclusive CPU borrow supplies register and CPSR addresses at every block call; no cached CPU pointers",
                "protection": "Complete byte validation, guarded memory access and all original execution boundaries retained",
                "validation": "docs/wasm-a330-jit-call-acceptance.md, docs/wasm-a330-jit-call-install.md"
            },
            "code_match_interface": {
                "enabled": True,
                "protection": "Original eight-region priority and complete-byte comparison at both JIT guards",
                "validation": "docs/wasm-a330-code-match-acceptance.md, docs/wasm-a330-code-match-install.md"
            },
            "fixed_width_memory": {
                "widths_bytes": [1, 2, 4],
                "semantics": "Original mapping priority, overlap, unaligned access, range/overflow and failure behavior",
                "validation": "docs/wasm-a330-guard-width-install.md"
            },
            "slice_context": {
                "enabled": True,
                "scope": "Owning-thread RuntimeBus segment; 8 invariant fields reused; current CPU pointers passed directly each block; SVC rebind",
                "validation": "docs/wasm-a330-start-acceptance.md, docs/wasm-a330-combo-install.md"
            },
            "elapsed_audio": {
                "scope": "A330 ready Worker AudioWorklet64 only",
                "sample_rate": 22050, "maximum_credit_ms": 64, "maximum_batch_frames": 1411,
                "long_gap_rebase_ms": 250, "initial_credit": 0,
                "debit": "Only actual queued PCM; reset on content/restore/reset/output discontinuity; guest clock unchanged",
                "validation": "docs/wasm-a330-start-acceptance.md, docs/wasm-a330-combo-install.md"
            },
            "interpreter_condition_flags_fast_path": {
                "enabled": True,
                "scope": "Generic ARM AL/NV condition bypass and value-only S=0 non-test ALU operands/results",
                "semantics": "Preserve C inputs, S=1/test flags, shift boundaries, PC access, guest clock and input/quantum boundaries",
                "validation": "docs/wasm-a330-alu-fast-acceptance.md, docs/wasm-a330-alu-fast-install.md"
            },
            "decoded_cache_entry_range_hoist": {
                "enabled": True,
                "protection": "Immutable code range metadata reused per existing cache entry; complete byte guard and original execution boundaries retained",
                "validation": "docs/wasm-a330-region-stack-retest.md, docs/wasm-a330-region-stack-install.md"
            },
            "static_operand_predecode": {
                "enabled": True, "record_bytes": 12, "extra_capacity_bytes": 1048576,
                "protection": "Static ARM operand fields only; runtime register/flags/PC/shift semantics and complete invalidation retained",
                "validation": "docs/wasm-a330-region-stack-retest.md, docs/wasm-a330-region-stack-install.md"
            },
            "fixed_width_region_dispatch": {
                "enabled": True, "widths_bytes": [1, 2, 4],
                "protection": "Coarse address/profile dispatch with full-width bounds, MMIO priority and original linear fallback",
                "validation": "docs/wasm-a330-region-stack-retest.md, docs/wasm-a330-region-stack-install.md"
            },
            "continuous_execution_enabled": False
        },
        "experimental_wasm_jit": {
            "abi": 4, "enabled_by_default": True,
            "live_switch": "Page selector; preserves guest state; runs on the owning core thread",
            "scope": "A320 integer/MUL, MULT/MULTU, MADD/MADDU, MFHI/MFLO, MOVZ/MOVN and bounded RAM/framebuffer prefixes; terminal BEQ/BNE delay pairs and bounded single-store self-loops without HI/LO writes",
            "validation": "See docs/wasm-jit-generated-guards.md for current shared/JIT-on full-code guards in generated RAM blocks, A-H complete-state/core screen, 32 browser ABBA samples and 5-minute H stability; docs/wasm-jit-fast-fallback.md for retained fallback optimization; docs/wasm-jit-hilo.md for HI/LO semantics and JIT-off tradeoff; docs/wasm-jit-ui.md for live-switch checks; docs/wasm-jit-framebuffer-install.md and docs/wasm-jit-framebuffer.md for prior adoption and measurements"
        }
    }
    content = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    manifest_path.write_text(content)
    (public / "runtime-manifest.json").write_text(content)


if __name__ == "__main__":
    main()
