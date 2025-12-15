/**
 * Lecture Shorts Factory v3.0 - Final Release
 *
 * 🚀 핵심: WebCodecs API (하드웨어 가속) + FFmpeg.wasm (오디오)
 *
 * v3.0 기능:
 * - 원본 강의 오디오 100% 유지
 * - BGM 볼륨 슬라이더 (0~50%)
 * - BGM 미리듣기 (5초)
 * - 인트로 + 본편 오디오 믹싱
 * - Wake Lock API (백그라운드 보호)
 *
 * Fallback: WebCodecs 미지원 시 FFmpeg.wasm 사용
 */

/* ========== DEVICE PRESETS ========== */
const PRESETS = {
    TAB_S9: {
        name: 'Galaxy Tab S9',
        topCutPct: 0.055,
        bottomCutPct: 0.090,
        yShiftPct: -0.060
    },
    S25_ULTRA: {
        name: 'Galaxy S25 Ultra',
        topCutPct: 0.090,
        bottomCutPct: 0.040,
        yShiftPct: -0.085
    }
};

/* ========== OUTPUT SPECS ========== */
const OUTPUT = {
    width: 720,
    height: 1280,
    targetDur: 180,
    bgmVol: 0.1,
    fps: 30,
    bitrate: 2_500_000
};

/* ========== STATE ========== */
let vidFile = null;
let introFile = null;
let bgmFile = null;
let preset = null;
let vidMeta = { dur: 0, w: 0, h: 0 };
let introMeta = { dur: 0, w: 0, h: 0 };
let useWebCodecs = false;

// v2.3.0: BGM 볼륨 및 미리듣기
let bgmVolume = 0.1; // 기본 10%
let bgmPreviewAudio = null;

// v2.2.0: Background 관련 상태
let wakeLock = null;
let audioContext = null;
let silentAudioNode = null;
let isProcessing = false;
let processingAborted = false;
let lastFrameIndex = 0;

// WebCodecs 지원 여부 체크
const supportsWebCodecs = () => {
    return typeof VideoEncoder !== 'undefined' && 
           typeof VideoDecoder !== 'undefined' &&
           typeof VideoFrame !== 'undefined';
};

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', init);

async function init() {
    useWebCodecs = supportsWebCodecs();

    if (useWebCodecs) {
        console.log('✅ WebCodecs API (하드웨어 가속)');
        el('engineInfo').innerHTML = '🚀 WebCodecs (HW 가속)';
        el('engineInfo').className = 'engine-badge webcodecs';
    } else {
        console.log('⚠️ FFmpeg.wasm 폴백');
        el('engineInfo').innerHTML = '⚙️ FFmpeg.wasm';
        el('engineInfo').className = 'engine-badge ffmpeg';
    }

    // FFmpeg CDN 상태 확인 (BGM 믹싱에 필요)
    checkFFmpegStatus();

    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        show('memWarn');
    }

    el('vidIn').onchange = e => loadVid(e.target.files[0]);
    el('introIn').onchange = e => loadIntro(e.target.files[0]);
    el('bgmIn').onchange = e => loadBgm(e.target.files[0]);

    // v2.2.0: Page Visibility 감지
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js');
    }
}

// FFmpeg CDN 로드 상태 확인
function checkFFmpegStatus() {
    const bgmInfo = el('bgmInfo');

    if (typeof FFmpeg === 'undefined') {
        console.warn('⚠️ FFmpeg CDN 아직 로드 안됨');
        // BGM 선택 시 경고 표시
        el('bgmIn').addEventListener('change', function handler() {
            if (typeof FFmpeg === 'undefined') {
                showInfo('bgmInfo',
                    '⚠️ FFmpeg 로딩 중... 잠시 후 다시 시도하세요',
                    'warn'
                );
            }
        }, { once: true });
    } else {
        console.log('✅ FFmpeg CDN 로드됨');
    }
}

/* ========== v2.2.0: BACKGROUND PROTECTION ========== */

// Wake Lock 요청 (화면 꺼짐 방지)
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('🔒 Wake Lock 활성화');
            wakeLock.addEventListener('release', () => {
                console.log('🔓 Wake Lock 해제됨');
            });
        } catch (e) {
            console.warn('Wake Lock 실패:', e.message);
        }
    }
}

