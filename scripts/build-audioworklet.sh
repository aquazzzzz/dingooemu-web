#!/bin/bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
source "$project_root/scripts/toolchain.sh"
export RUSTFLAGS="-C panic=abort -C target-feature=+atomics,+bulk-memory,+mutable-globals -C link-arg=-pthread"
export CFLAGS_wasm32_unknown_emscripten="-pthread"
export CARGO_TARGET_DIR="$project_root/core/target-audioworklet"
cd "$project_root/core"
cargo +nightly-2026-10-04 build --locked -Z build-std=std,panic_abort \
  --release --target wasm32-unknown-emscripten -p dingooemu-libretro
runtime_dir="$project_root/web/public/runtime/audioworklet"
mkdir -p "$runtime_dir"
cd "$project_root/retroarch-src"
emmake make -f Makefile.emscripten LIBRETRO=dingooemu \
  TARGET="$runtime_dir/dingooemu_libretro.js" OBJDIR=obj-emscripten-audioworklet \
  libretro_new="$CARGO_TARGET_DIR/wasm32-unknown-emscripten/release/libdingooemu.a" \
  HAVE_THREADS=1 HAVE_AUDIOWORKLET=1 HAVE_RWEBAUDIO=0 PROXY_TO_PTHREAD=0 \
  PTHREAD_POOL_SIZE=0 STACK_SIZE=16777216 ASSERTIONS=1 -j 4
