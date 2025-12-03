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
├── shorts-maker/        # Shorts Maker v1 (베타)
├── auto-shorts-maker/   # Auto Shorts Maker v1.1 (SAB-free)
├── auto-shorts-v2/      # Auto Shorts v2 (데모)
├── auto-shorts-v3/      # Auto Shorts v3 (REAL) ⭐
└── README.md
```

## 📚 문서

프로젝트에 대한 상세한 문서를 제공합니다:

- **[종합 리포트](./REPOSITORY_REPORT.md)** - 레포지토리 전체 개요, 기술 스택, 설치된 항목, 향후 계획
- **[개발 일지](./DEVELOPMENT_LOG.md)** - 시간순 개발 기록, 기술적 결정 사항
- **[에러 문서](./ERROR_DOCUMENTATION.md)** - 발생한 모든 에러와 해결 방법, 트러블슈팅 가이드

## 🔧 트러블슈팅

문제가 발생했나요? [에러 문서](./ERROR_DOCUMENTATION.md)를 확인하세요.

일반적인 문제:
- SharedArrayBuffer 에러 → v1.1 또는 v3 사용
- 메모리 부족 → 720p 다운스케일 옵션 활성화
- 느린 처리 속도 → Chrome 브라우저 사용 권장

---

**박씨 전용 도구 by Parksy CTO**