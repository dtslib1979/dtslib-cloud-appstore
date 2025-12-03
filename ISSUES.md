# 현재 이슈 및 해결 방안 (Current Issues & Solutions)

**작성일**: 2025-12-03  
**우선순위**: 🔴 높음 / 🟡 중간 / 🟢 낮음

---

## 📋 요약 (Summary)

총 이슈: **11개**
- 🔴 중요 이슈: 3개 (즉시 수정 권장)
- 🟡 개선 권장: 5개 (단기 개선)
- 🟢 향후 계획: 3개 (장기 개선)

---

## 🔴 중요 이슈 (Critical Issues)

### 1. Service Worker 스코프 불일치

**문제점**:
```json
// shorts-maker/manifest.json (잘못된 설정)
{
  "start_url": "/dtslib-cloud-appstore/shorts-maker/",  // 절대 경로
  "scope": "/dtslib-cloud-appstore/shorts-maker/"
}

// auto-shorts-maker/manifest.json (올바른 설정)
{
  "start_url": "./",  // 상대 경로
  "scope": "./"
}
```

**영향**:
- PWA 설치 시 경로 오류 발생 가능
- Service Worker 등록 실패 가능성
- 오프라인 모드 작동 불안정

**해결 방법**:
```bash
# shorts-maker/manifest.json 파일 수정
```

```json
{
  "name": "Auto Shorts Maker",
  "short_name": "Shorts",
  "start_url": "./",           // ← 수정
  "scope": "./",                // ← 수정
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#764ba2",
  "description": "6초 영상을 2분 쇼츠로 자동 변환",
  "icons": [...]
}
```

**테스트 방법**:
1. 브라우저 개발자 도구 → Application → Manifest 확인
2. Service Worker 등록 상태 확인
3. 모바일에서 "홈 화면에 추가" 테스트

---

### 2. FFmpeg.wasm CDN 불일치

**문제점**:
```javascript
// shorts-maker/index.html
<script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js"></script>

// auto-shorts-maker/index.html
<script src="https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js"></script>

// auto-shorts-maker/app.js
corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
```

**영향**:
- 하나의 CDN 장애 시 일부 앱만 영향받음
- 브라우저 캐싱 효율성 저하 (다른 URL)
- 버전 관리 복잡도 증가

**해결 방법**:

**옵션 1: unpkg.com으로 통일 (권장)**
```javascript
// shorts-maker/index.html 수정
<script src="https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js"></script>
```

**옵션 2: cdn.jsdelivr.net으로 통일**
```javascript
// auto-shorts-maker/index.html 수정
<script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js"></script>

// auto-shorts-maker/app.js 수정
corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
```

**테스트 방법**:
1. 네트워크 탭에서 FFmpeg 로드 확인
2. 두 앱 모두 정상 작동 확인
3. 오프라인 모드에서 테스트 (Service Worker 캐싱 확인)

---

### 3. Service Worker 캐싱 전략 차이

**문제점**:

**shorts-maker/service-worker.js** (기본):
```javascript
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
```

**auto-shorts-maker/service-worker.js** (개선):
```javascript
self.addEventListener('fetch', event => {
  // CDN 리소스 제외
  const url = new URL(event.request.url);
  const isCDN = url.hostname === 'unpkg.com' || 
                url.hostname === 'cdn.jsdelivr.net' ||
                url.pathname.includes('ffmpeg');
  
  if (isCDN) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // 캐싱 전략 + 에러 처리
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          // 유효성 검사
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // 동적 캐싱
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        });
      })
      .catch(() => {
        console.log('[Service Worker] Fetch failed; returning offline page instead.');
      })
  );
});
```

**영향**:
- shorts-maker는 CDN 리소스도 캐싱 시도 (불필요)
- 에러 처리 부족
- 일관성 없는 사용자 경험

**해결 방법**:
```bash
# auto-shorts-maker의 개선된 Service Worker를 shorts-maker에 복사
cp auto-shorts-maker/service-worker.js shorts-maker/service-worker.js

# 단, CACHE_NAME 수정 필요
# 'auto-shorts-maker-v1.1' → 'shorts-maker-v2'
```

**테스트 방법**:
1. Application → Service Worker에서 업데이트 확인
2. 네트워크 차단 후 오프라인 모드 테스트
3. CDN 리소스가 캐싱되지 않는지 확인

---

## 🟡 개선 권장사항 (Recommended Improvements)

### 4. 에러 처리 UI 부족 (shorts-maker)

**문제점**:
- auto-shorts-maker에는 에러 섹션 존재
- shorts-maker에는 에러 UI 없음
- 사용자에게 오류 정보 전달 불가

