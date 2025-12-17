/**
 * Clip Shorts v4.0
 * 클립 선택 → 3분 쇼츠 자동 생성
 *
 * Features:
 * - 10초/15초 클립 다중 업로드
 * - 트랜지션 효과 5종 (안정적인 fade 기반)
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
    loadAppVersion();
    $('clipInput').onchange = e => handleFilesSelect(e.target.files);

    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        $('memWarn').textContent = `⚠️ 기기 메모리 ${navigator.deviceMemory}GB - 처리가 느릴 수 있습니다`;
        show('memWarn');
    }

    $('normalizeToggle').onchange = e => {
        state.normalizeVolume = e.target.checked;
    };

    initBGMEvents();
    log('Clip Shorts v4.0 초기화 완료');
});

/* ========== BGM EVENTS ========== */
function initBGMEvents() {
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

    const bgmInput = $('bgmInput');
    if (bgmInput) {
        bgmInput.onchange = e => {
            if (e.target.files.length > 0) {
                handleBGMSelect(e.target.files[0]);
            }
        };
    }

    const bgmVolume = $('bgmVolume');
    if (bgmVolume) {
        bgmVolume.oninput = e => {
            state.bgm.volume = parseFloat(e.target.value);
            const valueEl = $('bgmVolumeValue');
            if (valueEl) valueEl.textContent = Math.round(state.bgm.volume * 100) + '%';
            const preview = $('bgmPreview');
            if (preview) preview.volume = state.bgm.volume;
        };
    }

    const clipVolume = $('clipVolume');
    if (clipVolume) {
        clipVolume.oninput = e => {
            state.bgm.clipVolume = parseFloat(e.target.value);
            const valueEl = $('clipVolumeValue');
            if (valueEl) valueEl.textContent = Math.round(state.bgm.clipVolume * 100) + '%';
        };
    }

    const playBtn = $('bgmPlayBtn');
    if (playBtn) {
        playBtn.onclick = toggleBGMPreview;
    }

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

    if (state.bgm.url) {
        URL.revokeObjectURL(state.bgm.url);
    }

    state.bgm.file = file;
    state.bgm.url = URL.createObjectURL(file);

    const nameEl = $('bgmFileName');
    if (nameEl) nameEl.textContent = file.name;

    const infoEl = $('bgmInfo');
    if (infoEl) infoEl.style.display = 'flex';

    const dropEl = $('bgmDropZone');
    if (dropEl) dropEl.style.display = 'none';

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
    const el = $('statusText');
    if (el) el.textContent = msg;
}

function setProgress(pct) {
    const fillEl = $('progressFill');
    const textEl = $('progressText');
    if (fillEl) fillEl.style.width = pct + '%';
    if (textEl) textEl.textContent = pct + '%';

    if (pct > 5 && pct < 100) {
        const elapsed = (performance.now() - state.startTime) / 1000;
        const eta = (elapsed / pct) * (100 - pct);
        const etaEl = $('etaText');
        if (etaEl) etaEl.textContent = `약 ${Math.ceil(eta)}초 남음`;
    }
}