// Wake Lock 해제
function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

// 무음 오디오 재생 (브라우저 throttling 회피)
function startSilentAudio() {
    if (audioContext) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 무음 오실레이터 (들리지 않음)
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 볼륨 0 (무음)
        gainNode.gain.value = 0.001; // 완전 0은 일부 브라우저에서 최적화됨
        oscillator.frequency.value = 1; // 매우 낮은 주파수
        
        oscillator.start();
        silentAudioNode = oscillator;
        
        console.log('🔊 Silent Audio 시작 (throttling 방지)');
    } catch (e) {
        console.warn('Silent Audio 실패:', e.message);
    }
}

// 무음 오디오 중지
function stopSilentAudio() {
    if (silentAudioNode) {
        silentAudioNode.stop();
        silentAudioNode = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}

// Page Visibility 변경 핸들러
function handleVisibilityChange() {
    if (!isProcessing) return;
    
    if (document.hidden) {
        // 백그라운드 진입
        console.warn('⚠️ 탭이 백그라운드로 전환됨');
        showBackgroundWarning(true);
    } else {
        // 포그라운드 복귀
        console.log('✅ 탭 활성화됨');
        showBackgroundWarning(false);
        
        // AudioContext 재개 (일부 브라우저에서 필요)
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }
}

// 백그라운드 경고 UI
function showBackgroundWarning(show) {
    let warn = el('bgWarn');
    if (!warn) {
        warn = document.createElement('div');
        warn.id = 'bgWarn';
        warn.innerHTML = `
            <div style="
                position: fixed;
                top: 0; left: 0; right: 0;
                background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
                color: white;
                padding: 15px;
                text-align: center;
                font-weight: bold;
                z-index: 9999;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                ⚠️ 화면을 유지하세요! 백그라운드에서 인코딩이 중단될 수 있습니다.
            </div>
        `;
        document.body.appendChild(warn);
    }
    warn.style.display = show ? 'block' : 'none';
}

/* ========== FILE LOADERS ========== */
async function loadVid(file) {
    if (!file) return;
    vidFile = file;
    
    try {
        vidMeta = await getVidMeta(file);
        updateVidInfo();
        checkReady();
    } catch (e) {
        showInfo('vidInfo', `❌ ${e.message}`, 'warn');
    }
}

async function loadIntro(file) {
    if (!file) return;
    introFile = file;
    
    try {
        introMeta = await getVidMeta(file);
        
        let warn = '';
        if (introMeta.dur > 120) warn = ' ⚠️ 2분 초과';
        
        showInfo('introInfo', 
            `✅ ${file.name}<br>⏱️ ${fmtDur(introMeta.dur)}${warn}`,
            introMeta.dur > 120 ? 'warn' : 'success'
        );
        
        updateVidInfo();
        checkReady();
    } catch (e) {
        showInfo('introInfo', `❌ ${e.message}`, 'warn');
    }
}

function updateVidInfo() {
    if (!vidMeta.dur) return;
    
    const speed = calcSpeed();
    const targetMain = OUTPUT.targetDur - introMeta.dur;
    
    showInfo('vidInfo', 
        `✅ ${vidFile.name}<br>` +
        `📐 ${vidMeta.w}×${vidMeta.h} → 720p<br>` +
        `⏱️ ${fmtDur(vidMeta.dur)} → ${fmtDur(targetMain)} (${speed.toFixed(2)}x)`,
        speed >= 2.0 ? 'warn' : 'success'
    );
}

async function loadBgm(file) {
    if (!file) return;
    bgmFile = file;

    showInfo('bgmInfo',
        `✅ ${file.name}<br>🔊 자동 루프`,
        'success'
    );

    // v2.3.0: 볼륨 컨트롤 표시
    show('bgmVolControl');
    initBgmVolumeSlider();

    checkReady();
}

// v2.3.0: BGM 볼륨 슬라이더 초기화
function initBgmVolumeSlider() {
    const slider = el('bgmVolSlider');
    const valueDisplay = el('bgmVolValue');

    slider.oninput = () => {
        const val = parseInt(slider.value);
        bgmVolume = val / 100;
        valueDisplay.textContent = val + '%';

        // 미리듣기 중이면 실시간 반영
        if (bgmPreviewAudio && !bgmPreviewAudio.paused) {
            bgmPreviewAudio.volume = bgmVolume;
        }
    };
}

// v2.3.0: BGM 미리듣기
function previewBgm() {
    if (!bgmFile) return;

    const btn = el('bgmPreviewBtn');

    // 이미 재생 중이면 정지
    if (bgmPreviewAudio && !bgmPreviewAudio.paused) {
        bgmPreviewAudio.pause();
        bgmPreviewAudio = null;
        btn.textContent = '▶️ 미리듣기';
        return;
    }

    // 새로 재생
    bgmPreviewAudio = new Audio(URL.createObjectURL(bgmFile));
    bgmPreviewAudio.volume = bgmVolume;
    bgmPreviewAudio.play();
    btn.textContent = '⏹️ 정지';

    // 5초 후 자동 정지 (미리듣기)
    setTimeout(() => {
        if (bgmPreviewAudio) {
            bgmPreviewAudio.pause();
            bgmPreviewAudio = null;
            btn.textContent = '▶️ 미리듣기';
        }
    }, 5000);

    bgmPreviewAudio.onended = () => {
        btn.textContent = '▶️ 미리듣기';
    };
}

/* ========== PRESET SELECTION ========== */
function setPreset(key) {
    preset = key;
    
    el('btnTabS9').classList.toggle('active', key === 'TAB_S9');
    el('btnS25').classList.toggle('active', key === 'S25_ULTRA');
    el('btnNone').classList.toggle('active', key === null);
    
    if (key && PRESETS[key]) {
        const p = PRESETS[key];
        el('presetInfo').innerHTML = 
            `Top: ${(p.topCutPct * 100).toFixed(1)}% | ` +
            `Bottom: ${(p.bottomCutPct * 100).toFixed(1)}%`;
    } else {
        el('presetInfo').innerHTML = '크롭 없음';
    }
    
    checkReady();
}

function checkReady() {
    el('genBtn').disabled = !(vidFile && introFile);
}

function calcSpeed() {
    const targetMain = OUTPUT.targetDur - introMeta.dur;
    if (targetMain <= 0) return 2.0;
    return Math.max(1.0, Math.min(2.0, vidMeta.dur / targetMain));
}

/* ========== MAIN GENERATION ========== */
async function generate() {
    el('genBtn').disabled = true;
    show('progress');
    
    isProcessing = true;
    processingAborted = false;
    const startTime = performance.now();
    
    // v2.2.0: 백그라운드 보호 활성화
    await requestWakeLock();
    startSilentAudio();
    
    try {
        if (useWebCodecs) {
            await generateWithWebCodecs();
        } else {
            await generateWithFFmpeg();
        }
        
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        setStatus(`✅ 완료! (${elapsed}초)`);
        
    } catch (e) {
        if (processingAborted) {
            setStatus('⏸️ 중단됨 - 다시 시도해주세요', true);
        } else {
            setStatus(`❌ ${e.message}`, true);
        }
        console.error(e);
        el('genBtn').disabled = false;
    } finally {
        // v2.2.0: 백그라운드 보호 해제
        isProcessing = false;
        releaseWakeLock();
        stopSilentAudio();
        showBackgroundWarning(false);
    }
}

/* ========== WebCodecs Pipeline v2.2 ========== */
async function generateWithWebCodecs() {
    setStatus('라이브러리 로딩...');
    setProg(5);
    await loadMp4Muxer();
    
    const { Muxer, ArrayBufferTarget } = Mp4Muxer;
    
    // Muxer 초기화
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: 'avc',
            width: OUTPUT.width,
            height: OUTPUT.height
        },
        fastStart: 'in-memory'
    });
    
    // VideoEncoder 초기화
    const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => { throw new Error(`인코더 오류: ${e.message}`); }
    });
    
    await encoder.configure({
        codec: 'avc1.42001f',
        width: OUTPUT.width,
        height: OUTPUT.height,
        bitrate: OUTPUT.bitrate,
        framerate: OUTPUT.fps,
        hardwareAcceleration: 'prefer-hardware'
    });
    
    let totalFrames = 0;
    let encodedFrames = 0;
    const startTime = performance.now();
    
    // 인트로 처리
    setStatus('인트로 처리 중...');
    setProg(10);
    
    const introFrameCount = Math.floor(introMeta.dur * OUTPUT.fps);
    totalFrames = introFrameCount + Math.floor((OUTPUT.targetDur - introMeta.dur) * OUTPUT.fps);
    
    await processVideoFrames(introFile, introMeta, 1, encoder, (i, total) => {
        encodedFrames = i;
        lastFrameIndex = i;
        const pct = 10 + Math.floor((i / totalFrames) * 40);
        setProg(pct);
        
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(0);
        if (i % 30 === 0) setStatus(`인트로: ${i}/${total} 프레임 (${elapsed}초)`);
    });
    
    // 본편 처리
    setStatus('본편 처리 중...');
    const speed = calcSpeed();
    const introOffset = introMeta.dur * 1000000; // microseconds
    const mainFrameCount = Math.floor((OUTPUT.targetDur - introMeta.dur) * OUTPUT.fps);
    
    await processVideoFrames(vidFile, vidMeta, speed, encoder, (i, total) => {
        encodedFrames = introFrameCount + i;
        lastFrameIndex = encodedFrames;
        const pct = 50 + Math.floor((i / mainFrameCount) * 40);
        setProg(pct);
        
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(0);
        if (i % 30 === 0) setStatus(`본편: ${i}/${total} 프레임 (${speed.toFixed(1)}x) - ${elapsed}초`);
    }, introOffset, mainFrameCount);
    
    // 인코딩 완료
    setStatus('MP4 생성 중...');
    setProg(90);
    
    await encoder.flush();
    encoder.close();
    muxer.finalize();
    
    const videoBlob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    
    // v2.3.0: 원본 오디오 추출 + BGM 믹싱 (FFmpeg 사용)
    setStatus('오디오 처리 중...');
    setProg(92);
    const finalBlob = await mixAudioWithFFmpeg(videoBlob, speed);

    setProg(100);
    showResultBlob(finalBlob);
}