**해결 방법**:

**shorts-maker/index.html에 추가** (line 40 이후):
```html
<!-- Error Section -->
<div class="error-section" id="error-section" style="display: none;">
    <p class="error-text" id="error-text"></p>
</div>
```

**shorts-maker/style.css에 추가**:
```css
.error-section {
    background: rgba(255, 59, 48, 0.1);
    border: 1px solid #ff3b30;
    border-radius: 10px;
    padding: 20px;
    margin: 20px 0;
}

.error-text {
    color: #ff3b30;
    text-align: center;
    font-size: 14px;
}
```

**shorts-maker/script.js에 추가**:
```javascript
function showError(message) {
    const errorSection = document.getElementById('error-section');
    const errorText = document.getElementById('error-text');
    errorText.textContent = '❌ ' + message;
    errorSection.style.display = 'block';
}

// 사용 예시
try {
    // ... 비디오 처리
} catch (error) {
    showError('Processing failed: ' + error.message);
}
```

---

### 5. 진행률 표시 개선

**문제점**:
- 현재는 단순 텍스트만 표시
- FFmpeg의 실제 진행률과 동기화 안 됨
- 사용자는 정확한 진행 상황을 알 수 없음

**해결 방법**:

**FFmpeg progress 이벤트 활용**:
```javascript
// auto-shorts-maker/app.js와 shorts-maker/script.js에 적용

ffmpeg.setProgress(({ ratio }) => {
    // ratio는 0~1 사이 값
    const percent = Math.round(ratio * 100);
    updateProgress(percent, `Processing: ${percent}%`);
});

// FFmpeg 실행
await ffmpeg.run(
    '-i', 'input.mp4',
    // ... 기타 옵션
    'output.mp4'
);
```

**더 상세한 단계별 진행률**:
```javascript
// 전체 프로세스를 단계로 나누기
const STEPS = {
    LOAD_FFMPEG: { weight: 10, label: 'Loading FFmpeg...' },
    LOAD_FILES: { weight: 10, label: 'Loading files...' },
    PROCESS_VIDEO: { weight: 70, label: 'Processing video...' },
    SAVE_OUTPUT: { weight: 10, label: 'Saving output...' }
};

let currentProgress = 0;

function updateStepProgress(step, stepProgress) {
    const baseProgress = Object.keys(STEPS)
        .slice(0, Object.keys(STEPS).indexOf(step))
        .reduce((sum, key) => sum + STEPS[key].weight, 0);
    
    const progress = baseProgress + (STEPS[step].weight * stepProgress);
    updateProgress(progress, STEPS[step].label);
}

// 사용
updateStepProgress('LOAD_FFMPEG', 0.5);  // FFmpeg 로딩 50%
updateStepProgress('PROCESS_VIDEO', 0.3); // 비디오 처리 30%
```

---

### 6. 파일 크기 제한 없음

**문제점**:
- 대용량 파일 업로드 시 브라우저 메모리 부족
- 모바일 기기에서 크래시 가능성
- 사용자 경험 저하

**해결 방법**:

**파일 크기 검증 추가**:
```javascript
// app.js와 script.js의 파일 업로드 핸들러에 추가

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB

videoInput.addEventListener('change', (e) => {
    videoFile = e.target.files[0];
    
    if (videoFile) {
        // 파일 크기 검증
        if (videoFile.size > MAX_VIDEO_SIZE) {
            showError(`Video file too large. Maximum size: 500MB`);
            videoFile = null;
            videoInput.value = '';
            return;
        }
        
        videoStatus.textContent = '✓ ' + videoFile.name;
        e.target.parentElement.classList.add('active');
        checkReady();
    }
});

audioInput.addEventListener('change', (e) => {
    audioFile = e.target.files[0];
    
    if (audioFile) {
        // 파일 크기 검증
        if (audioFile.size > MAX_AUDIO_SIZE) {
            showError(`Audio file too large. Maximum size: 100MB`);
            audioFile = null;
            audioInput.value = '';
            return;
        }
        
        audioStatus.textContent = '✓ ' + audioFile.name;
        e.target.parentElement.classList.add('active');
        checkReady();
    }
});
```

**사용자에게 안내 추가**:
```html
<!-- index.html에 추가 -->
<p class="file-limit-info">
    📌 Max file size: Video 500MB, Audio 100MB
</p>
```

---

### 7. 브라우저 호환성 검사 없음

**문제점**:
- WebAssembly 미지원 브라우저에서 오류 발생
- 구형 브라우저 사용자에게 적절한 안내 없음

