# dtslib-cloud-appstore — Claude Code 행동 규칙

---

## 헌법 제1조: 레포지토리는 소설이다

> **모든 레포지토리는 한 권의 소설책이다.**
> **커밋이 문장이고, 브랜치가 챕터이고, git log --reverse가 줄거리다.**

- 삽질, 실패, 방향 전환 전부 남긴다. squash로 뭉개지 않는다.
- 기능 구현 과정 = 플롯 (문제→시도→실패→전환→해결)
- 레포 서사 → 블로그/웹툰/방송 콘텐츠로 파생 (액자 구성)

### 서사 추출 명령

```bash
narrative-extract.py --repo .                    # 이 레포 줄거리
narrative-extract.py --repo . --format synopsis  # 시놉시스
narrative-extract.py --repo . --format blog      # 블로그 원고
narrative-extract.py --repo . --climax           # 전환점만
narrative-extract.py --all ~                     # 28개 레포 연작 인덱스
```

### 서사 분류

| 커밋 유형 | 서사 | 의미 |
|-----------|------|------|
| `feat:` / 기능 추가 | 시도 | 주인공이 무언가를 만든다 |
| `fix:` / 버그 수정 | 삽질 | 예상대로 안 됐다 |
| `migration` / 전환 | 전환 | 버리고 다른 길을 간다 |
| `rewrite` / v2 | 각성 | 처음부터 제대로 다시 한다 |
| `refactor:` | 성장 | 같은 일을 더 잘하게 됐다 |
| `docs:` | 정리 | 지나온 길을 돌아본다 |

---

## ⚙️ 헌법 제2조: 매트릭스 아키텍처

> **모든 레포지토리는 공장이다.**
> **가로축은 재무 원장(ERP)이고, 세로축은 제조 공정(FAB)이다.**

### 가로축: 재무 원장 (ERP 로직)

커밋은 전표다. 한번 기표하면 수정이 아니라 반대 분개로 정정한다.

| 회계 개념 | Git 대응 | 예시 |
|-----------|----------|------|
| 전표 (Journal Entry) | 커밋 | `feat: 새 기능 구현` |
| 원장 (General Ledger) | `git log --reverse` | 레포 전체 거래 이력 |
| 계정과목 (Account) | 디렉토리 | `tools/`, `scripts/`, `assets/` |
| 회계 인터페이스 | 크로스레포 동기화 | 명시적 스크립트/매니페스트 |
| 감사 추적 (Audit Trail) | Co-Authored-By | AI/Human 협업 기록 |

### 세로축: 제조 공정 (FAB 로직)

레포는 반도체 팹이다. 원자재(아이디어)가 들어와서 완제품(콘텐츠)이 나간다.

| 제조 개념 | 레포 대응 | 예시 |
|-----------|----------|------|
| BOM (자재 명세) | 의존성 + 에셋 목록 | `pubspec.yaml`, `package.json`, `assets/` |
| 라우팅 (공정 순서) | 파이프라인 스크립트 | 빌드→테스트→배포 순차 실행 |
| WIP (재공품) | 브랜치 + Queue | `claude/*` 브랜치, `_queue/` |
| 수율 (Yield) | 빌드 성공률 | CI 통과율, 테스트 커버리지 |
| MES (제조실행) | 자동화 스크립트 | 동기화, 추출, 배포 도구 |
| 검수 (QC) | 테스트 + 리뷰 | `tests/`, 체크리스트 |

### 4대 원칙

1. **삭제는 없다, 반대 분개만 있다** — `git revert`로 정정. `reset --hard` 금지.
2. **증빙 없는 거래는 없다** — 커밋 메시지에 이유와 맥락. 크로스레포 이동은 명시적 스크립트로.
3. **BOM 확인 후 착공한다** — 의존성/에셋 명세 먼저, 공정 순서 명시 후 실행.
4. **재공품을 방치하지 않는다** — WIP 브랜치와 큐는 정기적으로 소화한다.

### 교차점: JSON 매니페스트

가로축과 세로축이 만나는 곳에 JSON이 있다. 매니페스트는 공정 기록이자 거래 증빙이다.

```
app-meta.json      = 제품 사양서
state.json         = 공정 현황판
*.youtube.json     = 출하 전표
*-SOURCES.md       = 원자재 입고 대장
```

