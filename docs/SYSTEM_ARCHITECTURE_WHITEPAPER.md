# DTSLIB Cloud Appstore — System Architecture Whitepaper

> **Version:** v1.2 — Execution Document + Browser=Studio 프레이밍 + F-Droid 판정 + 게임 카테고리
> **Date:** 2026-03-03
> **Author:** Parksy (Voice) + Claude Code (Implementation)
> **형제 문서:** dtslib-apk-lab/docs/SYSTEM_ARCHITECTURE_WHITEPAPER.md v2.2
> **한 줄 요약:** 브라우저 스튜디오 장비 보관함 — Chrome 무료 엔진으로 방송 소재를 만든다. 빌드 없이, 구독 없이, 서버 없이.

---

## 0. Fact Sheet

| 항목 | 수치 | 출처 |
|------|------|------|
| 도구 수 | **9** (PWA 4 + WebApp 5) | `apps.json` |
| 총 코드 | **~17,500줄** (HTML 3,817 + JS 7,584 + CSS ~2,100 + 기타) | `wc -l` |
| 자동화 스크립트 | **2개** (guard + icon generator) | `scripts/` |
| CI/CD 워크플로우 | **2개** (deploy + guard) | `.github/workflows/` |
| 공유 모듈 | **4개** (nav, ffmpeg-loader, file-utils, progress-ui) | `shared/js/` |
| 디자인 시스템 | **1파일** | `shared/css/design-system.css` |
| FFmpeg WASM 버전 | **0.11.0** (3패키지 세트 잠금) | CDN unpkg/jsdelivr |
| 빌드 도구 | **0** (webpack/vite/rollup 없음) | CLAUDE.md §5 |
| npm 의존성 | **0** (CDN script 태그만) | CLAUDE.md §5 |
| 개발 기간 | 90일 (2025-12-03 ~ 2026-03-02) | `git log --reverse` |
| 커밋 수 | **408개** | `git log --oneline --all` |
| 월 비용 | **$0** (GitHub Pages + CDN) | — |
| 스토어 | dtslib1979.github.io/dtslib-cloud-appstore | GitHub Pages |
| 대시보드 | Store + Factory + Pipeline | index.html 884줄 |

---

## 1. System Overview — 형제 레포 비교

### 1.1 Twin Store Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 dtslib-apk-lab (APK Store)                    │
│  입력: F-Droid URL                                           │
│  출력: Flutter+Kotlin APK                                    │
│  기술: Dart 19K줄 + Kotlin 5K줄 + GitHub Actions 21개        │
│  배포: Vercel Store + GitHub Releases                        │
│  빌드: CI/CD (서버사이드)                                      │
│  5-Stage: Ingestion → Analysis → Transform → Build → Distrib │
├─────────────────────────────────────────────────────────────┤
│                 dtslib-cloud-appstore (Web Store)             │
│  입력: 도구 이름 + 타입                                       │
│  출력: 순수 HTML/JS/CSS 도구                                  │
│  기술: HTML/JS/CSS ~17K줄 + FFmpeg WASM                      │
│  배포: GitHub Pages (직접 서빙)                               │
│  빌드: 없음 (브라우저가 런타임)                                 │
│  5-Stage: Spec → Scaffold → Register → PWA → Deploy          │
└─────────────────────────────────────────────────────────────┘
```

**핵심 차이:** APK Lab은 "소스를 빌드해서 APK를 만드는" 공장. Cloud Appstore는 "코드 자체가 제품인" 공장. 빌드 단계가 없다 — 파일을 push하면 그게 곧 배포다.

### 1.2 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Layer 3: DISTRIBUTION                        │
│  GitHub Pages ← gh-pages 브랜치 ← deploy.yml 자동 배포       │
│  각 도구: /{tool-id}/index.html (직접 접근 가능)              │
├─────────────────────────────────────────────────────────────┤
│                  Layer 2: AUTOMATION                          │
│                                                               │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────┐ ┌─────────┐ │
│  │ Stage 1 │→│ Stage 2  │→│ Stage 3  │→│St. 4│→│ Stage 5 │ │
│  │  SPEC   │ │ SCAFFOLD │ │ REGISTER │ │ PWA │ │ DEPLOY  │ │
│  │validate │ │ HTML/JS  │ │apps.json │ │sw/mf│ │ Pages   │ │
│  └─────────┘ └──────────┘ └──────────┘ └─────┘ └─────────┘ │
│        │          │           │           │          │        │
│        └──────────┴───────────┴───────────┴──────────┘        │
│                    GOVERNANCE LAYER                            │
│         CloudAppStore Guard + PWA 2-Track Policy             │
├─────────────────────────────────────────────────────────────┤
│                  Layer 1: TOOL MANUFACTURING                  │
│  9 browser-native tools (HTML + JS + CSS, no build)          │
│  Shared infra: nav.js, ffmpeg-loader.js, design-system.css   │
│  FFmpeg WASM 0.11.0 (CDN, 4 tools)                          │
└─────────────────────────────────────────────────────────────┘

      ↑ 모든 레이어를 관통하는 입력:
      🎤 Voice → Claude Code → Git Commit → GitHub Pages
```

### 1.3 자동화 현황

| Stage | 구현 | 자동화율 | 설명 |
|-------|------|----------|------|
| 1 Spec | 대시보드 입력 폼 | 90% | 이름/타입/카테고리 검증 |
| 2 Scaffold | GitHub API 파일 생성 | **95%** | index.html + style.css + app.js 자동 생성 |
| 3 Register | GitHub API apps.json 업데이트 | **95%** | 중복 검사 + 자동 등록 |
| 4 PWA | 조건부 manifest/sw 생성 | **95%** | type=pwa만, webapp은 skip |
| 5 Deploy | GitHub Pages 자동 | **100%** | push→deploy.yml→gh-pages |
| **총합** | | **~95%** | APK Lab(72%)보다 높음 — 빌드 없으므로 |

