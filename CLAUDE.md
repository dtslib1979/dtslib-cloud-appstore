# dtslib-cloud-appstore — Claude Code 행동 규칙

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
| Service Worker | 광역 룰 위반 |
| SPA 프레임워크 | 정적 HTML + 단순 JS |
| TypeScript | 트랜스파일 = 빌드 의존성 |
| 로그인/계정/클라우드 | 이 도구의 존재 이유를 파괴 |

### 6. 성공 조건

- 내가 구독 하나 끊었는가? → 성공
- 한 달 뒤에도 다시 쓸 수 있는가? → 성공
- 3년 뒤에도 브라우저에서 그대로 돌아가는가? → 성공

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