### Claude 자동 체크

| 트리거 | 체크 | 위반 시 |
|--------|------|---------|
| `git commit` 전 | 커밋 메시지에 이유/맥락 있는가 | "증빙 누락" 경고 |
| `reset --hard` 요청 | 반대 분개(revert) 가능한가 | 차단, revert 제안 |
| 새 파일/도구 추가 | BOM(package.json 등) 업데이트했는가 | "BOM 미갱신" 경고 |
| 세션 시작 | `git branch --no-merged main` WIP 확인 | 3개 이상이면 정리 권고 |
| 크로스레포 작업 | 동기화 스크립트/매니페스트 경유하는가 | "인터페이스 우회" 경고 |

> **코드를 짜는 게 아니라 공장을 돌리고 있다.**
> **다만 그 공장의 원장이 git이고, 라인이 파이프라인일 뿐이다.**

---


## 이 레포의 정체 (한 줄)

> 구독을 거부하는 생활형 도구 보관함. SaaS 아님. 기술 데모 아님.

---

## 절대 규칙

### 1. 버전은 올리지 않는다. 세트로 잠근다.

- 패키지 하나만 올리는 건 반쪽짜리 수리다
- wrapper / core / core-st → **동일 버전 세트**로 고정
- "최신이 호환성 좋겠지" = 오판. 최신 = 버전 지뢰
- **돌아가는 구버전 > 안 돌아가는 최신**
- 현재 잠금: FFmpeg WASM 전 패키지 `0.11.0` (2026-02-13 확정)

### 2. 기술 선택 기준은 하나뿐이다

> "이게 인샷보다 덜 귀찮은가?"

- 설정이 늘어나면 실패
- 설명이 길어지면 실패
- 오류 대응이 복잡하면 실패

### 3. 기능은 빼는 것이 가치다

- 기능 추가 제안 금지 (사용자가 명시적으로 요청할 때만)
- "이것도 넣으면 좋겠는데요" = 금지
- 최소 기능으로 목적 달성 = 이 레포의 설계 원칙

### 4. 수리 = 되돌리기

- 에러 수정 시 업그레이드가 아니라 **원래 작동하던 상태로 복원**
- 버전 올리기 전에 반드시: npm에서 세트 존재 여부 확인
- 한 패키지만 건드리지 마라. 의존성 그래프 전체를 봐라

### 5. 이 레포에서 쓰면 안 되는 것

| 금지 | 이유 |
|------|------|
| 빌드툴 (webpack, vite, rollup) | 유지보수 지옥 |
| npm install / node_modules | CDN script 태그면 충분 |
| 최신 FFmpeg (0.12.x) | API 호환성 파괴 |
| Service Worker (webapp) | type: "webapp" 도구에서 SW 금지 |
| SPA 프레임워크 | 정적 HTML + 단순 JS |
| TypeScript | 트랜스파일 = 빌드 의존성 |
| 로그인/계정/클라우드 | 이 도구의 존재 이유를 파괴 |

### 6. 성공 조건

- 내가 구독 하나 끊었는가? → 성공
- 한 달 뒤에도 다시 쓸 수 있는가? → 성공
- 3년 뒤에도 브라우저에서 그대로 돌아가는가? → 성공

---

## PWA 2-Track 정책

> apps.json의 `type` 필드로 도구를 2트랙으로 분류한다.

| type | 특성 | SW/Manifest |
|------|------|-------------|
| `pwa` | FFmpeg, 무거운 처리, 오프라인 필요, 주1회+ 사용 | sw.js + manifest.json 보유 |
| `webapp` | 가벼운 도구, 순수 HTML/JS | SW 없음, manifest 없음 |

### 승격 기준 (webapp → pwa)
1. FFmpeg 또는 무거운 WASM 사용
2. 오프라인 사용 필요
3. 주 1회 이상 정기 사용
4. 3개 조건 중 2개 이상 충족 시 승격

### PWA 도구 (현재 4개)
- lecture-shorts, lecture-long, auto-shorts, clip-shorts

---

## 현재 도구 목록 (9개)

| 카테고리 | 도구 | FFmpeg |
|---------|------|--------|
| 영상 | lecture-shorts, lecture-long, auto-shorts, clip-shorts | O |
| 오디오 | audio-studio | X |
| 이미지 | slim-lens, image-pack | X |
| 유틸 | bilingual-aligner, project-manager | X |