**해결 방법**:

**앱 초기화 시 호환성 검사**:
```javascript
// app.js와 script.js 최상단에 추가

function checkBrowserCompatibility() {
    const issues = [];
    
    // WebAssembly 지원 확인
    if (!window.WebAssembly) {
        issues.push('WebAssembly not supported');
    }
    
    // File API 지원 확인
    if (!window.File || !window.FileReader) {
        issues.push('File API not supported');
    }
    
    // Service Worker 지원 확인 (선택사항)
    if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker not supported - offline mode unavailable');
    }
    
    if (issues.length > 0) {
        const message = `Your browser is not supported:\n${issues.join('\n')}`;
        alert(message);
        
        // UI 비활성화
        document.querySelector('.container').innerHTML = `
            <h1>❌ Browser Not Supported</h1>
            <p>Please use a modern browser like Chrome, Firefox, Safari, or Edge.</p>
            <p>Requirements:</p>
            <ul>
                <li>WebAssembly support</li>
                <li>File API support</li>
                <li>Modern JavaScript (ES6+)</li>
            </ul>
        `;
        
        return false;
    }
    
    return true;
}

// 앱 시작 전 검사
if (!checkBrowserCompatibility()) {
    throw new Error('Browser compatibility check failed');
}
```

---

### 8. 모바일 메모리 최적화 부족

**문제점**:
- 처리 완료 후 메모리 정리 불명확
- FFmpeg 가상 파일시스템에 파일 잔류
- 반복 사용 시 메모리 누수 가능

**해결 방법**:

**명시적 메모리 정리**:
```javascript
// 비디오 처리 완료 후 cleanup 함수 추가

async function cleanup() {
    try {
        // FFmpeg 가상 파일시스템의 모든 파일 삭제
        const files = ffmpeg.FS('readdir', '/');
        
        for (const file of files) {
            // 특수 디렉토리 제외
            if (file !== '.' && file !== '..') {
                try {
                    ffmpeg.FS('unlink', file);
                } catch (e) {
                    console.warn(`Failed to delete ${file}:`, e);
                }
            }
        }
        
        console.log('Cleanup completed');
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// 처리 함수에서 사용
async function processVideo() {
    try {
        // ... 비디오 처리 로직
        
    } catch (error) {
        showError(error.message);
    } finally {
        // 항상 cleanup 실행
        await cleanup();
    }
}
```

**메모리 모니터링 추가** (개발 모드):
```javascript
function logMemoryUsage() {
    if (performance.memory) {
        const used = Math.round(performance.memory.usedJSHeapSize / 1048576);
        const total = Math.round(performance.memory.totalJSHeapSize / 1048576);
        console.log(`Memory: ${used}MB / ${total}MB`);
    }
}

// 처리 전후 메모리 확인
logMemoryUsage(); // 처리 전
await processVideo();
logMemoryUsage(); // 처리 후
```

---

## 🟢 향후 개선 계획 (Future Improvements)

### 9. 테스트 인프라 구축

**제안**:

**단위 테스트 (Jest/Vitest)**:
```javascript
// tests/video-processor.test.js
import { describe, it, expect } from 'vitest';
import { calculateLoops } from '../auto-shorts-maker/app.js';

describe('Video Processing', () => {
    it('should calculate correct loop count for 6s video', () => {
        expect(calculateLoops(6)).toBe(20);
    });
    
    it('should calculate correct loop count for 10s video', () => {
        expect(calculateLoops(10)).toBe(12);
    });
});
```

**E2E 테스트 (Playwright)**:
```javascript
// tests/e2e/app.spec.js
import { test, expect } from '@playwright/test';

test('should load app successfully', async ({ page }) => {
    await page.goto('http://localhost:8000/auto-shorts-maker/');
    await expect(page.locator('h1')).toContainText('Auto Shorts Maker');
});

test('should enable button when files uploaded', async ({ page }) => {
    await page.goto('http://localhost:8000/auto-shorts-maker/');
    
    // 파일 업로드 시뮬레이션
    const videoInput = page.locator('#video-input');
    const audioInput = page.locator('#audio-input');
    
    await videoInput.setInputFiles('test-fixtures/sample-6s.mp4');
    await audioInput.setInputFiles('test-fixtures/sample-audio.mp3');
    
    // 버튼 활성화 확인
    const button = page.locator('#process-btn');
    await expect(button).toBeEnabled();
});
```

**GitHub Actions 통합**:
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run unit tests
        run: npm test
      
      - name: Run E2E tests
        run: npm run test:e2e
