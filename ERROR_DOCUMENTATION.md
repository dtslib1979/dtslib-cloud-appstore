# 에러 및 트러블슈팅 가이드

## DTS Cloud AppStore - Error Documentation

이 문서는 개발 과정에서 발생한 모든 에러와 해결 방법을 상세히 기록합니다.

---

## 목차

1. [SharedArrayBuffer 관련 에러](#1-sharedarraybuffer-관련-에러)
2. [메모리 관련 에러](#2-메모리-관련-에러)
3. [FFmpeg.wasm 로딩 에러](#3-ffmpegwasm-로딩-에러)
4. [CORS 에러](#4-cors-에러)
5. [Service Worker 에러](#5-service-worker-에러)
6. [파일 처리 에러](#6-파일-처리-에러)
7. [브라우저 호환성 에러](#7-브라우저-호환성-에러)

---

## 1. SharedArrayBuffer 관련 에러

### 1.1 에러: SharedArrayBuffer is not defined

#### 증상
```
Uncaught ReferenceError: SharedArrayBuffer is not defined
```

#### 발생 위치
- Shorts Maker v1
- Auto Shorts v1.1 (초기 버전)

#### 원인
브라우저 보안 정책으로 인해 SharedArrayBuffer 사용이 제한됩니다. 다음 HTTP 헤더가 필요합니다:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

GitHub Pages는 커스텀 HTTP 헤더 설정을 지원하지 않습니다.

#### 해결방법

**방법 1: 싱글스레드 FFmpeg 사용** (✅ 적용됨)
```javascript
// Auto Shorts v1.1
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});
```

**방법 2: 최신 FFmpeg.wasm 사용** (✅ v3에 적용)
```javascript
// Auto Shorts v3
const { FFmpeg } = FFmpegWASM;
await ffmpeg.load({
    coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
});
```

**방법 3: 서버 헤더 설정** (❌ GitHub Pages에서 불가능)
- Netlify, Vercel 등 다른 호스팅 서비스 사용 시 가능

#### 상태
✅ **해결됨** - v1.1과 v3에서 SAB 없이 동작

---

## 2. 메모리 관련 에러

### 2.1 에러: Out of Memory

#### 증상
```
Uncaught Error: Aborted(OOM)
```
또는 브라우저 탭 크래시

#### 발생 조건
- 대용량 영상 파일 처리 (>100MB)
- 모바일 브라우저
- 4K 영상 처리

#### 원인
- 브라우저 메모리 제한 (특히 모바일)
- FFmpeg 처리 중 메모리 누적
- 고해상도 영상의 높은 메모리 요구량

#### 해결방법

**방법 1: 다운스케일 옵션** (✅ 적용됨)
```javascript
// Auto Shorts v3 - 720p 다운스케일
const scaleFilter = downscaleOption.checked 
    ? `,scale=-2:${MAX_HEIGHT}` 
    : '';

const args = [
    // ...
    '-vf', `setpts=5.0*PTS${scaleFilter}`,
    // ...
];
```

**방법 2: 메모리 정리** (✅ 적용됨)
```javascript
// Blob URL 정리
setTimeout(() => {
    URL.revokeObjectURL(url);
}, 300000); // 5분 후
```

**방법 3: 빠른 프리셋 사용** (✅ 적용됨)
```javascript
'-preset', 'veryfast',  // 메모리 사용량 감소
```

**방법 4: 파일 크기 제한** (⚠️ 미구현)
```javascript
// 권장: 파일 크기 체크
if (videoFile.size > 100 * 1024 * 1024) { // 100MB
    alert('파일이 너무 큽니다. 100MB 이하로 업로드해주세요.');
    return;
}
```

#### 사용자 안내
- 720p 다운스케일 옵션 기본 활성화
- 파일 크기 50MB 이하 권장
- 모바일에서는 더 작은 파일 권장 (20MB 이하)

#### 상태
✅ **완화됨** - 다운스케일 및 빠른 프리셋으로 개선

---

## 3. FFmpeg.wasm 로딩 에러

### 3.1 에러: Failed to load FFmpeg

#### 증상
```
Error: Failed to load FFmpeg: [에러 상세]
```

#### 발생 원인
1. CDN 접속 불가 (네트워크 문제)
2. CORS 정책 위반
3. 브라우저 호환성 문제
4. 잘못된 버전 URL

#### 해결방법

**방법 1: 에러 처리** (✅ 적용됨)
```javascript
try {
    await ffmpeg.load({
        coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
    });
    updateProgress(20, 'FFmpeg loaded successfully');
    return true;
} catch (error) {
    console.error('FFmpeg load error:', error);
    showError('Failed to load FFmpeg: ' + error.message);
    return false;
}
```

**방법 2: 사용자 안내**
- 인터넷 연결 확인 요청
- 브라우저 업데이트 권장
- 다른 브라우저 시도 제안

#### 체크리스트
- [ ] 인터넷 연결 상태
- [ ] 브라우저 버전 (최신 권장)
- [ ] WASM 지원 확인
- [ ] 콘솔 에러 메시지 확인

#### 상태
✅ **처리됨** - 에러 처리 및 사용자 안내 구현

---

## 4. CORS 에러

### 4.1 에러: CORS policy violation

#### 증상
```
Access to fetch at 'https://cdn.jsdelivr.net/...' from origin 'https://dtslib1979.github.io' 
has been blocked by CORS policy
```

#### 발생 위치
- CDN 리소스 로드 시
- Service Worker 캐싱 중

#### 원인
- CDN의 CORS 정책
- Service Worker의 캐시 전략

#### 해결방법

**방법 1: 네트워크 우선 전략** (✅ 적용됨)
```javascript
// service-worker.js
self.addEventListener('fetch', (event) => {
    // CDN 요청은 항상 네트워크에서
    if (event.request.url.includes('cdn.jsdelivr.net')) {
        return fetch(event.request);
    }
    
    // 나머지는 캐시 우선
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
```

**방법 2: CORS 모드 명시**
```javascript
fetch(url, { mode: 'cors' })
```

#### 상태
✅ **해결됨** - Service Worker 전략 수정

---

## 5. Service Worker 에러

### 5.1 에러: Service Worker registration failed

#### 증상
```
ServiceWorker registration failed: [에러 상세]
```

#### 발생 원인
1. HTTPS가 아닌 환경 (localhost 제외)
2. Service Worker 파일 경로 오류
3. 브라우저 지원 부족

#### 해결방법

**방법 1: 조건부 등록** (✅ 적용됨)
```javascript
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => console.log('SW registered'))
        .catch(err => console.log('SW error:', err));
}
```

**방법 2: HTTPS 확인**
- GitHub Pages는 자동으로 HTTPS 제공
- 로컬 개발: localhost 사용

#### 상태
✅ **해결됨** - 조건부 등록 및 에러 처리

### 5.2 에러: Service Worker update 실패

#### 증상
캐시가 업데이트되지 않음

#### 해결방법

**캐시 버전 관리** (✅ 적용됨)
```javascript
const CACHE_NAME = 'auto-shorts-v3-cache-v1';

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
});
```

**수동 캐시 클리어**:
1. 개발자 도구 → Application → Storage
2. "Clear site data" 클릭

#### 상태
✅ **해결됨** - 버전 관리 시스템 구현

---

## 6. 파일 처리 에러

### 6.1 에러: Failed to load video metadata

#### 증상
```
Error: Failed to load video metadata
```

#### 발생 원인
- 지원하지 않는 비디오 코덱
- 손상된 비디오 파일
- 비정상적인 파일 형식

#### 해결방법

**방법 1: 에러 처리** (✅ 적용됨)
```javascript
async function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = function() {
            window.URL.revokeObjectURL(video.src);
            resolve(video.duration);
        };
        
        video.onerror = function() {
            reject(new Error('Failed to load video metadata'));
        };
        
        video.src = URL.createObjectURL(file);
    });
}
```

**방법 2: 파일 형식 검증** (⚠️ 미구현)
```javascript
// 권장: 파일 확장자 체크
const allowedExtensions = ['.mp4', '.mov', '.avi', '.webm'];
const fileExtension = videoFile.name.toLowerCase().slice(-4);
if (!allowedExtensions.includes(fileExtension)) {
    alert('지원하지 않는 파일 형식입니다.');
    return;
}
```

#### 사용자 안내
- MP4 형식 권장
- H.264 코덱 사용 권장
- 파일이 손상되지 않았는지 확인

#### 상태
✅ **처리됨** - 에러 핸들링 구현

### 6.2 에러: FFmpeg processing failed

#### 증상
```
Error: Processing failed: [FFmpeg 에러]
```

#### 일반적 원인
1. 입력 파일 형식 문제
2. 메모리 부족
3. 잘못된 FFmpeg 명령어

#### 디버깅 방법

**방법 1: 콘솔 로그 확인**
```javascript
ffmpeg.on('log', ({ message }) => {
    console.log(message);
});
```

**방법 2: 간단한 명령어로 테스트**
```javascript
// 최소 명령어로 시작
await ffmpeg.exec(['-i', 'input.mp4', 'output.mp4']);
```

#### 상태
⚠️ **진행 중** - 지속적인 모니터링 필요

---

## 7. 브라우저 호환성 에러

### 7.1 Safari iOS 관련 문제

#### 증상
- Service Worker 제한적 동작
- SharedArrayBuffer 미지원
- 일부 비디오 코덱 미지원

#### 해결방법

**방법 1: Progressive Enhancement** (✅ 적용됨)
- 필수 기능만 요구
- 선택적 기능은 점진적 적용

**방법 2: 브라우저 감지 및 안내**
```javascript
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
if (isSafari) {
    console.warn('Safari detected. Some features may be limited.');
}
```

#### 권장사항
- Safari 사용자에게 Chrome 사용 권장
- 또는 기능 제한 안내

#### 상태
⚠️ **알려진 제약사항** - 완전한 해결 불가능

### 7.2 Firefox 성능 문제

#### 증상
- FFmpeg 처리 속도가 Chrome보다 느림
- 메모리 사용량 높음

#### 원인
- Firefox의 WASM 최적화 차이
- 메모리 관리 방식 차이

#### 해결방법
- 다운스케일 옵션 필수 사용
- 더 빠른 프리셋 사용
- Chrome/Edge 사용 권장

#### 상태
⚠️ **알려진 제약사항** - 브라우저 특성

---

## 8. 배포 관련 에러

### 8.1 에러: GitHub Pages 404

#### 증상
특정 파일에 404 에러

#### 원인
- Jekyll이 특정 파일/폴더 무시
- 잘못된 경로 설정

#### 해결방법

**방법 1: .nojekyll 파일 추가** (✅ 적용됨)
```bash
touch .nojekyll
git add .nojekyll
git commit -m "Disable Jekyll"
```

**방법 2: 경로 확인**
- manifest.json의 start_url
- Service Worker의 캐시 경로

#### 상태
✅ **해결됨** - .nojekyll 추가

---

## 9. 에러 방지 체크리스트

### 개발 시

- [ ] 에러 처리 (try-catch) 모든 비동기 작업에 적용
- [ ] 사용자 입력 검증 (파일 형식, 크기)
- [ ] 메모리 정리 코드 작성
- [ ] 브라우저 호환성 테스트
- [ ] 콘솔 로그 확인

### 배포 전

- [ ] 모든 버전에서 테스트
- [ ] 다양한 파일 형식 테스트
- [ ] 모바일 브라우저 테스트
- [ ] Service Worker 캐시 버전 업데이트
- [ ] GitHub Actions 워크플로우 확인

### 사용자 지원

- [ ] 명확한 에러 메시지
- [ ] 해결 방법 안내
- [ ] 브라우저 권장사항 제공
- [ ] 파일 요구사항 명시

---

## 10. 알려진 제약사항

### 기술적 제약

1. **GitHub Pages**
   - 커스텀 HTTP 헤더 불가
   - SharedArrayBuffer 제약

2. **브라우저 메모리**
   - 모바일: 낮은 메모리 제한
   - 데스크톱: 브라우저마다 상이

3. **파일 크기**
   - 권장 최대: 100MB
   - 모바일 권장: 20MB

4. **처리 시간**
   - 영상 길이와 해상도에 비례
   - 예상: 1분 영상 = 2-5분 처리 시간

### 브라우저별 제약

| 브라우저 | 제약사항 |
|----------|----------|
| Chrome | ✅ 최고의 호환성 |
| Edge | ✅ Chrome과 유사 |
| Firefox | ⚠️ 느린 처리 속도 |
| Safari | ⚠️ 제한적 Service Worker |
| Mobile Safari | ❌ 많은 제약사항 |

---

## 11. 긴급 문제 해결 가이드

### 앱이 전혀 작동하지 않을 때

1. **브라우저 콘솔 확인** (F12)
2. **캐시 클리어** (Ctrl+Shift+Delete)
3. **브라우저 업데이트**
4. **다른 브라우저 시도** (Chrome 권장)
5. **인터넷 연결 확인**

### 처리가 중단될 때

1. **브라우저 탭 새로고침**
2. **파일 크기 줄이기** (50MB 이하)
3. **다운스케일 옵션 활성화**
4. **데스크톱에서 시도** (모바일 대신)

### 다운로드가 안 될 때

1. **팝업 차단 해제**
2. **다운로드 경로 확인**
3. **브라우저 권한 확인**
4. **다시 처리**

---

## 문의 및 지원

**개발자**: Uncle, Parksy  
**이메일**: dtslib1979@gmail.com  
**GitHub Issues**: https://github.com/dtslib1979/dtslib-cloud-appstore/issues

---

**문서 버전**: 1.0  
**마지막 업데이트**: 2025년 12월 3일  
**다음 리뷰**: 사용자 피드백 수집 후

---

> 이 문서는 실제 발생한 에러와 잠재적 문제를 모두 포함합니다.
> 새로운 에러가 발견되면 즉시 업데이트됩니다.