**왜 APK Lab보다 자동화율이 높은가:**
- 빌드 단계 없음 (Stage 4 = 조건부 파일 생성뿐)
- 모든 도구가 같은 기술 스택 (HTML/JS/CSS)
- 외부 의존성 = CDN 링크뿐 (패키지 설치/충돌 없음)
- CI 검증 = guard 1개 (APK Lab은 헌법+라이선스+빌드)

---

## 2. Layer 1: Tool Manufacturing Line

### 2.1 공통 아키텍처

```
┌──────────────────────────────────────────┐
│           Browser Runtime (Chromium)      │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  Tool App (순수 HTML/JS/CSS)     │    │
│  │  index.html → app.js → style.css │    │
│  │       ↓ (FFmpeg 도구만)          │    │
│  │  FFmpeg WASM 0.11.0 (CDN)        │    │
│  └──────────────────────────────────┘    │
│                   ↕                      │
│  ┌──────────────────────────────────┐    │
│  │  Shared Infrastructure            │    │
│  │  nav.js      — 도구 간 네비게이션  │    │
│  │  ffmpeg-loader.js — WASM 로딩     │    │
│  │  file-utils.js    — 파일 I/O      │    │
│  │  progress-ui.js   — 진행률 UI     │    │
│  │  design-system.css — 공통 스타일   │    │
│  └──────────────────────────────────┘    │
│                   ↕ (PWA만)              │
│  ┌──────────────────────────────────┐    │
│  │  Service Worker + Manifest        │    │
│  │  cache-first 오프라인 셸           │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

**빌드 도구 없음.** 이 구조가 곧 이 레포의 정체성이다.
webpack도, vite도, npm도 없다. `<script>` 태그가 전부다.

### 2.2 도구 포트폴리오

| 도구 | HTML | JS | CSS | 합계 | FFmpeg | type | 카테고리 |
|------|------|-----|-----|------|--------|------|----------|
| lecture-shorts | 489 | 1,697 | ~120 | ~2,306 | O | pwa | 영상 |
| lecture-long | 489 | 1,700 | ~120 | ~2,309 | O | pwa | 영상 |
| clip-shorts | 320 | 964 | ~100 | ~1,384 | O | pwa | 영상 |
| auto-shorts | ~200 | 279 | ~80 | ~559 | O | pwa | 영상 |
| audio-studio | 152 | 676 | ~80 | ~908 | X | webapp | 오디오 |
| slim-lens | ~130 | 640 | ~80 | ~850 | X | webapp | 이미지 |
| bilingual-aligner | 660 | — | — | ~660 | X | webapp | 유틸 |
| image-pack | 133 | 359 | ~60 | ~552 | X | webapp | 이미지 |
| project-manager | 179 | 613 | ~80 | ~872 | X | webapp | 유틸 |
| **합계** | | | | **~10,400** | | | |

**+ Dashboard/Shared/Scripts:**

| 구성 | 줄 수 |
|------|-------|
| index.html (대시보드) | 884 |
| shared/js/ (4 모듈) | ~500 |
| shared/css/ | ~200 |
| scripts/ | ~150 |
| **인프라 합계** | **~1,734** |

### 2.3 PWA 2-Track

```
apps.json "type" 필드
    │
    ├─ "pwa" (4개: 영상 도구)
    │   ├─ index.html
    │   ├─ style.css + app.js
    │   ├─ manifest.json  ← 홈화면 설치
    │   └─ sw.js          ← cache-first 오프라인
    │
    └─ "webapp" (5개: 오디오/이미지/유틸)
        ├─ index.html
        ├─ style.css + app.js
        └─ (SW/manifest 없음)
```

**승격 기준:** FFmpeg(무거운 처리) + 오프라인 필요 + 주1회 이상 사용 → 3개 중 2개 충족 시 pwa로 승격.

### 2.4 FFmpeg WASM 버전 잠금

```
@ffmpeg/ffmpeg   = 0.11.0
@ffmpeg/core     = 0.11.0
@ffmpeg/core-st  = 0.11.0
```

- 3패키지 공통 존재 버전 = 0.11.0뿐
- 0.12.x는 API 호환성 파괴 → 사용 금지
- CDN 듀얼 fallback: unpkg → jsdelivr
- 전부 죽으면 GitHub Releases에 백업

### 2.5 Browser Execution Target

```
지원                           미지원 (존재하지 않는 것으로 간주)
─────────────────              ─────────────────────────────
Samsung Internet (Chromium)    iOS / Safari
Android Chrome (Chromium)      Firefox
Windows Chrome (Chromium)      -webkit- prefix 대응
Windows Edge (Chromium)        Cross-browser 호환 레이어
```

엔진이 하나이므로 전략도 하나다. 크로스 브라우저 코드 = 죽은 코드.

---

## 3. 5-Stage Pipeline — Execution Spec

> 대시보드(index.html)의 "Tool Pipeline" 섹션에서 인터랙티브 실행.
> GitHub REST API로 실제 파일 생성 — 모의 실행 아님.

### Stage 1: Spec (검증)

| 항목 | 값 |
|------|-----|
| **입력** | 도구 이름, 타입(webapp/pwa), 카테고리, 설명 |
| **출력** | 검증된 스펙 (이름 → slug 변환) |
| **실행자** | 브라우저 JS (로컬) |
| **자동화율** | 90% |

```
이름 "My Tool" → slug "my-tool"
중복 검사: apps.json에서 같은 ID 존재 여부
필수 필드 검증: 이름, 설명 비어있으면 FAIL
```

### Stage 2: Scaffold (파일 생성)

| 항목 | 값 |
|------|-----|
| **입력** | slug + 도구 스펙 |
| **출력** | `{slug}/index.html`, `{slug}/style.css`, `{slug}/app.js` |
| **실행자** | GitHub Contents API (PUT) |
| **자동화율** | 95% |

```
GitHub API → PUT /contents/{slug}/index.html
  → manifest link + SW 등록 (pwa만)
  → shared/js/nav.js 링크
