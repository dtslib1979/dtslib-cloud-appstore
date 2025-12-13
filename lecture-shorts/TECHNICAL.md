# Lecture Shorts Factory v2.2.0 기술 백서

---

## 📋 Executive Summary

| 항목 | 값 |
|------|-----|
| **앱 URL** | https://dtslib-cleanup-temp.vercel.app/lecture-shorts/ |
| **GitHub Repo** | dtslib1979/dtslib-cloud-appstore |
| **호스팅** | Vercel (Hobby Plan - 무료) |
| **아키텍처** | Dual-Engine (WebCodecs + FFmpeg.wasm) |
| **과금** | **$0/월** |

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CLIENT BROWSER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                v2.2.0 BACKGROUND PROTECTION                   │  │
│  │  • Wake Lock API (화면 꺼짐 방지)                            │  │
│  │  • Silent Audio (브라우저 throttling 회피)                   │  │
│  │  • Page Visibility (백그라운드 감지)                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    ENGINE SELECTOR                            │  │
│  │     supportsWebCodecs() ? WebCodecs : FFmpeg.wasm            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│              ┌───────────────┴───────────────┐                      │
│              ▼                               ▼                       │
│  ┌────────────────────────┐    ┌────────────────────────┐          │
│  │   🚀 WebCodecs Path    │    │   ⚙️ FFmpeg Path       │          │
│  │   (Chrome/Edge)        │    │   (Safari/Firefox)     │          │
│  ├────────────────────────┤    ├────────────────────────┤          │
│  │ • Canvas Frame Extract │    │ • FFmpeg.wasm          │          │
│  │ • VideoEncoder (HW)    │    │ • Software Encoding    │          │
│  │ • mp4-muxer            │    │ • libx264              │          │
│  │ • ~1-3분 처리          │    │ • ~30분+ 처리          │          │
│  └────────────────────────┘    └────────────────────────┘          │
│              │                               │                       │
│              └───────────────┬───────────────┘                      │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    BGM Mixing (FFmpeg)                        │  │
│  │         WebCodecs 출력 + BGM → FFmpeg로 오디오 믹싱           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    OUTPUT: MP4 Blob                           │  │
│  │              720×1280 (9:16) | 30fps | 3분                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ v2.2.0 백그라운드 보호 시스템

### 문제점: 모바일 브라우저 백그라운드 Throttling

| 상황 | Chrome/삼성 인터넷 동작 |
|------|------------------------|
| 탭 백그라운드 진입 | JavaScript 타이머 1초당 1회로 제한 |
| 5분 이상 백그라운드 | 1분당 1회로 추가 제한 |
| 화면 꺼짐 | 모든 처리 중단 가능 |

### 해결책: 3중 보호 레이어

```javascript
// 1. Wake Lock API - 화면 꺼짐 방지
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
    }
}

// 2. Silent Audio - 브라우저가 "재생 중"으로 인식
function startSilentAudio() {
    audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    gain.gain.value = 0.001;  // 거의 무음
    oscillator.frequency.value = 1;  // 들리지 않는 주파수
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
}

// 3. Page Visibility - 백그라운드 경고
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isProcessing) {
        showBackgroundWarning(true);  // 빨간 경고 바 표시
    }
});
```

### API 호환성

| API | Chrome | Safari | Firefox | Edge |
|-----|--------|--------|---------|------|
| **Wake Lock** | ✅ 84+ | ❌ | ❌ | ✅ 84+ |
| **AudioContext** | ✅ | ✅ | ✅ | ✅ |
| **Page Visibility** | ✅ | ✅ | ✅ | ✅ |

---

## 📁 파일 구조

