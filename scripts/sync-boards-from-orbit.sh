#!/usr/bin/env bash
# sync-boards-from-orbit.sh — OrbitPrompt boards → cloud-appstore 도구 동기화
# 증빙: 크로스레포 인터페이스 스크립트 (헌법 제2조 §2)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BOARDS=("math-tutor" "music-curation" "memorial-tribute" "luxury-editorial")
ORBIT_REPO="dtslib1979/OrbitPrompt"

echo "▶ OrbitPrompt boards → cloud-appstore 동기화 시작"

for board in "${BOARDS[@]}"; do
  echo "  ↓ $board"
  mkdir -p "$REPO_ROOT/$board"

  # gh api로 HTML 다운로드
  gh api "repos/$ORBIT_REPO/contents/boards/${board}.html" -q '.content' | base64 -d \
    | sed '/<link rel="manifest" href="..\/manifest.webmanifest">/d' \
    | sed '/initStudioConnection/,/^$/d' \
    | sed '/branchScript/d' \
    | sed 's|<script src="../../scripts/asset-loader.js"></script>||' \
    | sed 's|</body>|<script src="../shared/js/nav.js"></script>\n</body>|' \
    > "$REPO_ROOT/$board/index.html"
done

echo "▶ Guard 검증"
python3 "$REPO_ROOT/scripts/cloudappstore_guard.py"

echo "✓ 동기화 완료 (${#BOARDS[@]}개 보드)"