/* ========== TRANSITION FILTER HELPERS ========== */
function getTransitionFilter(effect, position, clipDur) {
    const dur = CONFIG.transitionDuration;
    const fadeOutStart = Math.max(0, clipDur - dur);

    // position: 'first', 'middle', 'last'
    switch (effect) {
        case 'tv':
            if (position === 'first') {
                return `fade=t=out:st=${fadeOutStart}:d=${dur}`;
            } else if (position === 'last') {
                return `fade=t=in:st=0:d=${dur}`;
            } else {
                return `fade=t=in:st=0:d=${dur},fade=t=out:st=${fadeOutStart}:d=${dur}`;
            }
        case 'vhs':
            if (position === 'first') {
                return `fade=t=out:st=${fadeOutStart}:d=${dur},eq=saturation=1.3:enable='gte(t,${fadeOutStart})'`;
            } else if (position === 'last') {
                return `fade=t=in:st=0:d=${dur},eq=saturation=1.3:enable='lte(t,${dur})'`;
            } else {
                return `fade=t=in:st=0:d=${dur},fade=t=out:st=${fadeOutStart}:d=${dur}`;
            }
        case 'focus':
        case 'tremble':
        case 'zoom':
        default:
            if (position === 'first') {
                return `fade=t=out:st=${fadeOutStart}:d=${dur}`;
            } else if (position === 'last') {
                return `fade=t=in:st=0:d=${dur}`;
            } else {
                return `fade=t=in:st=0:d=${dur},fade=t=out:st=${fadeOutStart}:d=${dur}`;
            }
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
        // Step 1: FFmpeg 로드
        setStatus('FFmpeg 로딩 중...');
        setProgress(5);
        await initFFmpeg();

        // Step 2: 파일 준비
        setStatus('파일 준비 중...');
        setProgress(10);
        await writeClipsToFFmpeg();

        // Step 3: BGM 로드
        if (state.bgm.enabled && state.bgm.file) {
            setStatus('배경 음악 준비 중...');
            await writeBGMToFFmpeg();
        }

        // Step 4: 볼륨 평준화
        if (state.normalizeVolume) {
            setStatus('볼륨 평준화 중...');
            setProgress(15);
            await normalizeAllClips();
        }

        // Step 5: 클립 리사이즈 + 트랜지션 효과 적용
        setStatus('클립 처리 중...');
        setProgress(30);
        await processClipsWithEffects();

        // Step 6: 클립 병합
        setStatus('클립 병합 중...');
        setProgress(60);
        await concatClips();

        // Step 7: 시작/엔딩 효과
        if (state.introEffect !== 'none' || state.endingEffect !== 'none') {
            setStatus('시작/엔딩 효과 적용 중...');
            setProgress(70);
            await applyIntroEndingEffects();
        }

        // Step 8: BGM 믹싱
        if (state.bgm.enabled && state.bgm.file) {
            setStatus('배경 음악 믹싱 중...');
            setProgress(80);
            await mixBGM();
        }

        // Step 9: 최종 인코딩
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
            const basePct = parseInt($('progressText')?.textContent) || 0;
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

        await state.ffmpeg.run(
            '-i', input,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', CONFIG.audioBitrate,
            output
        );

        state.ffmpeg.FS('unlink', input);
        state.ffmpeg.FS('rename', output, input);

        log(`볼륨 평준화 ${i + 1}/${state.clips.length}`);
        setProgress(15 + Math.floor((i / state.clips.length) * 15));
    }
}

