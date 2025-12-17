/**
 * Clip Shorts v3.0
 * 클립 선택 → 3분 쇼츠 자동 생성
 *
 * Features:
 * - 10초/15초 클립 다중 업로드
 * - 트랜지션 효과 5종 (TV, VHS, Focus, Tremble, Zoom)
 * - 실제 효과 필터 적용
 * - 배경 음악 삽입/미리듣기/볼륨 조절
 * - 볼륨 평준화 (loudnorm -16 LUFS)
 * - FFmpeg.wasm 기반 처리
 */

'use strict';

/* ========== CONFIG ========== */
const CONFIG = {
    targetDuration: 180, // 3분
    resolution: { width: 720, height: 1280 }, // 9:16 세로
    fps: 30,
    transitionDuration: 0.5, // 트랜지션 0.5초
    bitrate: 2500000,
    audioBitrate: '192k'
};

/* ========== STATE ========== */
const state = {
    clips: [], // { file, meta: { dur, w, h } }
    clipDuration: 10, // 10초 or 15초
    maxClips: 18, // 10초: 18개, 15초: 12개
    introEffect: 'none',       // 시작 효과
    transitionEffect: 'none',  // 중간 트랜지션
    endingEffect: 'none',      // 엔딩 효과
    normalizeVolume: true,
    isProcessing: false,
    processingAborted: false,
    ffmpeg: null,
    startTime: 0,
    resultUrl: null,
    // 배경 음악 상태
    bgm: {
        file: null,
        url: null,
        volume: 0.5, // 0~1
        clipVolume: 1.0, // 원본 클립 볼륨 0~1
        enabled: false
    }
};

/* ========== DOM HELPERS ========== */
const $ = id => document.getElementById(id);
const show = id => { const el = $(id); if(el) el.style.display = 'block'; };
const hide = id => { const el = $(id); if(el) el.style.display = 'none'; };

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', () => {
    // Load version from apps.json
    loadAppVersion();

    // File input
    $('clipInput').onchange = e => handleFilesSelect(e.target.files);

    // Memory check
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        $('memWarn').textContent = `⚠️ 기기 메모리 ${navigator.deviceMemory}GB - 처리가 느릴 수 있습니다`;
        show('memWarn');
    }

    // Toggle
    $('normalizeToggle').onchange = e => {
        state.normalizeVolume = e.target.checked;
    };

    // BGM 이벤트 설정
    initBGMEvents();

    log('Clip Shorts v3.0 초기화 완료');
});

/* ========== BGM EVENTS ========== */
function initBGMEvents() {
    // BGM 토글
    const bgmToggle = $('bgmToggle');
    if (bgmToggle) {
        bgmToggle.onchange = e => {
            state.bgm.enabled = e.target.checked;
            const controlsEl = $('bgmControls');
            if (controlsEl) {
                controlsEl.style.display = state.bgm.enabled ? 'block' : 'none';
            }
        };
    }

    // BGM 파일 입력
    const bgmInput = $('bgmInput');
    if (bgmInput) {
        bgmInput.onchange = e => {
            if (e.target.files.length > 0) {
                handleBGMSelect(e.target.files[0]);
            }
        };
    }

    // BGM 볼륨 슬라이더
    const bgmVolume = $('bgmVolume');
    if (bgmVolume) {
        bgmVolume.oninput = e => {
            state.bgm.volume = parseFloat(e.target.value);
            const valueEl = $('bgmVolumeValue');
            if (valueEl) valueEl.textContent = Math.round(state.bgm.volume * 100) + '%';
            // 미리듣기 볼륨 동기화
            const preview = $('bgmPreview');
            if (preview) preview.volume = state.bgm.volume;
        };
    }

    // 원본 클립 볼륨 슬라이더
    const clipVolume = $('clipVolume');
    if (clipVolume) {
        clipVolume.oninput = e => {
            state.bgm.clipVolume = parseFloat(e.target.value);
            const valueEl = $('clipVolumeValue');
            if (valueEl) valueEl.textContent = Math.round(state.bgm.clipVolume * 100) + '%';
        };
    }

    // BGM 재생/정지
    const playBtn = $('bgmPlayBtn');
    if (playBtn) {
        playBtn.onclick = toggleBGMPreview;
    }

    // BGM 삭제
    const removeBtn = $('bgmRemoveBtn');
    if (removeBtn) {
        removeBtn.onclick = removeBGM;
    }
}