## FFmpeg WASM 버전 잠금 (2026-02-13 확정)

```
@ffmpeg/ffmpeg   = 0.11.0
@ffmpeg/core     = 0.11.0
@ffmpeg/core-st  = 0.11.0
```

- 3개 패키지 공통 존재 버전 = 0.11.0뿐
- core는 0.11.0만 존재 (0.11.1 없음)
- 이 세트를 깨지 마라

## 구조

- 각 도구 = 별도 디렉토리, 별도 index.html (SPA 아님)
- 공통 네비: `shared/js/nav.js`
- 버전 관리: `apps.json`
- 캐시버스터: 각 index.html의 `?v=` 쿼리 수동 관리
- 호스팅: GitHub Pages (서버 비용 0)

---

## Browser Execution Constitution v1.0 (2026-02-13 확정)

> Samsung Android + Windows Chromium. 이 밖은 존재하지 않는다.

### 전제 공리

1. 디바이스는 삼성 안드로이드만 고려한다
2. iOS는 존재하지 않는 것으로 간주한다
3. Safari는 고려 대상이 아니다
4. PC는 Windows + Chromium 계열만 고려한다
5. 배포 목적은 "내가 쓰기 위함"이다. 범용 SaaS가 아니다

### 브라우저 기준: Chromium Runtime Only

| 지원 | 엔진 |
|------|------|
| Android Chrome | Chromium |
| Samsung Internet | Chromium |
| Windows Chrome | Chromium |
| Windows Edge | Chromium |

엔진이 하나이므로 전략도 하나다.

### WASM 정책

- ffmpeg.wasm 싱글스레드 모드 기본
- SharedArrayBuffer / COOP·COEP 요구 기능 사용 안 함
- GitHub Pages 기본 헤더 제한 회피 + 삼성 모바일 안정성 확보

### 메모리 · 입력 제한 (도구별)

| 도구 | 모바일 입력 제한 | PC | 비고 |
|------|-----------------|-----|------|
| auto-shorts | 30초 × N개 | 제한 없음 | 짧은 클립 조합 |
| clip-shorts | 15초 × N개 | 제한 없음 | 짧은 클립 + BGM |
| lecture-shorts | 5분 | 제한 없음 | 쇼츠 변환 |
| lecture-long | PC 전용 | 20분 | 16분 입력 = 모바일 불가 |

- 모바일 메모리 상한: 150MB
- lecture-long은 PC Extended Mode 전용으로 설계

### 모드 설계

| 모드 | 대상 | 특성 |
|------|------|------|
| Mobile Safe (기본) | 삼성 Galaxy | 싱글스레드, 저용량, 빠른 컷 |
| PC Extended | Windows Chromium | 고해상도, 긴 렌더, 메모리 여유 |

분기 기준 = **디바이스 스펙** (RAM/화면). 브라우저 UA로 분기하지 않는다.

### CDN 정책

- WASM 바이너리(~25MB)는 레포에 넣지 않는다 (git clone 비대화 방지)
- CDN 듀얼 fallback 유지: unpkg → jsdelivr
- 버전 세트 잠금으로 CDN 서비스 중단 리스크 대응
- CDN 전부 죽으면 GitHub Releases에 백업본 올려서 전환

### 절대 금지

| 금지 | 이유 |
|------|------|
| Safari 대응 코드 | 타겟 밖 |
| iOS 조건문 | 타겟 밖 |
| `-webkit-` prefix 추가 | Chromium 표준이면 충분 |
| "Cross-browser compatibility" 언급 | 엔진이 하나인데 호환성이 무슨 의미 |
| 멀티엔진 대응 설계 | 죽은 코드 양산 |
| Firefox 전용 polyfill | 타겟 밖 |

### Claude Code 인스트럭션

```
Target: Samsung Android (Chromium-only).
Ignore iOS, Safari, non-Chromium completely.
ffmpeg.wasm single-thread mode.
No SharedArrayBuffer, no cross-origin isolation.
No multi-browser compatibility layer.
```

---

## 철학 (한 줄)

> 이 프로젝트는 최신 기술을 쓰지 않기 위해 기술을 쓰는 프로젝트다.
> Samsung-First Personal Media Engine. SaaS가 아니다.