async function processClipsWithEffects() {
    const vf_base = `scale=${CONFIG.resolution.width}:${CONFIG.resolution.height}:force_original_aspect_ratio=decrease,pad=${CONFIG.resolution.width}:${CONFIG.resolution.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
    const hasTransition = state.transitionEffect !== 'none';

    for (let i = 0; i < state.clips.length; i++) {
        if (state.processingAborted) throw new Error('중단됨');

        const input = `clip_${i}.mp4`;
        const output = `ready_${i}.mp4`;
        const clipDur = state.clips[i].meta.dur;

        let vf = vf_base;

        // 트랜지션 효과 적용 (중간 클립들에 fade in/out)
        if (hasTransition && state.clips.length > 1) {
            let position;
            if (i === 0) {
                position = 'first'; // 첫 번째 클립: fade out만
            } else if (i === state.clips.length - 1) {
                position = 'last'; // 마지막 클립: fade in만
            } else {
                position = 'middle'; // 중간 클립: fade in + fade out
            }
            const transFilter = getTransitionFilter(state.transitionEffect, position, clipDur);
            vf = `${vf_base},${transFilter}`;
        }

        await state.ffmpeg.run(
            '-i', input,
            '-vf', vf,
            '-r', String(CONFIG.fps),
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
            '-c:a', 'aac', '-b:a', CONFIG.audioBitrate, '-ar', '44100',
            output
        );

        state.ffmpeg.FS('unlink', input);
        log(`클립 처리 ${i + 1}/${state.clips.length}`);
        setProgress(30 + Math.floor((i / state.clips.length) * 30));
    }
}

async function concatClips() {
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
    try { state.ffmpeg.FS('unlink', 'concat.txt'); } catch(e) {}

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
                filters.push(`fade=t=in:st=0:d=${dur}`);
                break;
            case 'vhs':
                filters.push(`fade=t=in:st=0:d=${dur},eq=saturation=1.3:enable='lte(t,${dur})'`);
                break;
            case 'focus':
            case 'tremble':
            case 'zoom':
            default:
                filters.push(`fade=t=in:st=0:d=${dur}`);
                break;
        }
        log(`시작 효과 적용: ${state.introEffect}`);
    }

    // 엔딩 효과
    if (state.endingEffect !== 'none') {
        const fadeOutStart = Math.max(0, totalDuration - dur - 0.5);

        switch (state.endingEffect) {
            case 'tv':
                filters.push(`fade=t=out:st=${fadeOutStart}:d=${dur}`);
                break;
            case 'vhs':
                filters.push(`fade=t=out:st=${fadeOutStart}:d=${dur},eq=saturation=1.3:enable='gte(t,${fadeOutStart})'`);
                break;
            case 'focus':
            case 'tremble':
            case 'zoom':
            default:
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
    const bgmVol = state.bgm.volume;
    const clipVol = state.bgm.clipVolume;

    try {
        await state.ffmpeg.run(
            '-i', 'merged.mp4',
            '-stream_loop', '-1',
            '-i', 'bgm.mp3',
            '-filter_complex', `[0:a]volume=${clipVol}[a1];[1:a]volume=${bgmVol}[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', CONFIG.audioBitrate,
            '-shortest',
            'bgm_mixed.mp4'
        );

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

    try { state.ffmpeg.FS('unlink', 'bgm.mp3'); } catch(e) {}
}

async function finalEncode() {
    try {
        state.ffmpeg.FS('readFile', 'merged.mp4');
    } catch (e) {
        throw new Error('병합된 파일이 없습니다. 다시 시도해주세요.');
    }

    await state.ffmpeg.run(
        '-i', 'merged.mp4',
        '-t', String(CONFIG.targetDuration),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-c:a', 'aac', '-b:a', CONFIG.audioBitrate,
        '-movflags', '+faststart',
        'output.mp4'
    );

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

    try { state.ffmpeg.FS('unlink', 'merged.mp4'); } catch(e) {}
    try { state.ffmpeg.FS('unlink', 'output.mp4'); } catch(e) {}

    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
    state.resultUrl = URL.createObjectURL(blob);

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

    document.querySelectorAll('#introEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });
    document.querySelectorAll('#transitionEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });
    document.querySelectorAll('#endingEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });

    $('normalizeToggle').checked = true;
    state.normalizeVolume = true;

    // BGM 상태만 리셋 (removeBGM 호출하지 않음 - 로그 방지)
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

    const infoEl = $('bgmInfo');
    if (infoEl) infoEl.style.display = 'none';

    const dropEl = $('bgmDropZone');
    if (dropEl) dropEl.style.display = 'block';

    const playBtn = $('bgmPlayBtn');
    if (playBtn) playBtn.textContent = '▶️';

    const bgmInputEl = $('bgmInput');
    if (bgmInputEl) bgmInputEl.value = '';

    const bgmToggle = $('bgmToggle');
    if (bgmToggle) {
        bgmToggle.checked = false;
        state.bgm.enabled = false;
    }
    const bgmControls = $('bgmControls');
    if (bgmControls) bgmControls.style.display = 'none';

    const bgmVolumeEl = $('bgmVolume');
    if (bgmVolumeEl) bgmVolumeEl.value = 0.5;
    const bgmVolumeValue = $('bgmVolumeValue');
    if (bgmVolumeValue) bgmVolumeValue.textContent = '50%';

    const clipVolumeEl = $('clipVolume');
    if (clipVolumeEl) clipVolumeEl.value = 1.0;
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