// v2.2.0: 스트리밍 방식 프레임 처리 (중단 체크 추가)
async function processVideoFrames(file, meta, speed, encoder, onProgress, timestampOffset = 0, maxFrames = null) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    
    await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error('비디오 로드 실패'));
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT.width;
    canvas.height = OUTPUT.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    const outputDuration = meta.dur / speed;
    const frameInterval = 1 / OUTPUT.fps;
    let totalFrames = Math.floor(outputDuration * OUTPUT.fps);
    
    // 최대 프레임 제한 (본편용)
    if (maxFrames && totalFrames > maxFrames) {
        totalFrames = maxFrames;
    }
    
    for (let i = 0; i < totalFrames; i++) {
        // v2.2.0: 중단 체크
        if (processingAborted) {
            throw new Error('사용자 중단');
        }
        
        const sourceTime = i * frameInterval * speed;
        if (sourceTime >= meta.dur) break;
        
        // Seek to frame
        video.currentTime = sourceTime;
        await new Promise(r => { video.onseeked = r; });
        
        // 크롭 계산
        let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
        
        if (preset && PRESETS[preset]) {
            const p = PRESETS[preset];
            sy = Math.floor(video.videoHeight * p.topCutPct);
            sh = Math.floor(video.videoHeight * (1 - p.topCutPct - p.bottomCutPct));
        }
        
        // Canvas에 그리기 (letterbox)
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, OUTPUT.width, OUTPUT.height);
        
        const scale = Math.min(OUTPUT.width / sw, OUTPUT.height / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = (OUTPUT.width - dw) / 2;
        const dy = (OUTPUT.height - dh) / 2;
        
        ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
        
        // VideoFrame 생성 및 인코딩
        const timestamp = timestampOffset + (i * frameInterval * 1000000);
        const frame = new VideoFrame(canvas, { timestamp });
        
        encoder.encode(frame, { keyFrame: i % 60 === 0 });
        frame.close();
        
        // 진행률 콜백
        if (onProgress) onProgress(i + 1, totalFrames);
        
        // v2.2.0: 더 자주 yield (UI 반응성 + 백그라운드 감지)
        if (i % 3 === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
    }
    
    URL.revokeObjectURL(video.src);
}

