# DTS Cloud AppStore 🚀

박씨 전용 PWA 공장 - 모바일 도구 앱스토어

## 📱 접속 URL

- **메인 AppStore**: https://dtslib1979.github.io/dtslib-cloud-appstore/
- **Shorts Maker**: https://dtslib1979.github.io/dtslib-cloud-appstore/shorts-maker/
- **Auto Shorts Maker v1.1**: https://dtslib1979.github.io/dtslib-cloud-appstore/auto-shorts-maker/

## 🎬 Auto Shorts Maker v1.1 (NEW!)

6~10초 영상을 2분 쇼츠로 자동 변환하는 PWA (SAB-free)

### 주요 기능
- ✅ SharedArrayBuffer 불필요 (싱글스레드 ffmpeg.wasm)
- ✅ 완전한 클라이언트 사이드 처리
- ✅ 모바일 최적화 UI
- ✅ 자동 반복 계산 (6~10초 → 120초)
- ✅ 오디오 자동 합성
- ✅ PWA 설치 지원

### 사용법 (3단계만!)
1. 6~10초 영상 업로드
2. 2분 음원 업로드  
3. "MAKE 2-MIN SHORTS" 버튼 클릭

### 자동 처리
- 원본 영상 음소거
- 120초 맞춤 자동 반복 (loops = ceil(120 / video_duration))
- 오디오 자동 덮어씌우기
- mp4 다운로드 제공

### 인코딩 옵션
- Video: libx264, CRF 18, preset medium, pix_fmt yuv420p
- Audio: AAC 192k

## 🎬 Auto Shorts Maker (기존)

6초 영상을 2분 쇼츠로 자동 변환하는 PWA

### 사용법 (3단계만!)
1. 6초 영상 업로드
2. 2분 음원 업로드  
3. "MAKE 2-MIN SHORTS" 버튼 클릭

### 자동 처리
- 0.2x 속도 슬로우모션
- 120초 맞춤 자동 반복
- 오디오 자동 합성
- mp4 다운로드 제공

## 📲 PWA 설치 방법

1. Chrome/Safari에서 앱 접속
2. 메뉴 → "홈 화면에 추가"
3. 설치 완료!

## 🏗️ 기술 스택

- Pure HTML/CSS/JS
- FFmpeg.wasm
- Service Worker
- PWA Manifest
- GitHub Pages

## 📁 구조

```
dts-cloud-appstore/
├── index.html           # AppStore 대시보드
├── shorts-maker/        # Shorts Maker PWA (기존)
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   ├── manifest.json
│   └── service-worker.js
├── auto-shorts-maker/   # Auto Shorts Maker v1.1 (NEW!)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── manifest.json
│   └── service-worker.js
├── README.md            # 프로젝트 소개 (이 파일)
├── ARCHITECTURE.md      # 📘 시스템 아키텍처 상세 문서
└── ISSUES.md            # 🔧 현재 이슈 및 해결 방안
```

## 📚 문서

프로젝트의 상세한 정보는 아래 문서를 참고하세요:

### 📘 [ARCHITECTURE.md](./ARCHITECTURE.md)
**시스템 아키텍처 및 구성 문서**
- 시스템 개요 및 접속 정보
- 설치 및 구성 이력 (타임라인)
- 전체 시스템 아키텍처 다이어그램
- 기술 스택 상세 설명
- 애플리케이션 컴포넌트 분석
- 배포 파이프라인 설명
- 디렉토리 구조 및 파일 설명
- 보안 고려사항
- 성능 메트릭
- 유지보수 가이드

### 🔧 [ISSUES.md](./ISSUES.md)
**현재 이슈 및 해결 방안**
- 🔴 중요 이슈 (즉시 수정 필요)
  - Service Worker 스코프 불일치
  - FFmpeg.wasm CDN 불일치
  - Service Worker 캐싱 전략 차이
- 🟡 개선 권장사항 (단기 개선)
  - 에러 처리 UI 개선
  - 진행률 표시 개선
  - 파일 크기 제한
  - 브라우저 호환성 검사
  - 메모리 최적화
- 🟢 향후 개선 계획 (장기)
  - 테스트 인프라
  - 모니터링 시스템
  - 성능 최적화
- 우선순위 로드맵
- 수정 체크리스트

---

**박씨 전용 도구 by Parksy CTO**