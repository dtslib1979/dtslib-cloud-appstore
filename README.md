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

## 🎬 앱 목록 (총 6개)

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

## 📲 PWA 설치

1. Chrome/Safari에서 앱 접속
2. 메뉴 → "홈 화면에 추가"
3. 네이티브 앱처럼 사용!

## 🏗️ 기술 스택

- Pure HTML/CSS/JS
- WebCodecs API (Lecture Shorts)
- FFmpeg.wasm (Auto Shorts, Clip Shorts)
- Service Worker / PWA Manifest
- GitHub Pages Hosting

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
└── README.md
```

---

**by PARKSY CTO**