#!/usr/bin/env bash
# sync-routes.sh — apps.json → OrbitPrompt fab-manifest.json studio_tools 동기화
# 증빙: 크로스레포 인터페이스 스크립트 (헌법 제2조 §2)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORBIT_REPO="dtslib1979/OrbitPrompt"
FAB_PATH="data/fab-manifest.json"

echo "▶ apps.json → OrbitPrompt fab-manifest.json studio_tools 동기화"

# 현재 fab-manifest.json 가져오기
RESP=$(gh api "repos/$ORBIT_REPO/contents/$FAB_PATH")
SHA=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")
CURRENT=$(echo "$RESP" | python3 -c "import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)['content']).decode())")

# apps.json 읽어서 카테고리별 도구 매핑
UPDATED=$(echo "$CURRENT" | python3 -c "
import sys, json

fab = json.load(sys.stdin)
apps = json.load(open('$REPO_ROOT/apps.json'))['apps']

# 카테고리별 도구 ID
by_cat = {}
for a in apps:
    by_cat.setdefault(a['category'], []).append(a['id'])

# 라우트별 studio_tools 매핑 (수동 정의)
route_map = {
    'RT-α': by_cat.get('video', []) + by_cat.get('game', []),
    'RT-β': [],
    'RT-γ': [],
    'RT-δ': [],
    'RT-ε': [],
    'RT-ζ': by_cat.get('audio', []),
    'RT-η': by_cat.get('image', []) + by_cat.get('video', [])[-1:] + by_cat.get('util', [])[:1],
    'RT-θ': []
}

for rt, tools in route_map.items():
    if rt in fab['routes']:
        fab['routes'][rt]['studio_tools'] = tools

print(json.dumps(fab, indent=2, ensure_ascii=False))
")

CONTENT_B64=$(echo "$UPDATED" | base64 -w 0)
gh api -X PUT "repos/$ORBIT_REPO/contents/$FAB_PATH" \
  --input - <<EOF
{
  "message": "sync: fab-manifest.json studio_tools 갱신",
  "content": "$CONTENT_B64",
  "sha": "$SHA"
}
EOF

echo "✓ fab-manifest.json studio_tools 동기화 완료"
