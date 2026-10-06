#!/bin/bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$project_root/web/dist/index.html" ]]; then
  bash "$project_root/scripts/build-web.sh"
fi
exec "${PYTHON:-python3}" "$project_root/scripts/server.py" "${1:-5182}" "$project_root/web/dist"