// mp4-muxer CDN 로딩
async function loadMp4Muxer() {
    if (window.Mp4Muxer) return;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.0.0/build/mp4-muxer.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('mp4-muxer 로드 실패'));
        document.head.appendChild(script);
    });
}

// v2.3.0: 원본 오디오 + BGM 믹싱
async function mixAudioWithFFmpeg(videoBlob, mainSpeed) {
    setStatus('FFmpeg 로딩 중...');
    await initFFmpeg();

    if (typeof FFmpeg === 'undefined' || !FFmpeg.fetchFile) {
        throw new Error('FFmpeg 초기화 실패');
    }

    const { fetchFile } = FFmpeg;

    // 파일 쓰기
    ffmpeg.FS('writeFile', 'video.mp4', new Uint8Array(await videoBlob.arrayBuffer()));
    ffmpeg.FS('writeFile', 'intro.mp4', await fetchFile(introFile));
    ffmpeg.FS('writeFile', 'lecture.mp4', await fetchFile(vidFile));
    if (bgmFile) {
        ffmpeg.FS('writeFile', 'bgm.mp3', await fetchFile(bgmFile));
    }

    setStatus('인트로 오디오 추출...');
    setProg(93);

    // 1. 인트로 오디오 추출 (포맷 통일: 44100Hz, stereo)
    await ffmpeg.run(
        '-i', 'intro.mp4',
        '-vn', '-acodec', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
        'intro_audio.m4a'
    );

    setStatus('본편 오디오 추출...');
    setProg(94);

    // 2. 본편 오디오 추출 (2단계: 추출 → 속도조절)
    // Step 2a: 먼저 원본 오디오 추출
    await ffmpeg.run(
        '-i', 'lecture.mp4',
        '-vn',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
        'lecture_audio_raw.m4a'
    );

    setStatus('오디오 속도 조절...');

    // Step 2b: 속도 조절 (atempo는 0.5~2.0 범위만 지원)
    const af = mainSpeed <= 2.0 ? `atempo=${mainSpeed.toFixed(4)}` : `atempo=2.0,atempo=${(mainSpeed / 2).toFixed(4)}`;

    await ffmpeg.run(
        '-i', 'lecture_audio_raw.m4a',
        '-filter:a', af,
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
        'main_audio.m4a'
    );

    setStatus('오디오 합치기...');
    setProg(95);

    // 3. 인트로 + 본편 오디오 합치기
    ffmpeg.FS('writeFile', 'audio_list.txt',
        new TextEncoder().encode("file 'intro_audio.m4a'\nfile 'main_audio.m4a'\n"));

    await ffmpeg.run(
        '-f', 'concat', '-safe', '0',
        '-i', 'audio_list.txt',
        '-c', 'copy',
        'combined_audio.m4a'
    );

    setStatus('영상에 오디오 합성...');
    setProg(96);

    // 4. BGM 믹싱 여부에 따라 처리
    if (bgmFile && bgmVolume > 0) {
        setStatus('BGM 믹싱 중...');
        setProg(97);

        // 원본 오디오 + BGM 믹싱
        await ffmpeg.run(
            '-i', 'video.mp4',
            '-i', 'combined_audio.m4a',
            '-stream_loop', '-1', '-i', 'bgm.mp3',
            '-t', String(OUTPUT.targetDur),
            '-filter_complex',
            `[1:a]volume=1[orig];[2:a]volume=${bgmVolume.toFixed(2)}[bgm];[orig][bgm]amix=inputs=2:duration=first[aout]`,
            '-map', '0:v', '-map', '[aout]',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
            '-shortest',
            'output.mp4'
        );
    } else {
        // BGM 없이 원본 오디오만
        await ffmpeg.run(
            '-i', 'video.mp4',
            '-i', 'combined_audio.m4a',
            '-t', String(OUTPUT.targetDur),
            '-map', '0:v', '-map', '1:a',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
            '-shortest',
            'output.mp4'
        );
    }

    setProg(99);
    const data = ffmpeg.FS('readFile', 'output.mp4');
    return new Blob([data.buffer], { type: 'video/mp4' });
}