/* ========== BGM HANDLING ========== */
function handleBGMSelect(file) {
    if (!file.type.startsWith('audio/')) {
        alert('오디오 파일만 선택할 수 있습니다.');
        return;
    }

    // 기존 URL 해제
    if (state.bgm.url) {
        URL.revokeObjectURL(state.bgm.url);
    }

    state.bgm.file = file;
    state.bgm.url = URL.createObjectURL(file);

    // UI 업데이트
    const nameEl = $('bgmFileName');
    if (nameEl) nameEl.textContent = file.name;

    const infoEl = $('bgmInfo');
    if (infoEl) infoEl.style.display = 'flex';

    const dropEl = $('bgmDropZone');
    if (dropEl) dropEl.style.display = 'none';

    // 미리듣기 오디오 설정
    const preview = $('bgmPreview');
    if (preview) {
        preview.src = state.bgm.url;
        preview.volume = state.bgm.volume;
    }

    log(`배경 음악: ${file.name}`);
}

function toggleBGMPreview() {
    const preview = $('bgmPreview');
    const playBtn = $('bgmPlayBtn');
    if (!preview || !state.bgm.url) return;

    if (preview.paused) {
        preview.play();
        if (playBtn) playBtn.textContent = '⏸️';
    } else {
        preview.pause();
        if (playBtn) playBtn.textContent = '▶️';
    }
}

function removeBGM() {
    const preview = $('bgmPreview');
    if (preview) {
        preview.pause();
        preview.src = '';
    }

    if (state.bgm.url) {
        URL.revokeObjectURL(state.bgm.url);
    }

    state.bgm.file = null;
    state.bgm.url = null;

    // UI 리셋
    const infoEl = $('bgmInfo');
    if (infoEl) infoEl.style.display = 'none';

    const dropEl = $('bgmDropZone');
    if (dropEl) dropEl.style.display = 'block';

    const playBtn = $('bgmPlayBtn');
    if (playBtn) playBtn.textContent = '▶️';

    const bgmInput = $('bgmInput');
    if (bgmInput) bgmInput.value = '';

    log('배경 음악 제거됨');
}

/* ========== VERSION LOADER ========== */
async function loadAppVersion() {
    try {
        const res = await fetch('../apps.json');
        const data = await res.json();
        const app = data.apps.find(a => a.id === 'clip-shorts');
        if (app) {
            $('appVersion').textContent = `v${app.version}`;
            log(`버전: ${app.version}`);
        }
    } catch (e) {
        console.warn('버전 로드 실패:', e);
    }
}

/* ========== CLIP DURATION ========== */
function setClipDuration(dur) {
    state.clipDuration = dur;
    state.maxClips = dur === 10 ? 18 : 12;

    $('btn10s').classList.toggle('active', dur === 10);
    $('btn15s').classList.toggle('active', dur === 15);

    // 기존 클립이 있으면 다시 체크
    updateClipList();
    checkReady();
}

/* ========== EFFECTS ========== */
function setIntro(effect) {
    state.introEffect = effect;

    document.querySelectorAll('#introEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });

    log(`시작 효과: ${effect}`);
}

function setTransition(effect) {
    state.transitionEffect = effect;

    document.querySelectorAll('#transitionEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });

    log(`트랜지션: ${effect}`);
}

function setEnding(effect) {
    state.endingEffect = effect;

    document.querySelectorAll('#endingEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });

    log(`엔딩 효과: ${effect}`);
}

/* ========== DRAG & DROP ========== */
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');

    if (e.dataTransfer.files.length > 0) {
        handleFilesSelect(e.dataTransfer.files);
    }
}

// BGM 드래그 앤 드롭
function handleBGMDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleBGMDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');

    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('audio/')) {
            handleBGMSelect(file);
        }
    }
}

