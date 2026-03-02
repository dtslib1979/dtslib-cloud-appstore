# Visual Novel — 아키텍처 설계서

> Phase 1: 설계만. 구현은 별도 승인 후.

---

## 1. 기존 자산 매핑

| 이미 가진 것 | 비주얼 노벨에서의 역할 |
|---|---|
| `parksy-image/scripts/story/engine.js` | 스크립트 엔진 (한국어 주제 → JSON) |
| `parksy-image/specs/characters/` | 캐릭터 스펙 (관상 기반) |
| `parksy-image/scripts/story/bgm_mapper.js` | BGM 매핑 (감정 → 오디오) |
| `parksy-image/output/.../player.html` | 웹툰 플레이어 (클릭/스와이프) |
| `parksy-audio/lyria3/` | BGM 라이브러리 (감정별) |
| `dtslib-apk-lab/apps/tts-factory/` | 나레이션 음성 (배치 TTS) |

---

## 2. 생산 파이프라인 (오프라인, Termux/PC)

```
[1] 스크립트 엔진 (parksy-image)
    입력: 한국어 주제
    출력: ep_script.json { cuts: [{narration, emotion, camera, ...}] }
           ↓
[2] 이미지 어셈블러 (parksy-image, PC)
    입력: ep_script.json + 캐릭터 유닛
    출력: cut_001.png, cut_002.png, ...
           ↓
[3] 나레이션 생성 (2가지 옵션)
    A) browser SpeechSynthesis (v1 — 즉시 가능, 저장 불필요)
    B) tts-factory 배치 생성 (v2 — 음성 품질 고정 시)
           ↓
[4] BGM 매핑 (parksy-image bgm_mapper.js)
    입력: 컷별 감정
    출력: 감정 → Lyria 3 mp3 매핑
           ↓
[5] 에피소드 패키저 (신규 스크립트)
    입력: 이미지 + 오디오 + BGM 매핑
    출력: episode_bundle/
          ├── episode.json  (매니페스트)
          ├── images/       (컷 PNG)
          ├── audio/        (나레이션 MP3, v2)
          └── bgm/          (감정 BGM)
```

---

## 3. 에피소드 번들 포맷

```json
{
  "id": "ep01",
  "title": "오늘 레스토랑에서 손님이 화를 냈다",
  "series": "일상편",
  "cuts": [
    {
      "cut_number": 1,
      "image": "images/cut_001.png",
      "narration_text": "또 시작이다.",
      "narration_audio": null,
      "bgm": "bgm/neutral_01.mp3",
      "emotion": "neutral",
      "duration_ms": 3500
    }
  ]
}
```

- `narration_audio: null` → 브라우저 SpeechSynthesis 사용 (v1)
- `narration_audio: "audio/cut_001.mp3"` → 프리렌더 TTS (v2)

---

## 4. 플레이어 (cloud-appstore 도구)

### apps.json 등록 (구현 시)

```json
{ "id": "visual-novel", "name": "Visual Novel", "desc": "인터랙티브 웹툰", "icon": "📖", "type": "pwa", "category": "util" }
```

### 기술 스택

- 순수 HTML/JS/CSS (빌드 도구 없음, CDN 없음)
- `HTMLAudioElement` — 나레이션 + BGM 재생
- `SpeechSynthesisAPI` — v1 브라우저 TTS
- 클릭/스와이프/키보드 — 기존 player.html 패턴
- 에피소드 데이터 — episode.json fetch

### 디렉토리 구조 (구현 시)

```
visual-novel/
├── index.html        (플레이어 UI)
├── app.js            (플레이어 로직)
├── style.css
├── manifest.json     (PWA)
├── sw.js             (PWA)
└── episodes/
    └── ep01/
        ├── episode.json
        ├── images/
        ├── audio/
        └── bgm/
```

---

## 5. 크로스레포 동기화

```
parksy-image ──→ cloud-appstore
  deploy-episode.sh (신규)
  : episode_bundle/ → visual-novel/episodes/ep01/

parksy-audio ──→ parksy-image
  sync-lyria3-to-image.sh (기존)
  : lyria3/webtoon/emotion/ → assets/audio/webtoon/emotion/
```

매트릭스 원칙 준수: "크로스레포 이동은 명시적 스크립트로"

---

## 6. 전체 자동화 플로우

```
원재료                  생산 (parksy-image)           유통 (cloud-appstore)
───────                ──────────────────           ──────────────────

타블렛 드로잉       →   스크립트 엔진              PWA 도구 (4개)
Gemini AI 이미지    →   이미지 어셈블러        →   웹앱 도구 (5+)
                        에피소드 패키저        →   비주얼 노벨 플레이어
                             ↑                     GitHub Pages 배포
                             │
Lyria 3 BGM 생성    →   parksy-audio           →   BGM 에셋
마이크 녹음         →   parksy-audio           →   SFX
                        Lyria 3 라이브러리
                             ↑
TTS 배치 변환       →   dtslib-apk-lab         →   APK 스토어
                        TTS Factory APK             (별도 트랙)
```

---

## 7. 구현 조건

Phase 1 → Phase 2 (구현) 전환 조건:

1. parksy-image `engine.js` 에피소드 1개 정상 출력 확인
2. BGM 매핑 테스트 (감정 3종 이상)
3. player.html 기존 패턴으로 프로토타입 가능 여부 검증
4. 사용자 승인

---

*설계일: 2026-03-02*
