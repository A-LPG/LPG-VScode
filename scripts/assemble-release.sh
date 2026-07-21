#!/usr/bin/env bash
# Assemble gitignored templates/ and server/ for packaging or local use.
#
# Usage (from anywhere):
#   ./tool/LPG-VScode/scripts/assemble-release.sh \
#     --lpg-bin /path/to/lpg-v2.3.0 \
#     [--lsp-bin /path/to/LPG-language-server] \
#     [--platform mac|linux|win] \
#     [--templates-src /path/to/lpg-generator-templates-2.1.00]
#
# After assembly:
#   cd tool/LPG-VScode && yarn && npx vsce package
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Resolve LPG2 root: sibling checkout (…/LPG-VScode + …/LPG2) or monorepo (…/LPG2/tool/LPG-VScode).
if [[ -d "$EXT_ROOT/../LPG2/runtime/lpg-runtime" ]]; then
  LPG2_ROOT="$(cd "$EXT_ROOT/../LPG2" && pwd)"
elif [[ -d "$EXT_ROOT/../../runtime/lpg-runtime" ]]; then
  LPG2_ROOT="$(cd "$EXT_ROOT/../.." && pwd)"
else
  LPG2_ROOT="$(cd "$EXT_ROOT/../.." && pwd)"
fi

LPG_BIN=""
LSP_BIN=""
PLATFORM=""
TEMPLATES_SRC=""

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lpg-bin) LPG_BIN="$2"; shift 2 ;;
    --lsp-bin) LSP_BIN="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --templates-src) TEMPLATES_SRC="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

if [[ -z "$PLATFORM" ]]; then
  case "$(uname -s)" in
    Darwin) PLATFORM=mac ;;
    Linux) PLATFORM=linux ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT) PLATFORM=win ;;
    *) echo "Set --platform mac|linux|win" >&2; exit 1 ;;
  esac
fi

if [[ -z "$TEMPLATES_SRC" ]]; then
  TEMPLATES_SRC="$LPG2_ROOT/lpg-generator-templates-2.1.00"
fi
if [[ ! -d "$TEMPLATES_SRC/templates" || ! -d "$TEMPLATES_SRC/include" ]]; then
  echo "Templates source missing under $TEMPLATES_SRC" >&2
  exit 1
fi

if [[ -z "$LPG_BIN" ]]; then
  for candidate in \
    "$LPG2_ROOT/lpg2/build/lpg-v2.3.0" \
    "$LPG2_ROOT/lpg2/build-plan/lpg-v2.3.0" \
    "$LPG2_ROOT/lpg2/install/bin/lpg-v2.3.0"
  do
    if [[ -x "$candidate" ]]; then
      LPG_BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$LPG_BIN" || ! -x "$LPG_BIN" ]]; then
  echo "Provide --lpg-bin pointing to a built lpg-v2.* executable" >&2
  exit 1
fi

echo "Assembling into $EXT_ROOT"
echo "  templates from: $TEMPLATES_SRC"
echo "  lpg binary:     $LPG_BIN"
echo "  platform:       $PLATFORM"

rm -rf "$EXT_ROOT/templates/templates" "$EXT_ROOT/templates/include"
mkdir -p "$EXT_ROOT/templates"
cp -R "$TEMPLATES_SRC/templates" "$EXT_ROOT/templates/templates"
cp -R "$TEMPLATES_SRC/include" "$EXT_ROOT/templates/include"

SERVER_DIR="$EXT_ROOT/server/$PLATFORM"
mkdir -p "$SERVER_DIR"
# Drop prior generator binaries so packaging ships a single lpg-v* version.
rm -f "$SERVER_DIR"/lpg-v*
cp "$LPG_BIN" "$SERVER_DIR/"
chmod +x "$SERVER_DIR/$(basename "$LPG_BIN")" || true

if [[ -n "$LSP_BIN" ]]; then
  if [[ ! -f "$LSP_BIN" ]]; then
    echo "LSP binary not found: $LSP_BIN" >&2
    exit 1
  fi
  cp "$LSP_BIN" "$SERVER_DIR/"
  chmod +x "$SERVER_DIR/$(basename "$LSP_BIN")" || true
  echo "  lsp binary:     $LSP_BIN"
else
  echo "  lsp binary:     (skipped; pass --lsp-bin to include LPG-language-server*)"
fi

# Java testrig runtime jar (Test Grammar panel).
RUNTIME_SRC="$LPG2_ROOT/runtime/lpg-runtime"
LIB_DIR="$EXT_ROOT/server/lib"
mkdir -p "$LIB_DIR"
if [[ -d "$RUNTIME_SRC/src/lpg/runtime" ]]; then
  RT_CLASSES="$(mktemp -d)"
  # shellcheck disable=SC2046
  find "$RUNTIME_SRC/src" -name '*.java' > "$RT_CLASSES/sources.txt"
  javac -encoding UTF-8 -source 8 -target 8 -d "$RT_CLASSES" @"$RT_CLASSES/sources.txt" \
    >/dev/null 2>&1 || javac -encoding UTF-8 -d "$RT_CLASSES" @"$RT_CLASSES/sources.txt"
  (cd "$RUNTIME_SRC/src" && find . -name '*.properties' | while read -r f; do
    mkdir -p "$RT_CLASSES/$(dirname "$f")"
    cp "$f" "$RT_CLASSES/$f"
  done)
  jar cf "$LIB_DIR/lpg-runtime.jar" -C "$RT_CLASSES" .
  rm -rf "$RT_CLASSES"
  echo "  runtime jar:    $LIB_DIR/lpg-runtime.jar"
else
  echo "  runtime jar:    (skipped; missing $RUNTIME_SRC/src)"
fi

# Precompile LpgTestRig into misc/java-testrig/classes if runtime jar exists.
HARNESS_SRC="$EXT_ROOT/misc/java-testrig/LpgTestRig.java"
HARNESS_OUT="$EXT_ROOT/misc/java-testrig/classes"
if [[ -f "$LIB_DIR/lpg-runtime.jar" && -f "$HARNESS_SRC" ]]; then
  rm -rf "$HARNESS_OUT"
  mkdir -p "$HARNESS_OUT"
  javac -encoding UTF-8 -source 8 -target 8 -cp "$LIB_DIR/lpg-runtime.jar" \
    -d "$HARNESS_OUT" "$HARNESS_SRC"
  echo "  testrig:        $HARNESS_OUT"
fi

echo "Done."
echo "Next: cd $EXT_ROOT && yarn && npx vsce package"
