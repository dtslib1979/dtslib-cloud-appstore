# DTS Cloud AppStore 🚀

박씨 전용 PWA 공장 - 모바일 도구 앱스토어

## 📱 접속 URL

| 앱 | URL | 상태 |
|---|---|---|
| **AppStore 메인** | https://dtslib1979.github.io/dtslib-cloud-appstore/ | ✅ |
| **Lecture Shorts** | https://dtslib1979.github.io/dtslib-cloud-appstore/lecture-shorts/ | ✅ v6.5 Pro |
| **Lecture Long** | https://dtslib1979.github.io/dtslib-cloud-appstore/lecture-long/ | ✅ v2.0 |
| **Auto Shorts** | https://dtslib1979.github.io/dtslib-cloud-appstore/auto-shorts/ | ✅ v1.1 |
| **Bilingual Aligner** | https://dtslib1979.github.io/dtslib-cloud-appstore/bilingual-aligner/ | ✅ vLIVE |
| **Slim Lens** | https://dtslib1979.github.io/dtslib-cloud-appstore/slim-lens/ | ✅ v2.0 |
| **Clip Shorts** | https://dtslib1979.github.io/dtslib-cloud-appstore/clip-shorts/ | ✅ v5.0 |
| **Parksy AudioCut** | https://dtslib1979.github.io/dtslib-cloud-appstore/audio-cut/ | ✅ v1.0 |
| **Parksy AudioLoop** | https://dtslib1979.github.io/dtslib-cloud-appstore/audio-loop/ | ✅ v1.0 |
| **Parksy Meta Kit** | https://dtslib1979.github.io/dtslib-cloud-appstore/meta-kit/ | ✅ v1.0 |
| **Parksy Image Pack** | https://dtslib1979.github.io/dtslib-cloud-appstore/image-pack/ | ✅ v1.0 |
| **Export / Packager** | https://dtslib1979.github.io/dtslib-cloud-appstore/export-packager/ | ✅ v1.0 |
| **Control Engine** | https://dtslib1979.github.io/dtslib-cloud-appstore/control-engine/ | ✅ v1.0 |

## 🎬 앱 목록 (총 12개)

### Lecture Shorts v6.5 Pro
4분 영상 → 3분 쇼츠 변환 (WebCodecs 기반)

### Lecture Long v2.0
16분 영상 → 12분 튜토리얼 변환

### Auto Shorts v1.1
6~30초 영상 → 2분 쇼츠 자동 반복 변환

### Bilingual Aligner vLIVE
한영 문장 정렬 도구

### Slim Lens v2.0
사진 가로 슬림 변환

### Clip Shorts v5.0
클립 조합 쇼츠 + BGM 합성

### Parksy AudioCut v1.0
파형 클릭 → 1/2/3분 컷 → MP3 저장

### Parksy AudioLoop v1.0
5/10/15분 자동 반복 + 크로스페이드 → MP3 저장

### Parksy Meta Kit v1.0
템플릿 기반 메타데이터 규격 생성기 (Python 자동화 연동)

### Parksy Image Pack v1.0
플랫폼별 이미지 규격 생성기 (YouTube, Instagram, TikTok, Twitter)

### Export / Packager v1.0
프로젝트 출하 엔진 - PWA 결과물을 표준 구조로 패키징 (ZIP Export)

### Control Engine v1.0
PC Batch Runner용 실행 계획(run_plan.json) 생성기

## 📲 PWA 설치

1. Chrome/Safari에서 앱 접속
2. 메뉴 → "홈 화면에 추가"
3. 네이티브 앱처럼 사용!

## 🏗️ 기술 스택

- Pure HTML/CSS/JS
- WebCodecs API (Lecture Shorts)
- FFmpeg.wasm (Auto Shorts, Clip Shorts)
- WaveSurfer.js + lamejs (AudioCut, AudioLoop)
- Service Worker / PWA Manifest
- GitHub Pages / Vercel Hosting

## 📁 구조

```
dtslib-cloud-appstore/
├── index.html              # AppStore 대시보드
├── apps.json               # 앱 목록 설정
├── lecture-shorts/         # Lecture Shorts v6.5 Pro
├── lecture-long/           # Lecture Long v2.0
├── auto-shorts/            # Auto Shorts v1.1
├── bilingual-aligner/      # Bilingual Aligner vLIVE
├── slim-lens/              # Slim Lens v2.0
├── clip-shorts/            # Clip Shorts v5.0
├── audio-cut/              # Parksy AudioCut v1.0
├── audio-loop/             # Parksy AudioLoop v1.0
├── meta-kit/               # Parksy Meta Kit v1.0
├── image-pack/             # Parksy Image Pack v1.0
├── export-packager/        # Export / Packager v1.0
├── control-engine/         # Control Engine v1.0
└── README.md
```

---

**by PARKSY CTO**