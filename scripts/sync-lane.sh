#!/usr/bin/env bash
# sync-lane.sh — papyrus lanes.json에 studio 레인 확인/추가
# 증빙: 크로스레포 인터페이스 스크립트 (헌법 제2조 §2)
set -euo pipefail

PAPYRUS_REPO="dtslib1979/dtslib-papyrus"
LANES_PATH="maps/lanes.json"

echo "▶ Papyrus lanes.json studio 레인 확인"

RESP=$(gh api "repos/$PAPYRUS_REPO/contents/$LANES_PATH")
HAS_STUDIO=$(echo "$RESP" | python3 -c "
import sys, json, base64
d = json.loads(base64.b64decode(json.load(sys.stdin)['content']))
print('studio' in d.get('lanes', {}))
")

if [ "$HAS_STUDIO" = "True" ]; then
  echo "✓ studio 레인 이미 존재"
  exit 0
fi

echo "  studio 레인 추가 중..."
SHA=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")
UPDATED=$(echo "$RESP" | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
d = json.loads(base64.b64decode(data['content']))
d['lanes']['studio'] = {
    'repo': 'dtslib1979/dtslib-cloud-appstore',
    'path': 'scripts/atoms',
    'prefix': 'satom',
    'method': 'pr',
    'branch_pattern': 'auto/satom-{date}-{id}',
    'output_type': 'studio-atom',
    'sensitivity_policy': {
        'public': 'allowed',
        'private': 'blocked',
        'restricted': 'blocked'
    }
}
print(json.dumps(d, indent=2, ensure_ascii=False))
")

CONTENT_B64=$(echo "$UPDATED" | base64 -w 0)
gh api -X PUT "repos/$PAPYRUS_REPO/contents/$LANES_PATH" \
  --input - <<EOF
{
  "message": "feat: studio 레인 추가",
  "content": "$CONTENT_B64",
  "sha": "$SHA"
}
EOF

echo "✓ studio 레인 추가 완료"
