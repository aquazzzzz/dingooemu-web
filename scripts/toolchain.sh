#!/bin/bash
# Source this file from a runtime build script. SDKs are installed separately.
if [[ -n "${DINGOO_TOOLCHAIN_ROOT:-}" ]]; then
  export CARGO_HOME="$DINGOO_TOOLCHAIN_ROOT/cargo"
  export RUSTUP_HOME="$DINGOO_TOOLCHAIN_ROOT/rustup"
  export PATH="$CARGO_HOME/bin:$PATH"
  export EMSDK="${EMSDK:-$DINGOO_TOOLCHAIN_ROOT/emsdk}"
fi

if [[ -n "${EMSDK:-}" ]]; then
  if [[ ! -f "$EMSDK/emsdk_env.sh" ]]; then
    echo "Cannot find $EMSDK/emsdk_env.sh; see README.md for SDK setup." >&2
    exit 1
  fi
  export EMSDK_QUIET=1
  source "$EMSDK/emsdk_env.sh"
fi

for runtime_tool in cargo rustup emcc emmake; do
  if ! command -v "$runtime_tool" >/dev/null 2>&1; then
    echo "Missing $runtime_tool; see README.md for Rust and Emscripten setup." >&2
    exit 1
  fi
done