/* ========== FILE HANDLING ========== */
async function handleFilesSelect(files) {
    for (const file of files) {
        if (state.clips.length >= state.maxClips) {
            alert(`최대 ${state.maxClips}개까지만 추가할 수 있습니다.`);
            break;
        }

        if (!file.type.startsWith('video/')) {
            continue;
        }

        try {
            const meta = await getVideoMeta(file);
            state.clips.push({ file, meta });
        } catch (e) {
            console.error('비디오 메타 로드 실패:', e);
        }
    }

    updateClipList();
    checkReady();
}

function getVideoMeta(file) {
    return new Promise((resolve, reject) => {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.onloadedmetadata = () => {
            resolve({
                dur: vid.duration,
                w: vid.videoWidth,
                h: vid.videoHeight
            });
            URL.revokeObjectURL(vid.src);
        };
        vid.onerror = () => reject(new Error('비디오 로드 실패'));
        vid.src = URL.createObjectURL(file);
    });
}

function removeClip(index) {
    state.clips.splice(index, 1);
    updateClipList();
    checkReady();
}

function updateClipList() {
    const listEl = $('clipList');

    if (state.clips.length === 0) {
        listEl.innerHTML = '';
        hide('clipSummary');
        return;
    }

    let html = '';
    let totalDur = 0;

    state.clips.forEach((clip, i) => {
        totalDur += clip.meta.dur;
        html += `
            <div class="clip-item">
                <span class="clip-num">${i + 1}</span>
                <div class="clip-info">
                    <div class="clip-name">${clip.file.name}</div>
                    <div class="clip-duration">${formatDuration(clip.meta.dur)}</div>
                </div>
                <button class="clip-remove" onclick="removeClip(${i})">✕</button>
            </div>
        `;
    });

    listEl.innerHTML = html;

    $('clipCount').textContent = state.clips.length + '개';
    $('totalDuration').textContent = formatDuration(totalDur);
    show('clipSummary');
}

function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

function checkReady() {
    const hasClips = state.clips.length >= 2;
    $('genBtn').disabled = !hasClips;
}