```
lecture-shorts/
├── index.html      # 6.3KB  - 메인 UI + 백그라운드 팁
├── app.js          # 22.5KB - 듀얼 엔진 + 보호 로직
├── style.css       # 7.5KB  - 스타일링 (팁 박스 포함)
├── manifest.json   # 1.4KB  - PWA 매니페스트
├── sw.js           # 2.5KB  - Service Worker
├── TECHNICAL.md    # 기술 백서
└── icons/          # PWA 아이콘
─────────────────────────────────────────
Total:              ~40KB (gzip ~14KB)
```

---

## 🔧 핵심 기술 스택

### 1. WebCodecs 엔진 (Primary)

| 컴포넌트 | 역할 |
|----------|------|
| **VideoEncoder** | 하드웨어 가속 H.264 인코딩 |
| **VideoFrame** | Canvas → 비디오 프레임 변환 |
| **mp4-muxer** | MP4 컨테이너 생성 |

```javascript
// 하드웨어 가속 설정
encoder.configure({
    codec: 'avc1.42001f',
    width: 720,
    height: 1280,
    bitrate: 2_500_000,
    framerate: 30,
    hardwareAcceleration: 'prefer-hardware'
});
```

### 2. FFmpeg 엔진 (Fallback)

| 컴포넌트 | 버전 | 역할 |
|----------|------|------|
| **FFmpeg.wasm** | 0.11.6 | WebAssembly 인코더 |
| **@ffmpeg/core** | 0.11.0 | FFmpeg 코어 바이너리 |

### 3. 처리 파이프라인

```
[인트로 영상] ─┐
              ├─→ [프레임 추출] → [속도 조절] → [크롭] → [인코딩] → [MP4]
[강의 영상] ──┘                                                    │
                                                                    │
[BGM (선택)] ─────────────────────────────────→ [FFmpeg 믹싱] ←────┘
                                                       │
                                                       ▼
                                              [최종 출력 MP4]
```

---

## 📊 성능 비교

| 항목 | WebCodecs (v2.2) | FFmpeg.wasm (v1.4) | 향상 |
|------|------------------|-------------------|------|
| **4분 영상 처리** | ~1-3분 | ~30분+ | **10-30x** |
| **CPU 사용률** | 20-40% | 100% | GPU 오프로드 |
| **메모리 사용** | ~200MB | ~500MB | 효율적 |
| **브라우저 반응** | 정상 | 멈춤 현상 | 개선 |
| **백그라운드 안정성** | ⚠️ 보호 필요 | ⚠️ 동일 | Wake Lock 추가 |

### 브라우저 지원

| 브라우저 | WebCodecs | FFmpeg Fallback | Wake Lock |
|----------|-----------|-----------------|-----------|
| Chrome 94+ | ✅ HW 가속 | - | ✅ |
| Edge 94+ | ✅ HW 가속 | - | ✅ |
| Safari | ❌ | ✅ 폴백 | ❌ |
| Firefox | ❌ | ✅ 폴백 | ❌ |
| 삼성 인터넷 | ✅ | - | ✅ |

---

## 🎬 출력 스펙

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| Resolution | 720×1280 | 9:16 세로 (쇼츠) |
| Frame Rate | 30fps | 부드러운 재생 |
| Video Codec | H.264 | 최대 호환성 |
| Bitrate | 2.5Mbps | 고품질 |
| Audio Codec | AAC | 범용 포맷 |
| Audio Bitrate | 128kbps | 명확한 음성 |
| Duration | 3분 (180초) | 쇼츠 최적 |

---

## 🔄 v2.2.0 주요 개선

### 1. Wake Lock API
```javascript
// 인코딩 시작 시
await navigator.wakeLock.request('screen');

// 인코딩 완료 시
wakeLock.release();
```

### 2. Silent Audio Ping
```javascript
// 브라우저가 "오디오 재생 중"으로 인식하면 throttling 회피
const ctx = new AudioContext();
const osc = ctx.createOscillator();
osc.frequency.value = 1;  // 1Hz - 들리지 않음
osc.connect(gainNode);  // gain.value = 0.001
osc.start();
```

