#!/bin/bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
source "$project_root/scripts/toolchain.sh"
export RUSTFLAGS="-C panic=abort"
export CARGO_TARGET_DIR="$project_root/core/target"
cd "$project_root/core"
cargo +nightly-2026-10-04 build --locked -Z build-std=std,panic_abort \
  --release --target wasm32-unknown-emscripten -p dingooemu-libretro
cp "$CARGO_TARGET_DIR/wasm32-unknown-emscripten/release/libdingooemu.a" \
  "$project_root/retroarch-src/libretro_emscripten.a"
cd "$project_root/retroarch-src"
emmake make -f Makefile.emscripten LIBRETRO=dingooemu \
  HAVE_THREADS=0 HAVE_AUDIOWORKLET=0 HAVE_RWEBAUDIO=1 \
  STACK_SIZE=16777216 ASSERTIONS=1 -j 4
cp dingooemu_libretro.js dingooemu_libretro.wasm "$project_root/web/public/runtime/"
cp "$project_root/core/crates/dingooemu-libretro/dingooemu_libretro.info" \
  "$project_root/web/public/runtime/"
bash "$project_root/scripts/build-audioworklet.sh"
