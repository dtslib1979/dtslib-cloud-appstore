# DTS Cloud AppStore 🚀

박씨 전용 PWA 공장 - 모바일 도구 앱스토어

## 📱 접속 URL

| 앱 | URL | 상태 |
|---|---|---|
| **AppStore 메인** | https://dtslib1979.github.io/dtslib-cloud-appstore/ | ✅ |
| **Auto Shorts** | https://dtslib1979.github.io/dtslib-cloud-appstore/auto-shorts/ | ✅ v1.0 |
| **Bilingual Aligner** | https://dtslib1979.github.io/dtslib-cloud-appstore/bilingual-aligner/ | ✅ |

## 🎬 Auto Shorts Maker v1.0

6~10초 영상을 2분 쇼츠로 자동 변환하는 PWA

### 주요 기능
- ✅ 6~30초 영상 → 120초 자동 반복
- ✅ 오디오 자동 합성 (원본 음소거)
- ✅ FFmpeg.wasm 클라이언트 처리
- ✅ PWA 설치 지원
- ✅ 모바일 최적화 UI

### 사용법
1. 짧은 영상 업로드 (6~30초)
2. 배경 오디오 업로드 (2분)
3. "2분 쇼츠 만들기" 클릭
4. 완성된 MP4 다운로드

### 인코딩 스펙
- Video: libx264, CRF 18, preset medium
- Audio: AAC 192kbps
- Format: MP4 (yuv420p)

## 📲 PWA 설치

1. Chrome/Safari에서 앱 접속
2. 메뉴 → "홈 화면에 추가"
3. 네이티브 앱처럼 사용!

## 🏗️ 기술 스택

- Pure HTML/CSS/JS
- FFmpeg.wasm (싱글스레드)
- Service Worker
- PWA Manifest
- Vercel Hosting

## 📁 구조

```
dtslib-cloud-appstore/
├── index.html              # AppStore 대시보드
├── auto-shorts/            # Auto Shorts Maker v1.0
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── manifest.json
│   └── sw.js
├── bilingual-aligner/      # Bilingual Aligner
│   └── index.html
├── apps/                   # 추가 앱 (Vercel Functions 포함)
│   └── eduart-aligner-v1/
├── vercel.json
└── README.md
```

---

**by PARKSY CTO**