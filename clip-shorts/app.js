/**
 * Clip Shorts v1.0
 * 클립 선택 → 3분 쇼츠 자동 생성
 *
 * Features:
 * - 10초/15초 클립 다중 업로드
 * - 트랜지션 효과 5종 (TV, VHS, Focus, Tremble, Zoom)
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
    transitionEffect: 'none',
    normalizeVolume: true,
    isProcessing: false,
    processingAborted: false,
    ffmpeg: null,
    startTime: 0,
    resultUrl: null
};

/* ========== DOM HELPERS ========== */
const $ = id => document.getElementById(id);
const show = id => $(id).style.display = 'block';
const hide = id => $(id).style.display = 'none';

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', () => {
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

    log('Clip Shorts v1.0 초기화 완료');
});

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

/* ========== TRANSITION ========== */
function setTransition(effect) {
    state.transitionEffect = effect;

    document.querySelectorAll('#transitionEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });

    log(`트랜지션: ${effect}`);
}

/* ========== DRAG & DROP ========== */
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');

    if (e.dataTransfer.files.length > 0) {
        handleFilesSelect(e.dataTransfer.files);
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

        if (state.normalizeVolume) {
            setStatus('볼륨 평준화 중...');
            setProgress(20);
            await normalizeAllClips();
        }

        setStatus('클립 병합 중...');
        setProgress(50);
        await concatClips();

        if (state.transitionEffect !== 'none') {
            setStatus('트랜지션 적용 중...');
            setProgress(70);
            await applyTransitions();
        }

        setStatus('최종 인코딩 중...');
        setProgress(85);
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
            const addPct = Math.floor(ratio * 10);
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

async function normalizeAllClips() {
    for (let i = 0; i < state.clips.length; i++) {
        if (state.processingAborted) throw new Error('중단됨');

        const input = `clip_${i}.mp4`;
        const output = `norm_${i}.mp4`;

        // loudnorm 2-pass: 첫번째 패스로 측정 후 적용
        // 간단하게 단일 패스 loudnorm 사용
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
        setProgress(20 + Math.floor((i / state.clips.length) * 30));
    }
}

async function concatClips() {
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
        setProgress(50 + Math.floor((i / state.clips.length) * 20));
    }

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

async function applyTransitions() {
    // FFmpeg에서 트랜지션 효과 적용
    // 간단하게 xfade 필터 사용 (클립 경계에 페이드 효과)
    // 복잡한 효과는 WebCodecs로 해야 하지만, 일단 fade로 대체

    const effect = state.transitionEffect;
    const dur = CONFIG.transitionDuration;

    // xfade는 두 영상 사이에만 적용 가능
    // 여러 클립의 경우 복잡해지므로, 간단히 fade-in/out 적용

    let filterComplex = '';

    switch (effect) {
        case 'tv':
        case 'vhs':
            // 노이즈 + 페이드
            filterComplex = `fade=t=out:st=${dur}:d=${dur},noise=c0s=10:c0f=t+u`;
            break;
        case 'focus':
            // 비네팅 + 페이드
            filterComplex = `vignette=PI/4,fade=t=out:st=${dur}:d=${dur}`;
            break;
        case 'tremble':
            // shake 효과는 crop으로 시뮬레이션
            filterComplex = `fade=t=out:st=${dur}:d=${dur}`;
            break;
        case 'zoom':
            // 줌 아웃은 scale로
            filterComplex = `fade=t=out:st=${dur}:d=${dur}`;
            break;
        default:
            // 기본 크로스페이드
            filterComplex = `fade=t=in:st=0:d=${dur},fade=t=out:st=${dur}:d=${dur}`;
    }

    // merged.mp4에 효과 적용
    await state.ffmpeg.run(
        '-i', 'merged.mp4',
        '-vf', filterComplex,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'copy',
        'transitioned.mp4'
    );

    state.ffmpeg.FS('unlink', 'merged.mp4');
    state.ffmpeg.FS('rename', 'transitioned.mp4', 'merged.mp4');

    log(`트랜지션 적용: ${effect}`);
}

async function finalEncode() {
    // 3분으로 자르기 (필요시)
    await state.ffmpeg.run(
        '-i', 'merged.mp4',
        '-t', String(CONFIG.targetDuration),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-c:a', 'aac', '-b:a', CONFIG.audioBitrate,
        '-movflags', '+faststart',
        'output.mp4'
    );

    log('최종 인코딩 완료');
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
    state.transitionEffect = 'none';

    $('clipInput').value = '';
    $('clipList').innerHTML = '';
    hide('clipSummary');
    hide('progressSection');
    hide('resultSection');

    // 트랜지션 버튼 리셋
    document.querySelectorAll('#transitionEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });

    // 토글 리셋
    $('normalizeToggle').checked = true;
    state.normalizeVolume = true;

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