```

---

### 10. 모니터링 및 에러 추적

**제안**:

**Sentry 통합** (에러 추적):
```javascript
// 앱 초기화 시
import * as Sentry from "@sentry/browser";

Sentry.init({
    dsn: "YOUR_SENTRY_DSN",
    environment: "production",
    release: "auto-shorts-maker@1.1.0"
});

// 에러 캡처
try {
    await processVideo();
} catch (error) {
    Sentry.captureException(error);
    showError(error.message);
}
```

**Google Analytics** (사용자 분석):
```html
<!-- index.html에 추가 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

**커스텀 이벤트 추적**:
```javascript
// 주요 액션 추적
gtag('event', 'video_upload', {
    'event_category': 'engagement',
    'event_label': 'video_size_mb',
    'value': Math.round(videoFile.size / 1048576)
});

gtag('event', 'processing_complete', {
    'event_category': 'conversion',
    'event_label': 'duration_seconds',
    'value': processingTime
});

gtag('event', 'error', {
    'event_category': 'error',
    'event_label': error.message
});
```

---

### 11. 성능 최적화

**제안**:

**1. FFmpeg.wasm Lazy Loading**:
```javascript
// 사용자가 처리 버튼을 클릭할 때만 로드
let ffmpegLoaded = false;

document.getElementById('process-btn').addEventListener('click', async () => {
    if (!ffmpegLoaded) {
        updateProgress(10, 'Loading FFmpeg...');
        
        // 동적 import
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => script.onload = resolve);
        ffmpegLoaded = true;
    }
    
    await processVideo();
});
```

**2. Code Splitting**:
```javascript
// 기능별 모듈 분리
// modules/file-handler.js
export function handleVideoUpload(file) { ... }

// modules/ffmpeg-processor.js
export async function processWithFFmpeg(video, audio) { ... }

// app.js
import { handleVideoUpload } from './modules/file-handler.js';
import { processWithFFmpeg } from './modules/ffmpeg-processor.js';
```

**3. 이미지 최적화**:
```html
<!-- 아이콘을 SVG로 최적화 -->
<svg class="app-icon">
    <use href="#icon-video"></use>
</svg>

<!-- SVG 스프라이트 -->
<svg style="display: none;">
    <symbol id="icon-video" viewBox="0 0 24 24">
        <path d="M..."/>
    </symbol>
</svg>
```

**4. Lighthouse 점수 개선**:
```json
// 목표 점수
{
    "Performance": 90+,
    "Accessibility": 100,
    "Best Practices": 95+,
    "SEO": 100,
    "PWA": 100
}
```

**개선 항목**:
- ✅ HTTPS 사용 (GitHub Pages)
- ✅ Service Worker 등록
- ⚠️ 이미지 최적화 필요
- ⚠️ 폰트 최적화 필요
- ⚠️ JavaScript 번들 크기 축소

---

## 📊 우선순위 로드맵 (Priority Roadmap)

### Phase 1: 즉시 수정 (1-2일)
- [x] ARCHITECTURE.md 문서 작성
- [x] ISSUES.md 문서 작성
- [ ] Issue #1: Service Worker 스코프 수정
- [ ] Issue #2: FFmpeg CDN 통일
- [ ] Issue #3: Service Worker 캐싱 전략 통일

### Phase 2: 단기 개선 (1주일)
- [ ] Issue #4: shorts-maker에 에러 UI 추가
- [ ] Issue #5: 진행률 표시 개선
- [ ] Issue #6: 파일 크기 제한 추가
- [ ] Issue #7: 브라우저 호환성 검사
- [ ] Issue #8: 메모리 최적화

### Phase 3: 중기 개선 (2-4주)
- [ ] Issue #9: 테스트 인프라 구축
- [ ] Issue #10: 모니터링 시스템 구축
- [ ] Issue #11: 성능 최적화

---

## 🔧 수정 체크리스트 (Fix Checklist)

각 이슈 수정 후 아래 체크리스트를 확인하세요:

- [ ] 코드 변경 완료
- [ ] 로컬에서 테스트 완료
- [ ] 모바일에서 테스트 완료 (가능한 경우)
- [ ] README.md 업데이트 (필요한 경우)
- [ ] ARCHITECTURE.md 업데이트 (필요한 경우)
- [ ] Commit 메시지 작성 (예: "Fix: Service Worker scope issue #1")
- [ ] main 브랜치에 Push
- [ ] GitHub Pages 배포 확인
- [ ] 실제 배포 환경에서 테스트

---

**문서 버전**: 1.0  
**최종 업데이트**: 2025-12-03  
**다음 리뷰 예정일**: 2025-12-10  