### 3. Page Visibility 감지
```javascript
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isProcessing) {
        // 빨간 경고 바: "⚠️ 화면을 유지하세요!"
        showBackgroundWarning(true);
    }
});
```

### 4. 더 빈번한 UI 업데이트
```javascript
// v2.1: 5프레임마다 yield
if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));

// v2.2: 3프레임마다 yield (UI 반응성 + 백그라운드 감지)
if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
```

---

## 💰 비용 분석

### 현재 플랜: Hobby (무료)

| 리소스 | 포함량 | 현재 사용량 | 과금 |
|--------|--------|-------------|------|
| **Bandwidth** | 100GB/월 | ~0GB | $0 |
| **Build Minutes** | 무제한 | ~2분/배포 | $0 |
| **Static Files** | 1GB | ~40KB | $0 |

### 왜 $0인가?

```
┌─────────────────────────────────────────────────────────────┐
│                    COST STRUCTURE                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  비디오 처리         : 클라이언트 브라우저 (GPU 가속)        │
│  FFmpeg Core 로딩    : unpkg.com CDN (무료)                  │
│  mp4-muxer 로딩      : jsdelivr.net CDN (무료)              │
│  영상 업로드/다운로드: 서버 거치지 않음 (Blob URL)          │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  MONTHLY COST:  $0.00                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 보안 고려사항

### 1. 클라이언트 사이드 처리
- 영상이 서버에 업로드되지 않음
- 개인 콘텐츠 보호
- GDPR 준수

### 2. 필수 HTTP 헤더
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```
→ SharedArrayBuffer 활성화 (FFmpeg.wasm 필수)

---

## 📱 PWA 기능

### Service Worker 캐싱 전략

| 리소스 | 전략 | 이유 |
|--------|------|------|
| 앱 파일 | Network First | 최신 버전 보장 |
| CDN 라이브러리 | Cache First | 대용량, 변경 적음 |

### 오프라인 지원

| 기능 | 오프라인 | 이유 |
|------|---------|------|
| UI 로딩 | ✅ | SW 캐시 |
| 영상 처리 | ⚠️ 부분 | FFmpeg CDN 의존 |
| 파일 다운로드 | ✅ | Blob URL |

---

## 📋 사용 가이드 (v2.2.0)

### ✅ 권장 사용법

```
1. Chrome 브라우저 사용 (삼성 인터넷보다 안정적)
2. 화면 켜둔 채로 대기
3. 충전기 연결 (배터리 절약 모드 방지)
4. 인코딩 완료까지 탭 유지
```

### ❌ 피해야 할 것

```
1. 인코딩 중 다른 앱 전환
2. 인코딩 중 화면 끄기
3. 인코딩 중 브라우저 탭 변경
```

---

## 🚀 향후 개선 계획

### v2.3 예정
- [ ] Web Worker 마이그레이션 (메인 스레드 분리)
- [ ] 진행률 LocalStorage 저장 (중단 시 재개)
- [ ] 인트로 오디오 보존 옵션

### v3.0 검토
- [ ] Web Audio API 기반 BGM 믹싱 (FFmpeg 의존 제거)
- [ ] 오프라인 완전 지원 (FFmpeg Core 로컬 캐싱)
- [ ] WebGPU 기반 효과 필터

---

## 📝 버전 히스토리

| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| v1.0.0 | 2025-12-12 | FFmpeg.wasm 기반 초기 버전 |
| v1.4.0 | 2025-12-12 | 480p + CRF32 최적화 |
| v2.0.0 | 2025-12-13 | WebCodecs 엔진 도입 |
| v2.1.0 | 2025-12-13 | 스트리밍 인코딩 + BGM 개선 |
| **v2.2.0** | **2025-12-13** | **Wake Lock + Silent Audio 백그라운드 보호** |

---

*Generated: 2025-12-13*
*Version: 2.2.0*
