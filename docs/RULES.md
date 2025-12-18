# dtslib-cloud-appstore — RULES

## REPO IDENTITY
- **Type:** PWA App Hub / Cloud App Store
- **Operator:** Claude Code (Web) — solo
- **Deploy:** Vercel (main) / GitHub Pages (secondary)

---

## FOR HUMANS

### ❌ FORBIDDEN
- 루트에 이미지/아이콘 추가
- 루트에 JS 파일 추가 (sw.js 제외)
- 루트에 화이트리스트 외 파일 생성
- 다중 manifest.json (루트에 1개만)

### ✅ ALLOWED
- `apps/` 하위 앱 추가
- `assets/` 아이콘 추가
- `scripts/` 유틸 추가
- 앱별 PWA: `apps/<name>/manifest.json`, `apps/<name>/sw.js`

---

## FOR AI (Claude Code)

### ROOT WHITELIST
```
index.html, README.md, .gitignore, .nojekyll
apps.json, vercel.json, manifest.json, sw.js
.github/, assets/, scripts/, apps/
auto-shorts/, bilingual-aligner/, clip-shorts/
lecture-long/, lecture-shorts/, slim-lens/
```

### RULES
1. 루트 화이트리스트 외 파일 생성 금지
2. 이미지는 assets/만
3. JS는 scripts/만 (sw.js 제외)
4. PWA 허용 (이 레포 전용)

---

## FOR GITHUB

### GUARDRAIL
- `scripts/cloudappstore_guard.py`
- `.github/workflows/repo-guard.yml`

### VIOLATION CODES
| Code | Meaning |
|------|---------|
| ROOT_WHITELIST_VIOLATION | 허용 외 파일 |
| ROOT_IMAGE_FORBIDDEN | 루트 이미지 |
| ROOT_JS_FORBIDDEN | 루트 JS (sw.js 제외) |
| PY_TRASH_FORBIDDEN | __pycache__, *.pyc |
| SPACE_IN_FILENAME_FORBIDDEN | 공백 파일명 |

---

## PHILOSOPHY

> "dtslib-cloud-appstore is a PWA Hub, not a dumping ground."

PWA 허용. 구조 오염 불허.