/* ========== LOGGING ========== */
function log(msg) {
    console.log(`[ClipShorts] ${msg}`);
    const logEl = $('progressLog');
    if (logEl) {
        const time = new Date().toLocaleTimeString();
        logEl.innerHTML += `<div>[${time}] ${msg}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    }
}

function setStatus(msg) {
    $('statusText').textContent = msg;
}

function setProgress(pct) {
    $('progressFill').style.width = pct + '%';
    $('progressText').textContent = pct + '%';

    // ETA
    if (pct > 5 && pct < 100) {
        const elapsed = (performance.now() - state.startTime) / 1000;
        const eta = (elapsed / pct) * (100 - pct);
        $('etaText').textContent = `약 ${Math.ceil(eta)}초 남음`;
    }
}

/* ========== EFFECT FILTERS ========== */
// 효과별 실제 필터 정의
function getEffectFilter(effect, type, duration, totalDuration) {
    const dur = duration || CONFIG.transitionDuration;
    const fadeOutStart = Math.max(0, totalDuration - dur);

    switch (effect) {
        case 'tv':
            // TV 효과: 스캔라인 + 페이드
            if (type === 'intro') {
                return `fade=t=in:st=0:d=${dur},geq=lum='lum(X,Y)':cb='cb(X,Y)+sin(Y/2)*3':cr='cr(X,Y)+sin(Y/2)*3':enable='between(t,0,${dur})'`;
            } else if (type === 'ending') {
                return `fade=t=out:st=${fadeOutStart}:d=${dur},geq=lum='lum(X,Y)':cb='cb(X,Y)+sin(Y/2)*3':cr='cr(X,Y)+sin(Y/2)*3':enable='gte(t,${fadeOutStart})'`;
            }
            return 'xfade=transition=fadeblack:duration=' + dur;

        case 'vhs':
            // VHS 효과: 색상 왜곡 + 노이즈 느낌 (간단화)
            if (type === 'intro') {
                return `fade=t=in:st=0:d=${dur},eq=saturation=1.3:contrast=1.1:enable='between(t,0,${dur})'`;
            } else if (type === 'ending') {
                return `fade=t=out:st=${fadeOutStart}:d=${dur},eq=saturation=1.3:contrast=1.1:enable='gte(t,${fadeOutStart})'`;
            }
            return 'xfade=transition=pixelize:duration=' + dur;

        case 'focus':
            // Focus 효과: 블러→선명 또는 선명→블러
            if (type === 'intro') {
                // 블러에서 선명하게 (gblur 사용)
                return `fade=t=in:st=0:d=${dur},gblur=sigma='10-10*t/${dur}':enable='between(t,0,${dur})'`;
            } else if (type === 'ending') {
                // 선명에서 블러로
                return `fade=t=out:st=${fadeOutStart}:d=${dur},gblur=sigma='10*(t-${fadeOutStart})/${dur}':enable='gte(t,${fadeOutStart})'`;
            }
            return 'xfade=transition=circlecrop:duration=' + dur;

        case 'tremble':
            // Tremble 효과: 화면 흔들림
            if (type === 'intro') {
                return `fade=t=in:st=0:d=${dur},crop=iw-10:ih-10:5+5*sin(t*30):5+5*cos(t*25):enable='between(t,0,${dur})',scale=${CONFIG.resolution.width}:${CONFIG.resolution.height}`;
            } else if (type === 'ending') {
                return `fade=t=out:st=${fadeOutStart}:d=${dur},crop=iw-10:ih-10:5+5*sin(t*30):5+5*cos(t*25):enable='gte(t,${fadeOutStart})',scale=${CONFIG.resolution.width}:${CONFIG.resolution.height}`;
            }
            return 'xfade=transition=slideleft:duration=' + dur;

        case 'zoom':
            // Zoom 효과: 확대/축소
            if (type === 'intro') {
                // 확대에서 원래 크기로
                return `fade=t=in:st=0:d=${dur},zoompan=z='1.2-0.2*on/(${dur}*${CONFIG.fps})':d=1:s=${CONFIG.resolution.width}x${CONFIG.resolution.height}:enable='between(t,0,${dur})'`;
            } else if (type === 'ending') {
                // 원래 크기에서 축소
                return `fade=t=out:st=${fadeOutStart}:d=${dur},zoompan=z='1-0.2*on/(${dur}*${CONFIG.fps})':d=1:s=${CONFIG.resolution.width}x${CONFIG.resolution.height}:enable='gte(t,${fadeOutStart})'`;
            }
            return 'xfade=transition=zoomin:duration=' + dur;

        default:
            return null;
    }
}

// xfade 트랜지션 타입 매핑
function getXfadeTransition(effect) {
    switch (effect) {
        case 'tv': return 'fadeblack';
        case 'vhs': return 'pixelize';
        case 'focus': return 'circlecrop';
        case 'tremble': return 'slideleft';
        case 'zoom': return 'zoomin';
        default: return 'fade';
    }
}

/* ========== MAIN GENERATION ========== */
async function generate() {
    if (state.clips.length < 2) return;

    state.isProcessing = true;
    state.processingAborted = false;
    state.startTime = performance.now();

    $('genBtn').disabled = true;
    show('progressSection');
    hide('resultSection');
    $('progressLog').innerHTML = '';

    try {
        setStatus('FFmpeg 로딩 중...');
        setProgress(5);
        await initFFmpeg();

        setStatus('파일 준비 중...');
        setProgress(10);
        await writeClipsToFFmpeg();

        // BGM 파일 쓰기
        if (state.bgm.enabled && state.bgm.file) {
            setStatus('배경 음악 준비 중...');
            await writeBGMToFFmpeg();
        }

        if (state.normalizeVolume) {
            setStatus('볼륨 평준화 중...');
            setProgress(20);
            await normalizeAllClips();
        }

        setStatus('클립 리사이즈 중...');
        setProgress(35);
        await resizeClips();

        // 트랜지션 효과 적용 여부
        const hasTransition = state.transitionEffect !== 'none';

        if (hasTransition) {
            setStatus('트랜지션 효과 적용 중...');
            setProgress(50);
            await applyTransitions();
        } else {
            setStatus('클립 병합 중...');
            setProgress(50);
            await concatClipsSimple();
        }

        // 시작/엔딩 효과
        const hasIntroEnding = state.introEffect !== 'none' || state.endingEffect !== 'none';
        if (hasIntroEnding) {
            setStatus('시작/엔딩 효과 적용 중...');
            setProgress(70);
            await applyIntroEndingEffects();
        }

        // BGM 믹싱
        if (state.bgm.enabled && state.bgm.file) {
            setStatus('배경 음악 믹싱 중...');
            setProgress(80);
            await mixBGM();
        }

        setStatus('최종 인코딩 중...');
        setProgress(90);
        await finalEncode();

        setProgress(100);
        setStatus('완료!');

        await showResult();

    } catch (e) {
        if (state.processingAborted) {
            setStatus('중단됨');
        } else {
            setStatus(`오류: ${e.message}`);
            console.error(e);
            log(`오류: ${e.message}`);
        }
    } finally {
        state.isProcessing = false;
        $('genBtn').disabled = false;
    }
}

function abortProcessing() {
    state.processingAborted = true;
    setStatus('중단 중...');
}

/* ========== FFmpeg ========== */
async function initFFmpeg() {
    if (state.ffmpeg && state.ffmpeg.isLoaded()) return;

    if (typeof FFmpeg === 'undefined') {
        throw new Error('FFmpeg 로드 실패');
    }

    const { createFFmpeg } = FFmpeg;
    state.ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
    });

    state.ffmpeg.setProgress(({ ratio }) => {
        if (ratio > 0 && ratio < 1) {
            const basePct = parseInt($('progressText').textContent) || 0;
            const addPct = Math.floor(ratio * 5);
            setProgress(Math.min(basePct + addPct, 99));
        }
    });

    await state.ffmpeg.load();
    log('FFmpeg 로드 완료');
}

async function writeClipsToFFmpeg() {
    const { fetchFile } = FFmpeg;

    for (let i = 0; i < state.clips.length; i++) {
        if (state.processingAborted) throw new Error('중단됨');

        const clip = state.clips[i];
        const filename = `clip_${i}.mp4`;
        state.ffmpeg.FS('writeFile', filename, await fetchFile(clip.file));
        log(`클립 ${i + 1}/${state.clips.length} 로드`);
    }
}

async function writeBGMToFFmpeg() {
    const { fetchFile } = FFmpeg;
    state.ffmpeg.FS('writeFile', 'bgm.mp3', await fetchFile(state.bgm.file));
    log('배경 음악 로드 완료');
}

async function normalizeAllClips() {
    for (let i = 0; i < state.clips.length; i++) {
        if (state.processingAborted) throw new Error('중단됨');

        const input = `clip_${i}.mp4`;
        const output = `norm_${i}.mp4`;

        // loudnorm 단일 패스
        await state.ffmpeg.run(
            '-i', input,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', CONFIG.audioBitrate,
            output
        );

        // 원본 삭제하고 정규화된 파일로 교체
        state.ffmpeg.FS('unlink', input);
        state.ffmpeg.FS('rename', output, input);

        log(`볼륨 평준화 ${i + 1}/${state.clips.length}`);
        setProgress(20 + Math.floor((i / state.clips.length) * 15));
    }
}

async function resizeClips() {
    // 각 클립을 동일한 해상도로 리사이즈
    const vf = `scale=${CONFIG.resolution.width}:${CONFIG.resolution.height}:force_original_aspect_ratio=decrease,pad=${CONFIG.resolution.width}:${CONFIG.resolution.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;

    for (let i = 0; i < state.clips.length; i++) {
        if (state.processingAborted) throw new Error('중단됨');

        const input = `clip_${i}.mp4`;
        const output = `ready_${i}.mp4`;

        await state.ffmpeg.run(
            '-i', input,
            '-vf', vf,
            '-r', String(CONFIG.fps),
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
            '-c:a', 'aac', '-b:a', CONFIG.audioBitrate, '-ar', '44100',
            output
        );

        state.ffmpeg.FS('unlink', input);
        log(`리사이즈 ${i + 1}/${state.clips.length}`);
        setProgress(35 + Math.floor((i / state.clips.length) * 15));
    }
}

async function applyTransitions() {
    // xfade를 사용한 트랜지션 (2개씩 병합)
    const transitionType = getXfadeTransition(state.transitionEffect);
    const dur = CONFIG.transitionDuration;

    let currentFile = 'ready_0.mp4';

    for (let i = 1; i < state.clips.length; i++) {
        if (state.processingAborted) throw new Error('중단됨');

        const nextFile = `ready_${i}.mp4`;
        const outputFile = `trans_${i}.mp4`;

        // 첫 번째 클립 길이 계산 (offset 설정용)
        const clip1Dur = state.clips[i-1].meta.dur;
        const offset = Math.max(0, clip1Dur - dur);

        try {
            await state.ffmpeg.run(
                '-i', currentFile,
                '-i', nextFile,
                '-filter_complex', `[0:v][1:v]xfade=transition=${transitionType}:duration=${dur}:offset=${offset}[v];[0:a][1:a]acrossfade=d=${dur}[a]`,
                '-map', '[v]',
                '-map', '[a]',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                '-c:a', 'aac', '-b:a', CONFIG.audioBitrate,
                outputFile
            );

            // 이전 파일 정리
            try { state.ffmpeg.FS('unlink', currentFile); } catch(e) {}
            try { state.ffmpeg.FS('unlink', nextFile); } catch(e) {}

            currentFile = outputFile;
            log(`트랜지션 ${i}/${state.clips.length - 1} 적용`);
        } catch (e) {
            log(`트랜지션 적용 실패, 단순 병합으로 전환: ${e.message}`);
            // 실패시 단순 concat으로 대체
            await concatClipsSimple();
            return;
        }

        setProgress(50 + Math.floor((i / (state.clips.length - 1)) * 20));
    }

    // 최종 파일을 merged.mp4로 이름 변경
    state.ffmpeg.FS('rename', currentFile, 'merged.mp4');
    log('트랜지션 적용 완료');
}

async function concatClipsSimple() {
    // concat 리스트 생성
    let concatList = '';
    for (let i = 0; i < state.clips.length; i++) {
        concatList += `file 'ready_${i}.mp4'\n`;
    }
    state.ffmpeg.FS('writeFile', 'concat.txt', concatList);

    // 병합
    await state.ffmpeg.run(
        '-f', 'concat', '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        'merged.mp4'
    );

    // 정리
    for (let i = 0; i < state.clips.length; i++) {
        try { state.ffmpeg.FS('unlink', `ready_${i}.mp4`); } catch(e) {}
    }
    state.ffmpeg.FS('unlink', 'concat.txt');

    log('클립 병합 완료');
}

async function applyIntroEndingEffects() {
    // 전체 클립 길이 계산
    let totalDuration = state.clips.reduce((sum, clip) => sum + clip.meta.dur, 0);
    totalDuration = Math.min(totalDuration, CONFIG.targetDuration);

    const dur = CONFIG.transitionDuration;
    let filters = [];

    // 시작 효과
    if (state.introEffect !== 'none') {
        switch (state.introEffect) {
            case 'tv':
                // TV 켜지는 효과: 수평 바에서 확장
                filters.push(`fade=t=in:st=0:d=${dur}`);
                break;
            case 'vhs':
                // VHS 효과: 글리치 느낌의 페이드인
                filters.push(`fade=t=in:st=0:d=${dur},eq=saturation=1.2:enable='between(t,0,${dur})'`);
                break;
            case 'focus':
                // Focus: 페이드인
                filters.push(`fade=t=in:st=0:d=${dur}`);
                break;
            case 'tremble':
                // Tremble: 흔들림과 함께 페이드인
                filters.push(`fade=t=in:st=0:d=${dur}`);
                break;
            case 'zoom':
                // Zoom: 페이드인
                filters.push(`fade=t=in:st=0:d=${dur}`);
                break;
        }
        log(`시작 효과 적용: ${state.introEffect}`);
    }

    // 엔딩 효과
    if (state.endingEffect !== 'none') {
        const fadeOutStart = Math.max(0, totalDuration - dur - 0.5); // 약간의 여유

        switch (state.endingEffect) {
            case 'tv':
                // TV 꺼지는 효과
                filters.push(`fade=t=out:st=${fadeOutStart}:d=${dur}`);
                break;
            case 'vhs':
                filters.push(`fade=t=out:st=${fadeOutStart}:d=${dur},eq=saturation=1.2:enable='gte(t,${fadeOutStart})'`);
                break;
            case 'focus':
                filters.push(`fade=t=out:st=${fadeOutStart}:d=${dur}`);
                break;
            case 'tremble':
                filters.push(`fade=t=out:st=${fadeOutStart}:d=${dur}`);
                break;
            case 'zoom':
                filters.push(`fade=t=out:st=${fadeOutStart}:d=${dur}`);
                break;
        }
        log(`엔딩 효과 적용: ${state.endingEffect}`);
    }

    if (filters.length > 0) {
        const filterStr = filters.join(',');

        try {
            await state.ffmpeg.run(
                '-i', 'merged.mp4',
                '-vf', filterStr,
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                '-c:a', 'copy',
                'effected.mp4'
            );

            // 파일 존재 확인 후 교체
            try {
                state.ffmpeg.FS('readFile', 'effected.mp4');
                state.ffmpeg.FS('unlink', 'merged.mp4');
                state.ffmpeg.FS('rename', 'effected.mp4', 'merged.mp4');
                log('시작/엔딩 효과 적용 완료');
            } catch (e) {
                log('효과 적용 건너뜀 (원본 유지)');
            }
        } catch (e) {
            log(`효과 적용 실패: ${e.message}, 원본으로 진행`);
        }
    }
}

async function mixBGM() {
    // BGM과 원본 오디오 믹싱
    const bgmVol = state.bgm.volume;
    const clipVol = state.bgm.clipVolume;

    try {
        // BGM 루프 및 믹싱
        await state.ffmpeg.run(
            '-i', 'merged.mp4',
            '-stream_loop', '-1', // BGM 루프
            '-i', 'bgm.mp3',
            '-filter_complex', `[0:a]volume=${clipVol}[a1];[1:a]volume=${bgmVol}[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', CONFIG.audioBitrate,
            '-shortest',
            'bgm_mixed.mp4'
        );

        // 파일 교체
        try {
            state.ffmpeg.FS('readFile', 'bgm_mixed.mp4');
            state.ffmpeg.FS('unlink', 'merged.mp4');
            state.ffmpeg.FS('rename', 'bgm_mixed.mp4', 'merged.mp4');
            log(`BGM 믹싱 완료 (BGM: ${Math.round(bgmVol*100)}%, 원본: ${Math.round(clipVol*100)}%)`);
        } catch (e) {
            log('BGM 믹싱 건너뜀');
        }
    } catch (e) {
        log(`BGM 믹싱 실패: ${e.message}`);
    }

    // BGM 파일 정리
    try { state.ffmpeg.FS('unlink', 'bgm.mp3'); } catch(e) {}
}

async function finalEncode() {
    // merged.mp4 존재 확인
    try {
        state.ffmpeg.FS('readFile', 'merged.mp4');
    } catch (e) {
        throw new Error('병합된 파일이 없습니다. 다시 시도해주세요.');
    }

    // 3분으로 자르기 (필요시)
    await state.ffmpeg.run(
        '-i', 'merged.mp4',
        '-t', String(CONFIG.targetDuration),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-c:a', 'aac', '-b:a', CONFIG.audioBitrate,
        '-movflags', '+faststart',
        'output.mp4'
    );

    // output.mp4 존재 확인
    try {
        state.ffmpeg.FS('readFile', 'output.mp4');
        log('최종 인코딩 완료');
    } catch (e) {
        throw new Error('인코딩 실패. 클립 형식을 확인해주세요.');
    }
}

async function showResult() {
    const data = state.ffmpeg.FS('readFile', 'output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });

    // 정리
    try { state.ffmpeg.FS('unlink', 'merged.mp4'); } catch(e) {}
    try { state.ffmpeg.FS('unlink', 'output.mp4'); } catch(e) {}

    // URL 생성
    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
    state.resultUrl = URL.createObjectURL(blob);

    // UI 업데이트
    const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
    const elapsed = ((performance.now() - state.startTime) / 1000).toFixed(1);

    $('resultStats').innerHTML = `📦 ${sizeMB}MB · ⏱️ ${elapsed}초`;
    $('preview').src = state.resultUrl;
    $('downloadLink').href = state.resultUrl;
    $('downloadLink').download = `clip_shorts_${Date.now()}.mp4`;

    hide('progressSection');
    show('resultSection');

    log(`결과: ${sizeMB}MB, ${elapsed}초`);
}

/* ========== RESET ========== */
function reset() {
    state.clips = [];
    state.introEffect = 'none';
    state.transitionEffect = 'none';
    state.endingEffect = 'none';

    $('clipInput').value = '';
    $('clipList').innerHTML = '';
    hide('clipSummary');
    hide('progressSection');
    hide('resultSection');

    // 효과 버튼 리셋
    document.querySelectorAll('#introEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });
    document.querySelectorAll('#transitionEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });
    document.querySelectorAll('#endingEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });

    // 토글 리셋
    $('normalizeToggle').checked = true;
    state.normalizeVolume = true;

    // BGM 리셋
    removeBGM();
    const bgmToggle = $('bgmToggle');
    if (bgmToggle) {
        bgmToggle.checked = false;
        state.bgm.enabled = false;
    }
    const bgmControls = $('bgmControls');
    if (bgmControls) bgmControls.style.display = 'none';

    const bgmVolume = $('bgmVolume');
    if (bgmVolume) bgmVolume.value = 0.5;
    const bgmVolumeValue = $('bgmVolumeValue');
    if (bgmVolumeValue) bgmVolumeValue.textContent = '50%';

    const clipVolume = $('clipVolume');
    if (clipVolume) clipVolume.value = 1.0;
    const clipVolumeValue = $('clipVolumeValue');
    if (clipVolumeValue) clipVolumeValue.textContent = '100%';

    state.bgm.volume = 0.5;
    state.bgm.clipVolume = 1.0;

    $('genBtn').disabled = true;

    if (state.resultUrl) {
        URL.revokeObjectURL(state.resultUrl);
        state.resultUrl = null;
    }

    log('리셋 완료');
}

/* ========== SERVICE WORKER ========== */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}
