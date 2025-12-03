# 빠른 시작 가이드 (Quick Start)

## DTS Cloud AppStore

박씨 전용 PWA 공장 - 쇼츠 영상 자동 제작 도구

---

## 📱 즉시 사용하기

### 권장 버전: Auto Shorts v3 (REAL) ⭐

**접속**: https://dtslib1979.github.io/dtslib-cloud-appstore/auto-shorts-v3/

#### 3단계로 완성!

1. **영상 업로드** 📹
   - 6~10초 짧은 영상
   - MP4 형식 권장
   - 50MB 이하 권장

2. **음원 업로드** 🎵
   - 약 2분 길이 음원
   - MP3, M4A 등 지원

3. **버튼 클릭** ✨
   - "MAKE 2-MIN SHORTS" 클릭
   - 2~5분 대기
   - 완성된 2분 쇼츠 다운로드!

---

## 📚 상세 문서

| 문서 | 내용 |
|------|------|
| [종합 리포트](./REPOSITORY_REPORT.md) | 전체 프로젝트 개요, 기술 스택, 의존성 |
| [개발 일지](./DEVELOPMENT_LOG.md) | 개발 과정, 기술적 결정 |
| [에러 문서](./ERROR_DOCUMENTATION.md) | 문제 해결 가이드 |

---

## 🔍 주요 정보

### 설치된 것들

- **FFmpeg.wasm 0.12.10** - 브라우저 영상 처리
- **Service Worker** - 오프라인 지원
- **PWA Manifest** - 앱 설치 지원

### 자동 처리 내용

1. 영상을 0.2배 속도로 슬로우모션 (5배 느리게)
2. 정확히 120초가 되도록 자동 반복
3. 업로드한 음원으로 오디오 교체
4. 720p HD 화질로 최적화 (옵션)

### 기술 스택

- HTML5, CSS3, JavaScript (ES6+)
- FFmpeg.wasm (WebAssembly)
- Progressive Web App (PWA)
- GitHub Pages 배포

---

## ⚠️ 주의사항

### 권장 환경
- ✅ **Chrome 브라우저** (최고 성능)
- ✅ **Edge 브라우저** (Chrome과 유사)
- ⚠️ Firefox (느릴 수 있음)
- ⚠️ Safari (제한적 지원)

### 파일 크기
- 데스크톱: 최대 100MB
- 모바일: 최대 20MB 권장

### 처리 시간
- 6초 영상 → 약 2-3분
- 10초 영상 → 약 3-5분

---

## 🆘 문제 해결

### 앱이 안 열려요
→ Chrome 브라우저 사용, 캐시 삭제

### "Out of Memory" 에러
→ 720p 다운스케일 옵션 켜기, 파일 크기 줄이기

### 처리가 너무 느려요
→ Chrome 사용, 데스크톱에서 시도

### 다운로드가 안 돼요
→ 팝업 차단 해제

**자세한 해결법**: [에러 문서](./ERROR_DOCUMENTATION.md)

---

## 📊 버전 비교

| 버전 | 상태 | 특징 | 권장 |
|------|------|------|------|
| v1 (베타) | 작동 | SharedArrayBuffer 필요 | ❌ |
| v1.1 (SAB-free) | 작동 | 호환성 우선 | ⚠️ |
| v2 (데모) | 데모 | 시뮬레이션만 | ❌ |
| **v3 (REAL)** | **작동** | **최신, 실제 처리** | **✅** |

---

## 🎯 사용 팁

### 최상의 결과를 위해

1. **고품질 원본 사용**
   - 1080p 이상 영상 권장
   - 밝고 선명한 영상

2. **적절한 음원 선택**
   - 정확히 2분 길이
   - 저작권 없는 음원 사용

3. **설정 최적화**
   - 720p 다운스케일: 켜기 (모바일)
   - 720p 다운스케일: 끄기 (고품질 원할 때)

---

## 💡 활용 아이디어

### 쇼츠 제작에 활용
- 제품 소개 영상
- 강의 하이라이트
- 브이로그 티저
- 광고 영상

### 팁
- 6~8초 영상이 가장 자연스러움
- 템포 빠른 음악과 잘 어울림
- 반복되는 동작이 효과적

---

## 📞 지원

**개발자**: Uncle, Parksy (박씨 CTO)  
**이메일**: dtslib1979@gmail.com  
**GitHub**: https://github.com/dtslib1979/dtslib-cloud-appstore

---

## 🔗 모든 버전 접속 링크

- 🏠 **메인 대시보드**: https://dtslib1979.github.io/dtslib-cloud-appstore/
- ⭐ **v3 (권장)**: https://dtslib1979.github.io/dtslib-cloud-appstore/auto-shorts-v3/
- 📦 **v2 (데모)**: https://dtslib1979.github.io/dtslib-cloud-appstore/auto-shorts-v2/
- 🔧 **v1.1**: https://dtslib1979.github.io/dtslib-cloud-appstore/auto-shorts-maker/
- 🧪 **v1 (베타)**: https://dtslib1979.github.io/dtslib-cloud-appstore/shorts-maker/

---

**마지막 업데이트**: 2025년 12월 3일

> 더 자세한 정보는 [종합 리포트](./REPOSITORY_REPORT.md)를 참고하세요.
