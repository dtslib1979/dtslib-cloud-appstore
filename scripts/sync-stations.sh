#!/usr/bin/env bash
# sync-stations.sh — apps.json → papyrus stations.json 동기화
# 증빙: 크로스레포 인터페이스 스크립트 (헌법 제2조 §2)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAPYRUS_REPO="dtslib1979/dtslib-papyrus"
STATIONS_PATH="maps/stations.json"

echo "▶ apps.json → Papyrus stations.json 동기화"

# apps.json에서 tool_count, categories 계산
TOOL_COUNT=$(python3 -c "import json; d=json.load(open('$REPO_ROOT/apps.json')); print(len(d['apps']))")
CATEGORIES=$(python3 -c "import json; d=json.load(open('$REPO_ROOT/apps.json')); print(json.dumps(sorted(set(a['category'] for a in d['apps']))))")

echo "  도구: $TOOL_COUNT개, 카테고리: $CATEGORIES"

# 현재 stations.json 가져오기
RESP=$(gh api "repos/$PAPYRUS_REPO/contents/$STATIONS_PATH")
SHA=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")
CURRENT=$(echo "$RESP" | python3 -c "import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)['content']).decode())")

# studio 항목만 갱신
UPDATED=$(echo "$CURRENT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
d['stations']['studio']['tool_count'] = $TOOL_COUNT
d['stations']['studio']['categories'] = $CATEGORIES
d['updated'] = '$(date +%Y-%m-%d)'
print(json.dumps(d, indent=2, ensure_ascii=False))
")

# base64 인코딩 후 PUT
CONTENT_B64=$(echo "$UPDATED" | base64 -w 0)
gh api -X PUT "repos/$PAPYRUS_REPO/contents/$STATIONS_PATH" \
  --input - <<EOF
{
  "message": "sync: stations.json studio 항목 갱신 ($TOOL_COUNT tools)",
  "content": "$CONTENT_B64",
  "sha": "$SHA"
}
EOF

echo "✓ stations.json 동기화 완료"