/* ========== FFmpeg Fallback ========== */
let ffmpeg = null;

async function generateWithFFmpeg() {
    setStatus('FFmpeg 로딩...');
    setProg(5);
    await initFFmpeg();
    
    setStatus('파일 준비...');
    setProg(10);
    await writeFiles();
    
    setStatus('인트로 처리...');
    setProg(15);
    await prepareIntro();
    
    setStatus('본편 처리... (시간 소요)');
    setProg(20);
    await processMain();
    
    setStatus('영상 합치기...');
    setProg(80);
    await concatVideos();
    
    if (bgmFile) {
        setStatus('BGM 믹싱...');
        setProg(90);
        await mixBgm();
    }
    
    setProg(100);
    await showResult();
}

async function initFFmpeg() {
    if (ffmpeg && ffmpeg.isLoaded()) return;

    // FFmpeg CDN 로드 확인
    if (typeof FFmpeg === 'undefined') {
        console.warn('FFmpeg 미로드 - 수동 로드 시도');
        await loadFFmpegScript();
    }

    // 여전히 없으면 에러
    if (typeof FFmpeg === 'undefined') {
        throw new Error('FFmpeg 로드 실패 - 네트워크 확인 후 새로고침하세요');
    }

    const { createFFmpeg } = FFmpeg;
    ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
    });

    ffmpeg.setProgress(({ ratio }) => {
        if (ratio > 0) {
            el('progText').textContent = `처리: ${Math.round(ratio * 100)}%`;
        }
    });

    await ffmpeg.load();
}