GitHub API → PUT /contents/{slug}/style.css
  → 표준 다크 테마 (bg #000, text #f5f5f7)
GitHub API → PUT /contents/{slug}/app.js
  → 빈 스켈레톤
```

각 PUT이 독립 커밋 → git log에 공정 기록 남음 (매트릭스 제2조 "증빙").

### Stage 3: Register (등록)

| 항목 | 값 |
|------|-----|
| **입력** | 도구 스펙 + apps.json 현재 내용 |
| **출력** | apps.json에 새 항목 추가 |
| **실행자** | GitHub Contents API (PUT, SHA 기반 업데이트) |
| **자동화율** | 95% |

```json
// 추가되는 엔트리
{
  "id": "my-tool",
  "name": "My Tool",
  "desc": "설명",
  "icon": "🔧",
  "version": "1.0",
  "category": "util",
  "type": "webapp"
}
```

### Stage 4: PWA (조건부)

| 항목 | 값 |
|------|-----|
| **입력** | type 필드 |
| **출력** | type=pwa: manifest.json + sw.js / type=webapp: SKIP |
| **실행자** | GitHub Contents API (PUT) |
| **자동화율** | 95% |

```
type === "pwa":
  PUT /contents/{slug}/manifest.json
    → name, short_name, start_url, display: standalone
    → icons: 192px + 512px
  PUT /contents/{slug}/sw.js
    → cache-first 전략
    → ASSETS = ['./', './index.html', './style.css', './app.js']

type === "webapp":
  → SKIP (badge: "Skipped — webapp type")
```

### Stage 5: Deploy (자동)

| 항목 | 값 |
|------|-----|
| **입력** | Stage 2~4에서 push된 커밋들 |
| **출력** | GitHub Pages 라이브 URL |
| **실행자** | deploy.yml (GitHub Actions, 자동 트리거) |
| **자동화율** | 100% |

```
각 Stage의 PUT = main 브랜치에 직접 커밋
  → deploy.yml 자동 트리거
  → JamesIves/github-pages-deploy-action
  → gh-pages 브랜치로 복사
  → GitHub Pages 서빙

결과 URL: https://dtslib1979.github.io/dtslib-cloud-appstore/{slug}/
```

**APK Lab과의 결정적 차이:** APK Lab의 Stage 4(Build)는 Flutter 빌드 + CI가 5~10분 걸린다. Cloud Appstore의 Stage 5(Deploy)는 push=deploy이므로 ~30초.

---

## 4. Dashboard — Store + Factory + Pipeline

> index.html 884줄. 하나의 파일에 3개 기능이 공존한다.

### 4.1 아키텍처

```
index.html (884줄, 순수 HTML/CSS/JS)
│
├─ IIFE: var F = (function() { ... })();
│   │
│   ├─ Config Layer
│   │   ├─ dashboard-config.json (fetch)
│   │   └─ apps.json (fetch)
│   │
│   ├─ Store Mode (도구 카드 브라우징)
│   │   ├─ renderCards() — 도구 카드 그리드
│   │   ├─ renderStats() — 통계 바
│   │   └─ renderCatFilter() — 카테고리 필터
│   │
│   ├─ Factory Mode (도구 생성)
│   │   ├─ openModal() / closeModal() — 모달 UI
│   │   └─ createTool() — GitHub API로 파일 생성
│   │
│   ├─ Pipeline Mode (5-Stage 인터랙티브)
│   │   ├─ renderPipeline() — 입력 폼 + 5단계 UI
│   │   ├─ startPipeline() — 5-Stage 오케스트레이터
│   │   ├─ psSet() — 스테이지 상태 변경 (idle/active/done/fail)
│   │   └─ pLog() — 실시간 로그 출력
│   │
│   └─ Public API
│       return { createTool, openModal, closeModal, saveToken, startPipeline }
│
├─ GitHub API Layer
│   ├─ ht() — PAT 토큰 존재 확인
│   ├─ api(method, url, body) — fetch wrapper
│   └─ gp(path) — GitHub API URL 빌더
│
└─ CSS (인라인)
    ├─ 기본 테마 (#000 bg, #0A84FF accent)
    ├─ 카드 그리드 (2열)
    ├─ Factory 모달
    └─ Pipeline UI (dot animation, badge states)
```

### 4.2 인증 모델

```
localStorage.setItem('gh_token', PAT);
  → 모든 GitHub API 호출에 Bearer 토큰 사용
  → 토큰 없으면 Pipeline/Factory 숨김 (Store만 공개)
  → 개인 PAT = 1인 사용, RBAC 불필요
```

### 4.3 UI 상태 모델 (Pipeline)

```
각 Stage의 dot:

  IDLE     → 회색, 숫자만 표시
  ACTIVE   → 파란색 spin 애니메이션, "RUN" 뱃지
  DONE     → 초록색, "DONE" 뱃지
  FAIL     → 빨간색, "FAIL" 뱃지

Log panel:
  클래스 "ok"   → 초록 텍스트
  클래스 "err"  → 빨간 텍스트
  클래스 "warn" → 노란 텍스트
```

---

## 5. Governance Layer

### 5.1 CloudAppStore Guard

`scripts/cloudappstore_guard.py` — 110줄.

```
ROOT WHITELIST (동적):
  정적: index.html, README.md, CLAUDE.md, .gitignore, .nojekyll,
        apps.json, vercel.json, manifest.json, sw.js,
        dashboard-config.json, .github, assets, scripts, shared, docs, 00_TRUTH
  동적: apps.json → 각 앱 ID 자동 추가

금지 패턴:
  ❌ ROOT_WHITELIST_VIOLATION — 화이트리스트 외 파일
  ❌ PY_TRASH_FORBIDDEN — __pycache__, *.pyc
  ❌ SPACE_IN_FILENAME_FORBIDDEN — 공백 파일명
  ❌ ROOT_IMAGE_FORBIDDEN — 루트 이미지 (assets/ 외)
  ❌ ROOT_JS_FORBIDDEN — 루트 JS (sw.js 제외)
```

**실행:** `repo-guard.yml` — 모든 PR + main push에 자동 실행.

### 5.2 PWA 2-Track Policy

| 규칙 | 적용 |
|------|------|
| type=webapp에 SW 생성 | **금지** |
| type=pwa에 manifest 누락 | **위반** |
| webapp→pwa 승격 | 승격 기준 3조건 중 2개 충족 |
| 새 도구 기본 type | webapp (Factory/Pipeline 기본값) |

### 5.3 절대 금지 목록

| 금지 | 이유 |
|------|------|
| 빌드툴 (webpack, vite, rollup) | 유지보수 지옥 |
| npm install / node_modules | CDN `<script>` 태그면 충분 |
| 최신 FFmpeg (0.12.x) | API 호환성 파괴 |
| SPA 프레임워크 (React, Vue) | 정적 HTML + 단순 JS |
| TypeScript | 트랜스파일 = 빌드 의존성 |
| 로그인/계정/클라우드 저장 | 이 도구의 존재 이유를 파괴 |
| Safari/iOS 대응 | 타겟 밖 (Chromium only) |

---

## 6. Data Model

### 6.1 apps.json (중앙 레지스트리, SSOT)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 도구 슬러그 (디렉토리명) |
| `name` | string | Y | 표시 이름 |
| `desc` | string | Y | 한 줄 설명 |
| `icon` | string | Y | 이모지 아이콘 |
| `version` | string | Y | 현재 버전 |
| `category` | enum | Y | `video` \| `audio` \| `image` \| `util` \| `game` |
| `type` | enum | Y | `pwa` \| `webapp` |

### 6.2 dashboard-config.json (테마/레이아웃)

| 섹션 | 역할 |
|------|------|
| `brand` | 이름, 서브타이틀, GitHub URL, 푸터 |
| `github` | owner, repo, branch (API 호출용) |
| `theme` | 색상 팔레트 (bg, accent, text 등) |
| `layout` | maxWidth, gridColumns |
| `sections` | 기능 토글 (stats, categoryFilter, timeline 등) |
| `stats` | 집계 수치 (total_tools, pwa_tools 등) |
| `categories` | 카테고리 레이블 + 색상 |

### 6.3 매트릭스 교차점

```
ERP (가로축)                  FAB (세로축)
─────────                    ─────────
커밋 = 전표                  도구 = 제품
git log = 원장               Pipeline = 공정 라인
apps.json = 출하 목록         shared/ = 공용 치공구
dashboard-config = 제품 마스터  Guard = 품질 검사

교차점: apps.json
  → 거래 증빙 (어떤 도구가 등록됐는가)
  → 공정 기록 (Pipeline Stage 3의 산출물)
  → 제품 카탈로그 (Store 진열 데이터)
```

---

## 7. APK Lab과의 비교 (Twin Analysis)

| 차원 | APK Lab | Cloud Appstore |
|------|---------|----------------|
| **제품** | Flutter+Kotlin APK | 순수 HTML/JS/CSS 웹도구 |
| **빌드** | GitHub Actions (서버) | 없음 (브라우저가 런타임) |
| **배포** | Vercel + GitHub Releases | GitHub Pages |
| **언어** | Dart 19K + Kotlin 5K | HTML/JS/CSS ~17K |
| **의존성** | 68 Flutter 패키지 | 0 (CDN 3개뿐) |
| **자동화율** | ~72% | ~95% |
| **파이프라인** | 5-Stage (F-Droid→APK) | 5-Stage (Spec→Deploy) |
| **거버넌스** | 헌법 10조 + 라이선스 감사 | Guard 5규칙 + 2-Track |
| **스크립트** | 9개 ~2,000줄 | 2개 ~150줄 |
| **Level 2** | propagate.sh (멀티앱 전파) | **미구현** (§10 참조) |
| **월 비용** | ~$5 (Whisper API) | $0 |
| **복잡도** | 높음 (네이티브, 빌드, 서명) | 낮음 (파일 = 제품) |

**핵심 통찰:** Cloud Appstore가 단순한 이유 = "빌드 과정이 없어서".
APK Lab은 소스→빌드→APK라는 변환 과정이 있다. Cloud Appstore는 소스=제품이다.

---

## 8. F-Droid 소스풀 — 불필요 판정

> **결론: Cloud Appstore에 F-Droid 소스풀 자동화는 필요 없다. APK Lab 전용이다.**

### 8.1 왜 불필요한가

APK Lab의 파이프라인:
```
F-Droid URL → clone (Kotlin/Java 소스) → transform (패키지명/테마) → build APK
                  ↑ 같은 기술 스택이니까 변환 가능
```

Cloud Appstore에 같은 걸 시도하면:
```
F-Droid URL → clone (Kotlin/Java 소스) → ??? → HTML/Canvas/JS ???
                  ↑ 기술 스택이 완전히 다름. 코드 재사용률 0%
```

Kotlin 체스 앱을 clone해서 Canvas+JS 웹앱으로 "자동 변환"하는 건 불가능하다.
참조해서 읽는 것보다 Claude Code랑 직접 짜는 게 10배 빠르다.

### 8.2 F-Droid 조사 결과

| 분야 | F-Droid 앱 존재 | 코드 참조 가치 | 데이터 추출 가치 |
|------|----------------|--------------|----------------|
| 바둑 | Gobandroid (GPL, Java) | **없음** — 바둑판 Canvas 200줄이면 끝 | **있음** — SGF 쓰메고 300+ |
| 체스 | DroidFish, TacticMaster (GPL) | **없음** — 체스판도 Canvas 200줄 | **있음** — Lichess CSV 575만 퍼즐 |
| 퀴즈 | Trivia App (MIT) | **없음** | **있음** — OpenTDB API (미술/음악) |
| 플래시카드 | AnkiDroid (AGPL) | **없음** | **있음** — .apkg 덱 (와인/클래식/미술사) |
| 와인 | Cavity (GPL) | **없음** — 재고관리 앱, 퀴즈 아님 | **없음** |
| 음악 | Open Ear (MIT, Ionic) | **약간** — 인터벌 인식 알고리즘 | **없음** |
| 미술 | Muzei (Apache) | **없음** — 배경화면 앱 | **없음** |

### 8.3 판정

```
소스 코드 참조?  → 불필요. 바닐라 JS로 직접 짜는 게 빠르다.
데이터 추출?    → 유용. 하지만 F-Droid clone 불필요, 데이터만 다운로드.
자동화 파이프라인? → 불필요. 앱 하나 = HTML 1장 + JS 300줄 + JSON 데이터.
```

### 8.4 데이터 수급 전략 (F-Droid 대신)

| 분야 | 데이터 소스 | 포맷 | 라이선스 | 비고 |
|------|-----------|------|---------|------|
| 바둑 쓰메고 | sanderland/tsumego (GitHub) | SGF | MIT계 | 10,000+ 문제 |
| 체스 퍼즐 | database.lichess.org | CSV (FEN+UCI) | CC0 | 575만 퍼즐 |
| 일반 퀴즈 | opentdb.com API | JSON | CC BY-SA | 음악/미술 카테고리 |
| 와인/클래식/미술 | AnkiWeb 공유 덱 | .apkg→SQLite | 덱별 상이 | 직접 JSON 변환 |
| 미술 이미지 | Metropolitan Museum API | JSON + CC0 이미지 | CC0 | 47만 작품 |

**이 데이터들은 `curl` 한 번이면 받는다. 소스풀 자동화 파이프라인이 필요한 규모가 아니다.**

---

## 9. Browser = Studio — 브라우저는 스튜디오다

> **프로그래밍이 아니다. 방송 소재를 만드는 거다.**
> **웹 페이지 = 방송 프로그램. 브라우저 = 무료 스튜디오 장비.**

### 9.1 왜 이 프레이밍인가

Cloud Appstore의 도구는 "웹앱 개발"이 아니다. 브라우저가 제공하는 **무료 엔진**을 방송 소재 제작 도구로 쓰는 것이다.

```
❌ 기존 프레이밍:  "PWA 개발자가 웹앱을 만든다"
✅ 새 프레이밍:    "방송 PD가 브라우저 스튜디오에서 소재를 만든다"
```

이 전환이 중요한 이유: 프레이밍이 바뀌면 도구 설계 기준이 바뀐다.
- "이 API를 어떻게 구현하지?" → "이 장비로 어떤 소재를 만들지?"
- "유저 경험을 어떻게 개선하지?" → "방송에 쓸 수 있는 결과물이 나오나?"

### 9.2 Termux(공장) vs 브라우저(스튜디오) — 역할 분담

```
┌─────────────────────────────────────────────────────────────┐
│                  Termux (CLI 공장)                            │
│  FFmpeg 배치 인코딩, 텍스트 처리, 파일 변환, 스크립트 자동화   │
│  = 오프라인, 헤드리스, 대량 처리, 파이프라인                   │
│  ※ GPU 없음, 카메라 없음, 마이크 없음, 화면 캡처 없음         │
├─────────────────────────────────────────────────────────────┤
│                  브라우저 (스튜디오)                           │
│  실시간 카메라, GPU 렌더링, 마이크 입력, 화면 캡처, PiP        │
│  = 온라인, 시각적, 실시간, 인터랙티브                          │
│  ※ 서버 비용 $0 — Chrome이 런타임 엔진을 무료 제공            │
└─────────────────────────────────────────────────────────────┘
```

**핵심:** Termux가 못하는 것 = 브라우저가 해야 하는 것. 이것이 Cloud Appstore의 존재 이유다.

### 9.3 브라우저 무료 엔진 카탈로그

> "서버 비용으로 내가 공짜로 쓸 수 있는 것들"

| 엔진 | Browser API | 대체하는 유료 서비스 | 방송 소재 용도 |
|------|-------------|-------------------|---------------|
| **음성 인식** | Web Speech API (STT) | Whisper API $5/mo | 자막 자동 생성, 음성 명령 |
| **음성 합성** | SpeechSynthesis (TTS) | Google Cloud TTS $4/100만자 | 나레이션, 비주얼 노벨 대사 |
| **GPU 렌더링** | Canvas 2D / WebGL | 없음 (Termux에 GPU 없음) | 바둑판, 체스판, 이미지 필터, LUT |
| **카메라** | getUserMedia | 없음 | 실시간 촬영, AR 오버레이 |
| **화면 캡처** | getDisplayMedia | OBS ($0이지만 PC 전용) | 스크린 레코딩 소재 |
| **오디오 DSP** | Web Audio API + AudioWorklet | DAW 플러그인 | 실시간 이퀄라이저, BGM 믹싱 |
| **PiP** | Picture-in-Picture API | 텔레프롬프터 앱 $10/mo | 대본 읽기 + 촬영 동시 |
| **디바이스 센서** | DeviceOrientation / Motion | 전용 센서 앱 | 자이로 기반 인터랙션 |
| **블루투스** | Web Bluetooth | 전용 앱 | BLE 리모컨으로 촬영 제어 |
| **파일 시스템** | OPFS + File System Access | 서버 스토리지 | 프로젝트 폴더 로컬 관리 |
| **멀티스레드** | Web Workers + WASM | 서버 연산 | FFmpeg WASM 백그라운드 처리 |
| **비디오 코덱** | WebCodecs | 서버사이드 트랜스코딩 | 프레임 단위 비디오 처리 |
| **MIDI** | Web MIDI API | 전용 MIDI 소프트웨어 | 음악 소재 입력 |
| **온디바이스 AI** | Gemini Nano (chrome.ai) | Cloud AI API | 로컬 텍스트 생성/분류 |

### 9.4 4대 벽 (한계)

무료라고 다 되는 건 아니다. 브라우저 스튜디오의 벽:

| 벽 | 설명 | 대응 |
|----|------|------|
| **권한 벽** | 카메라/마이크/블루투스 = 사용자 허가 필수, HTTPS only | GitHub Pages = HTTPS 기본 |
| **보안 벽** | SharedArrayBuffer = COOP/COEP 헤더 필요 → Pages 불가 | 싱글스레드 모드 유지 (기존 정책) |
| **지원 벽** | Web Bluetooth/Serial = Chrome 전용, 모바일 제한적 | Chromium-only 정책이라 문제 없음 |
| **시스템 벽** | 파일 시스템 접근 제한, 백그라운드 실행 제한 | PWA SW로 일부 우회, OPFS 활용 |

### 9.5 도구 설계 필터 — "방송 소재 테스트"

기존 필터:
```
"인샷보다 덜 귀찮은가?" (§16)
```

추가 필터:
```
"이걸로 방송 소재가 나오는가?"
  → YES: 만들 가치 있음
  → NO:  Termux CLI로 해결하거나, 기존 앱 사용
```

| 후보 도구 | 방송 소재 | 브라우저 엔진 | 판정 |
|-----------|----------|-------------|------|
| 바둑 드릴 | 교양 퀴즈 방송 소재 | Canvas 2D | **만든다** |
| 체스 오프닝 | 교양 퀴즈 방송 소재 | Canvas 2D | **만든다** |
| 와인 플래시카드 | 교양 퀴즈 방송 소재 | DOM + 이미지 | **만든다** |
| 비주얼 노벨 | 인터랙티브 웹툰 방송 | Canvas + Audio + TTS | **만든다** |
| PiP 텔레프롬프터 | 촬영 보조 도구 | PiP API | **만든다** |
| 실시간 카메라 LUT | 촬영 소재 필터 | getUserMedia + Canvas | **만든다** |
| BLE 리모컨 | 촬영 제어 | Web Bluetooth | 검토 (지원 벽) |
| 프로젝트 폴더 에디터 | 소재 정리 | File System Access | 검토 (시스템 벽) |

### 9.6 정체성 전환

```
Before:  "개발자가 PWA를 만든다"
After:   "에듀 아트 엔지니어가 브라우저 스튜디오에서 방송 소재를 만든다"

Before:  "Cloud Appstore = 웹앱 보관함"
After:   "Cloud Appstore = 브라우저 스튜디오 장비 보관함"

Before:  "도구 9개를 관리한다"
After:   "스튜디오 장비 9대를 운영한다"
```

이 전환은 기술 스택을 바꾸지 않는다. HTML/JS/CSS, 빌드 도구 없음, CDN 스크립트 태그 — 전부 그대로다. 바뀌는 건 **왜 만드는가**에 대한 답이다.

> **"코드를 짜는 게 아니라 스튜디오 장비를 조립하고 있다.**
> **다만 그 장비가 브라우저에서 돌아가고, Chrome이 무료로 엔진을 제공할 뿐이다."**

---

## 10. Level 2 확장 설계 — Propagation Pipeline

> APK Lab에는 propagate.sh가 있다. Cloud Appstore에는 아직 없다.
> "같은 변경을 9개 도구에 한 번에 전파" — 이것이 Level 2다.

### 10.1 왜 필요한가

```
현재 (Level 0):  도구를 하나씩 수동 수정
Level 1:         Pipeline으로 새 도구 생성 (구현 완료)
Level 2:         기존 도구 N개를 한 번에 업데이트

예시: shared/js/nav.js 경로 변경 → 9개 도구 전부 수정 필요
예시: 다크 테마 색상 #000 → #0D0D0D → 9개 style.css 전부 수정
예시: FFmpeg WASM 0.11.0 → 0.11.x → 4개 PWA 도구 수정
```

### 10.2 대상 변경 유형

| type | 자동화 가능 | 대상 파일 | 예시 |
|------|-----------|----------|------|
| `theme` | **100%** | `{tool}/style.css` | 배경색 #000→#0D0D0D |
| `shared` | **100%** | `{tool}/index.html` 내 script 태그 | nav.js 경로 변경 |
| `ffmpeg` | **90%** | 4개 PWA의 `app.js` 내 CDN URL | 버전 잠금 세트 교체 |
| `scaffold` | **80%** | `{tool}/index.html` 공통 구조 | meta 태그 추가 |
| `feature` | **30%** | `{tool}/app.js` 개별 로직 | 도구별 다르므로 반자동 |

### 10.3 change-spec.json (APK Lab과 동일 스키마)

```json
{
  "schema_version": "change-spec-v1",
  "type": "theme",
  "scope": "all",
  "description": "다크 배경 미세 조정",
  "targets": [
    {
      "files": "style.css",
      "pattern": "background: #000",
      "replacement": "background: #0A0A0A"
    }
  ],
  "dry_run": false
}
```

### 10.4 구현 방식 — 브라우저 vs 스크립트

| 방식 | 장점 | 단점 |
|------|------|------|
| **브라우저 (대시보드)** | 대시보드 통합, GitHub API 재사용 | 9개 파일 순차 PUT = 느림, API 제한 |
| **스크립트 (propagate.sh)** | 빠름, 로컬 git | 대시보드와 별도 실행 |

**결론:** APK Lab과 동일하게 `scripts/propagate.sh` 방식이 맞다.
브라우저 9개 PUT은 API rate limit 위험 + 속도 문제.

### 10.5 구현 로드맵

| 태스크 | 산출물 | 상태 |
|--------|--------|------|
| propagate.sh 포팅 | APK Lab 코드 적응 | 미구현 |
| change-spec 예시 3개 | theme, shared, ffmpeg | 미구현 |
| 대시보드 Level 2 UI | "Propagate" 탭 + 실행 현황 | 미구현 |

---

## 11. FMEA (Failure Mode & Effects Analysis)

| # | 장애 모드 | 심각도 | 빈도 | 탐지 | RPN | 대응 |
|---|----------|--------|------|------|-----|------|
| F1 | CDN 장애 (unpkg/jsdelivr) | 상 | 낮음 | 없음 | 6 | 듀얼 fallback + GH Releases 백업 |
| F2 | FFmpeg 0.11.0 CDN 삭제 | **상** | 낮음 | 없음 | **9** | 즉시 GH Releases로 전환 |
| F3 | GitHub API rate limit | 중 | 중 | 자동 | 4 | Pipeline 순차 실행 (병렬 PUT 금지) |
| F4 | apps.json SHA 충돌 | 중 | 낮음 | 자동 | 3 | 409 에러 → 재시도 (최신 SHA 재취득) |
| F5 | Guard false positive | 하 | 낮음 | 자동 | 1 | 화이트리스트 동적 갱신으로 해결됨 |
| F6 | 도구 간 스타일 불일치 | 하 | 중 | 없음 | 3 | Level 2 theme propagation으로 해결 |
| F7 | SW 캐시 스테일 | 중 | 중 | 없음 | 6 | sw.js 버전 갱신 + 도구별 캐시명 분리 |
| F8 | 모바일 메모리 초과 (FFmpeg) | 중 | 중 | 없음 | 6 | 도구별 입력 제한 적용 (§2.5 참조) |

**RPN** = 심각도(1-3) × 빈도(1-3) × 탐지난이도(1-3). **6 이상 즉시 대응.**

F2가 최고 RPN — FFmpeg WASM 바이너리 CDN 백업이 최우선 과제.

---

## 12. Implementation Roadmap (3-Phase)

### Phase 1: Foundation (완료)

| 태스크 | 상태 |
|--------|------|
| 9개 도구 개발 + 배포 | **완료** |
| PWA 2-Track 분류 | **완료** |
| 대시보드 Store + Factory | **완료** |
| 인터랙티브 5-Stage Pipeline | **완료** |
| Guard 동적 화이트리스트 | **완료** |
| nav.js apps.json 동적 읽기 | **완료** |

### Phase 2: Propagation (다음)

| 태스크 | 산출물 | 의존성 |
|--------|--------|--------|
| `scripts/propagate.sh` 작성 | Level 2 일괄 전파 엔진 | Phase 1 |
| change-spec 예시 3개 | theme, shared, ffmpeg | propagate.sh |
| FFmpeg WASM GH Releases 백업 | CDN 장애 대응 | — |
| 대시보드 Propagate UI | Level 2 시각화 | propagate.sh |

### Phase 3: Intelligence (나중)

| 태스크 | 산출물 | 의존성 |
|--------|--------|--------|
| 도구 의존성 그래프 | shared 모듈 영향 범위 | Phase 2 |
| 비주얼 노벨 도구 | parksy-image 연동 | 별도 설계서 (VISUAL-NOVEL-ARCHITECTURE.md) |
| 도구 사용 통계 | localStorage 기반 집계 | — |
| 크로스레포 동기화 | parksy-image/audio 에셋 연동 | 매니페스트 경유 |

---

## 13. Matrix Architecture — ERP × FAB

```
               ERP (가로축: 원장)
               │
               │  커밋=전표  git log=원장  크로스레포=인터페이스
               │
     ──────────┼──────────────────────────
               │
   FAB         │       ┌──────────────────┐
   (세로축:    │       │  JSON 매니페스트  │
    공정)      │       │  (교차점)         │
               │       └──────────────────┘
   BOM         │
   =CDN links  │   apps.json            = 제품 카탈로그 × 출하 목록
   라우팅      │   dashboard-config.json = 공장 설정 × 제품 마스터
   =Pipeline   │   manifest.json (×4)   = PWA 사양서 × 설치 증빙
   WIP         │
   =없음       │   Pipeline 커밋 로그   = 작업 지시서 × 변경 전표
   수율        │   Guard 결과           = 품질 검사 × 감사 증빙
   =Guard PASS │
               │
```

**4대 원칙 × Cloud Appstore:**

| 원칙 | 적용 |
|------|------|
| 삭제 없다, 반대 분개 | 도구 삭제 안 함, apps.json에서 비활성화만 |
| 증빙 없는 거래 없다 | Pipeline 각 Stage가 독립 커밋 = 공정 증빙 |
| BOM 확인 후 착공 | Stage 1 Spec 검증 통과 전 Scaffold 진입 금지 |
| 재공품 방치 금지 | 미완성 도구 = Stage 2에서 멈추면 안 됨 |

---

## 14. Infrastructure Map

```
┌─────────────────────────────────────────────────────┐
│                      CLOUD                           │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  GitHub   │  │  CDN (unpkg/ │  │ GitHub Pages  │  │
│  │ Repo+CI   │  │  jsdelivr)   │  │ Static Host   │  │
│  │ API+Guard │  │ FFmpeg WASM  │  │ 9 tools live  │  │
│  └─────┬─────┘  └──────┬──────┘  └──────┬────────┘  │
└────────┼───────────────┼────────────────┼────────────┘
         │    HTTPS      │    HTTPS       │   HTTPS
┌────────┼───────────────┼────────────────┼────────────┐
│        ↓               ↓                ↓            │
│  ┌────────────────────────────────────────────────┐  │
│  │            Galaxy Tab S9 (Chromium)             │  │
│  │                                                 │  │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐         │  │
│  │  │lecture  │ │lecture  │ │auto     │         │  │
│  │  │-shorts  │ │-long    │ │-shorts  │   PWA   │  │
│  │  └─────────┘ └─────────┘ └──────────┘         │  │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐         │  │
│  │  │clip    │ │audio   │ │slim     │         │  │
│  │  │-shorts  │ │-studio  │ │-lens    │  WebApp │  │
│  │  └─────────┘ └─────────┘ └──────────┘         │  │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐         │  │
│  │  │image   │ │bilingual│ │project  │         │  │
│  │  │-pack    │ │-aligner │ │-manager │  WebApp │  │
│  │  └─────────┘ └─────────┘ └──────────┘         │  │
│  │                                                 │  │
│  │  Termux + Claude Code (Pipeline 제어)           │  │
│  └────────────────────────────────────────────────┘  │
│                      DEVICE                           │
└───────────────────────────────────────────────────────┘
```

**비용:** GitHub $0, CDN $0, Pages $0. **합계 $0/월.**

---

## 15. Cross-Repo Sync Map

```
dtslib-cloud-appstore (이 레포)
    │
    ├──→ dtslib-apk-lab (형제)
    │     공유: 대시보드 패턴, Guard 구조, Pipeline 5-Stage 패턴
    │     차이: APK(빌드O) vs Web(빌드X)
    │
    ├──→ parksy-image (에셋 공급)
    │     visual-novel 에피소드 번들 → cloud-appstore/visual-novel/
    │     동기화: deploy-episode.sh (미구현)
    │
    └──→ parksy-audio (에셋 공급)
          Lyria 3 BGM → visual-novel 사운드트랙
          동기화: sync-lyria3-to-image.sh (parksy-audio 내)
```

모든 크로스레포 이동은 명시적 스크립트로 (매트릭스 제2조).

---

## 16. 설계 철학

### "인샷보다 덜 귀찮은가?"

이 레포의 모든 도구는 하나의 질문을 통과해야 한다:
**"이게 InShot / CapCut / 기존 앱보다 덜 귀찮은가?"**

- 설정이 늘어나면 실패
- 설명이 길어지면 실패
- 오류 대응이 복잡하면 실패

### "구독을 끊을 수 있는가?"

| 성공 기준 | 판정 |
|-----------|------|
| 내가 구독 하나 끊었는가? | → 성공 |
| 한 달 뒤에도 다시 쓸 수 있는가? | → 성공 |
| 3년 뒤에도 브라우저에서 그대로 돌아가는가? | → 성공 |

### "빌드 도구 없이 3년"

이 레포에 빌드 도구가 없는 건 실수가 아니라 **설계 결정**이다.
- webpack 설정 파일 = 3년 뒤 호환성 지뢰
- node_modules = 의존성 지옥
- `<script>` 태그 + CDN = 브라우저가 살아있는 한 동작

> "이 프로젝트는 최신 기술을 쓰지 않기 위해 기술을 쓰는 프로젝트다."

---

## Appendix A: 문서 계보

| 문서 | 상태 | 역할 |
|------|------|------|
| **이 문서** | **v1.0** | 시스템 설계도 + 실행 스펙 |
| VISUAL-NOVEL-ARCHITECTURE.md | 설계 단계 | 비주얼 노벨 파이프라인 설계 |
| RULES.md | 운영 중 | 레포 거버넌스 규칙 |
| CLAUDE.md | 운영 중 | Claude Code 행동 규칙 + 기술 제약 |

---

## Appendix B: CLI Quick Reference

```bash
# === Guard 실행 ===
cd ~/dtslib-cloud-appstore
python3 scripts/cloudappstore_guard.py

# === 로컬 서버 ===
python3 -m http.server 8080
# → http://localhost:8080 에서 대시보드 확인
# → http://localhost:8080/lecture-shorts/ 에서 개별 도구 확인

# === Git 작업 ===
git push origin main
# → repo-guard.yml 자동 실행 (Guard)
# → deploy.yml 자동 실행 (GitHub Pages 배포)

# === 도구 생성 (2가지 방법) ===
# 방법 1: 대시보드 Pipeline (브라우저)
#   → PAT 입력 → Pipeline 탭 → 이름/타입/카테고리 → Run
# 방법 2: 대시보드 Factory (브라우저)
#   → PAT 입력 → Factory → New Tool 모달

# === Level 2: Propagation (미구현) ===
# ./scripts/propagate.sh change-specs/theme-tweak.json --dry-run
# ./scripts/propagate.sh change-specs/theme-tweak.json
```

---

> **"코드를 짜는 게 아니라 스튜디오 장비를 조립하고 있다.**
> **다만 그 장비가 브라우저에서 돌아가고, Chrome이 무료로 엔진을 제공하고, 방송 소재가 나올 뿐이다."**

---

*v1.2 — §9 Browser=Studio 프레이밍 추가 (브라우저 무료 엔진 카탈로그, 방송 소재 테스트 필터, 정체성 전환).*
*v1.1 — §8 F-Droid 소스풀 불필요 판정 + 게임 카테고리 추가 + 데이터 수급 전략.*
*v1.0 — Phase 1 완료. 9도구 + PWA 2-Track + 인터랙티브 5-Stage Pipeline + Guard 동적화.*
*최종 갱신: 2026-03-03*