// FFmpeg CDN 스크립트 동적 로드
async function loadFFmpegScript() {
    return new Promise((resolve, reject) => {
        // 이미 로드되어 있으면 스킵
        if (typeof FFmpeg !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
        script.onload = () => {
            console.log('✅ FFmpeg 스크립트 로드 완료');
            resolve();
        };
        script.onerror = () => {
            console.error('❌ FFmpeg 스크립트 로드 실패');
            reject(new Error('FFmpeg CDN 로드 실패'));
        };
        document.head.appendChild(script);
    });
}

async function writeFiles() {
    const { fetchFile } = FFmpeg;
    ffmpeg.FS('writeFile', 'lecture.mp4', await fetchFile(vidFile));
    ffmpeg.FS('writeFile', 'intro.mp4', await fetchFile(introFile));
    if (bgmFile) {
        ffmpeg.FS('writeFile', 'bgm.mp3', await fetchFile(bgmFile));
    }
}

async function prepareIntro() {
    const vf = `scale=${OUTPUT.width}:${OUTPUT.height}:force_original_aspect_ratio=decrease,` +
               `pad=${OUTPUT.width}:${OUTPUT.height}:(ow-iw)/2:(oh-ih)/2:black`;
    
    await ffmpeg.run(
        '-i', 'intro.mp4',
        '-vf', vf,
        '-r', String(OUTPUT.fps),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-c:a', 'aac',
        '-b:a', '128k',
        'intro_ready.mp4'
    );
}

async function processMain() {
    const speed = calcSpeed();
    
    let vf = `setpts=PTS/${speed}`;
    
    if (preset && PRESETS[preset]) {
        const p = PRESETS[preset];
        const cropH = 1 - p.topCutPct - p.bottomCutPct;
        vf += `,crop=in_w:in_h*${cropH.toFixed(4)}:0:in_h*${p.topCutPct.toFixed(4)}`;
    }
    
    vf += `,scale=${OUTPUT.width}:${OUTPUT.height}:force_original_aspect_ratio=decrease`;
    vf += `,pad=${OUTPUT.width}:${OUTPUT.height}:(ow-iw)/2:(oh-ih)/2:black`;
    
    const af = speed <= 2.0 ? `atempo=${speed}` : `atempo=2.0,atempo=${(speed/2).toFixed(3)}`;
    
    await ffmpeg.run(
        '-i', 'lecture.mp4',
        '-vf', vf,
        '-af', af,
        '-r', String(OUTPUT.fps),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-c:a', 'aac',
        '-b:a', '128k',
        'main_ready.mp4'
    );
}

async function concatVideos() {
    ffmpeg.FS('writeFile', 'concat.txt', 
        new TextEncoder().encode("file 'intro_ready.mp4'\nfile 'main_ready.mp4'\n"));
    
    await ffmpeg.run(
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        'output.mp4'
    );
}

async function mixBgm() {
    // v2.3.0: bgmVolume 슬라이더 값 사용
    await ffmpeg.run(
        '-i', 'output.mp4',
        '-stream_loop', '-1',
        '-i', 'bgm.mp3',
        '-t', String(OUTPUT.targetDur),
        '-filter_complex',
        `[0:a]volume=1[a1];[1:a]volume=${bgmVolume.toFixed(2)}[a2];[a1][a2]amix=inputs=2:duration=first`,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        'final.mp4'
    );

    ffmpeg.FS('rename', 'final.mp4', 'output.mp4');
}

async function showResult() {
    const data = ffmpeg.FS('readFile', 'output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    showResultBlob(blob);
}

function showResultBlob(blob) {
    const url = URL.createObjectURL(blob);
    const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
    
    el('preview').src = url;
    el('dlLink').href = url;
    el('dlLink').download = `lecture_shorts_${Date.now()}.mp4`;
    
    // 파일 크기 표시
    setStatus(`✅ 완료! (${sizeMB}MB)`);
    
    show('result');
    hide('step5');
}

/* ========== UTILITIES ========== */
function el(id) { return document.getElementById(id); }
function show(id) { el(id).style.display = 'block'; }
function hide(id) { el(id).style.display = 'none'; }

function showInfo(id, html, cls) {
    const e = el(id);
    e.innerHTML = html;
    e.className = 'file-info show ' + (cls || '');
}

function setStatus(msg, isErr) {
    const e = el('status');
    e.textContent = msg;
    e.className = 'status' + (isErr ? ' error' : '');
}

function setProg(pct) {
    el('progFill').style.width = pct + '%';
    el('progText').textContent = pct + '%';
}

function fmtDur(sec) {
    return `${Math.floor(sec/60)}분 ${Math.floor(sec%60)}초`;
}

async function getVidMeta(file) {
    return new Promise((resolve, reject) => {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.onloadedmetadata = () => {
            resolve({ dur: vid.duration, w: vid.videoWidth, h: vid.videoHeight });
            URL.revokeObjectURL(vid.src);
        };
        vid.onerror = () => reject(new Error('로드 실패'));
        vid.src = URL.createObjectURL(file);
    });
}

function reset() {
    vidFile = introFile = bgmFile = preset = null;
    vidMeta = introMeta = { dur: 0, w: 0, h: 0 };

    el('vidIn').value = el('introIn').value = el('bgmIn').value = '';
    el('vidInfo').className = el('introInfo').className = el('bgmInfo').className = 'file-info';
    el('vidInfo').innerHTML = el('introInfo').innerHTML = el('bgmInfo').innerHTML = '';

    // v2.3.0: BGM 볼륨 초기화
    hide('bgmVolControl');
    bgmVolume = 0.1;
    el('bgmVolSlider').value = 10;
    el('bgmVolValue').textContent = '10%';
    if (bgmPreviewAudio) {
        bgmPreviewAudio.pause();
        bgmPreviewAudio = null;
    }
    el('bgmPreviewBtn').textContent = '▶️ 미리듣기';

    setPreset(null);
    hide('result');
    hide('progress');
    show('step5');
    el('genBtn').disabled = true;
    setStatus('');
    setProg(0);

    // v2.2.0: 백그라운드 보호 해제
    isProcessing = false;
    processingAborted = false;
    releaseWakeLock();
    stopSilentAudio();
    showBackgroundWarning(false);
}

// v2.2.0: 작업 중단
function abortProcessing() {
    processingAborted = true;
    setStatus('⏸️ 중단 중...');
}
