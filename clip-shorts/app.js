/**
 * Clip Shorts v5.1
 * 클립 선택 → 3분 쇼츠 자동 생성
 *
 * v5.1 변경사항:
 * - 10개+ 클립 병합 시 OOM 크래시 수정
 * - 클립을 한꺼번에 로드하지 않고 1개씩 로드→전처리→삭제 (스트리밍 방식)
 * - chunkSize 6→4 축소 (메모리 안전 마진 확보)
 *
 * v5.0 변경사항:
 * - 청크 방식 병합으로 메모리 문제 해결 (18개 클립도 안정적 처리)
 * - concat demuxer 방식으로 효율적 병합
 * - 메모리 관리 개선
 *
 * v4.0 변경사항:
 * - filter_complex concat 방식으로 안정적 병합
 * - 트랜지션 효과 실제 적용
 * - 배경 음악 믹싱
 */

'use strict';

/* ========== CONFIG ========== */
const CONFIG = {
    targetDuration: 180,
    resolution: { width: 720, height: 1280 },
    fps: 30,
    transitionDuration: 0.5,
    audioBitrate: '192k',
    chunkSize: 4  // 한 번에 병합할 클립 수 (메모리 최적화, 10개+ 안정)
};

/* ========== STATE ========== */
const state = {
    clips: [],
    clipDuration: 10,
    maxClips: 30,
    introEffect: 'none',
    transitionEffect: 'none',
    endingEffect: 'none',
    normalizeVolume: true,
    isProcessing: false,
    processingAborted: false,
    ffmpeg: null,
    startTime: 0,
    resultUrl: null,
    bgm: {
        file: null,
        url: null,
        volume: 0.5,
        clipVolume: 1.0,
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
    log('Clip Shorts v5.1 초기화 완료');
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
    if (playBtn) playBtn.onclick = toggleBGMPreview;

    const removeBtn = $('bgmRemoveBtn');
    if (removeBtn) removeBtn.onclick = removeBGM;
}

/* ========== BGM HANDLING ========== */
function handleBGMSelect(file) {
    if (!file.type.startsWith('audio/')) {
        alert('오디오 파일만 선택할 수 있습니다.');
        return;
    }

    if (state.bgm.url) URL.revokeObjectURL(state.bgm.url);

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
    if (preview) { preview.pause(); preview.src = ''; }

    if (state.bgm.url) URL.revokeObjectURL(state.bgm.url);

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
    state.maxClips = dur === 10 ? 30 : 20;
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
}

function setTransition(effect) {
    state.transitionEffect = effect;
    document.querySelectorAll('#transitionEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });
}

function setEnding(effect) {
    state.endingEffect = effect;
    document.querySelectorAll('#endingEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });
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
        if (!file.type.startsWith('video/')) continue;

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
            resolve({ dur: vid.duration, w: vid.videoWidth, h: vid.videoHeight });
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
    $('genBtn').disabled = state.clips.length < 2;
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
        // 1. FFmpeg 로드
        setStatus('FFmpeg 로딩 중...');
        setProgress(5);
        await initFFmpeg();

        // 2. BGM 로드 (클립은 전처리 중 1개씩 로드)
        setStatus('준비 중...');
        setProgress(10);
        if (state.bgm.enabled && state.bgm.file) {
            await writeBGMToFFmpeg();
        }

        // 3. 각 클립 전처리 (1개씩 로드→리사이즈→삭제, OOM 방지)
        setStatus('클립 처리 중...');
        setProgress(15);
        await preprocessClips();

        // 4. 청크 병합
        setStatus('클립 병합 중...');
        setProgress(55);
        await mergeClipsWithFilterComplex();

        // 5. 시작/엔딩 효과
        if (state.introEffect !== 'none' || state.endingEffect !== 'none') {
            setStatus('시작/엔딩 효과 적용 중...');
            setProgress(70);
            await applyIntroEndingEffects();
        }

        // 6. BGM 믹싱
        if (state.bgm.enabled && state.bgm.file) {
            setStatus('배경 음악 믹싱 중...');
            setProgress(80);
            await mixBGM();
        }

        // 7. 최종 인코딩
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
async function loadFFmpegScript() {
    if (typeof FFmpeg !== 'undefined') return;
    const cdns = [
        'https://unpkg.com/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.js',
        'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.js'
    ];
    for (const src of cdns) {
        try {
            await new Promise((resolve, reject) => {
                if (typeof FFmpeg !== 'undefined') { resolve(); return; }
                const s = document.createElement('script');
                s.src = src;
                s.crossOrigin = 'anonymous';
                s.onload = resolve;
                s.onerror = () => reject(new Error('CDN 실패'));
                document.head.appendChild(s);
            });
            log('FFmpeg 스크립트 로드 완료');
            return;
        } catch (e) {
            log(`FFmpeg 스크립트 CDN 실패: ${src}`);
        }
    }
    throw new Error('FFmpeg 스크립트 로드 실패');
}

async function initFFmpeg() {
    if (state.ffmpeg && state.ffmpeg.isLoaded()) return;

    if (typeof FFmpeg === 'undefined') {
        log('FFmpeg 스크립트 로드...');
        await loadFFmpegScript();
    }

    // SharedArrayBuffer 가용 여부에 따라 멀티/싱글 스레드 자동 선택
    const useST = !self.crossOriginIsolated;
    const corePkg = useST ? '@ffmpeg/core-st@0.11.1' : '@ffmpeg/core@0.11.0';
    log(useST ? '싱글스레드 모드 (GitHub Pages)' : '멀티스레드 모드');

    const cdns = [
        `https://unpkg.com/${corePkg}/dist/ffmpeg-core.js`,
        `https://cdn.jsdelivr.net/npm/${corePkg}/dist/ffmpeg-core.js`
    ];

    for (let i = 0; i < cdns.length; i++) {
        try {
            const { createFFmpeg } = FFmpeg;
            state.ffmpeg = createFFmpeg({
                log: true,
                corePath: cdns[i]
            });
            log(`FFmpeg WASM 로드 시도 (${i === 0 ? 'unpkg' : 'jsdelivr'})...`);
            await state.ffmpeg.load();
            log('FFmpeg 로드 완료');
            return;
        } catch (e) {
            log(`CDN ${i + 1} 실패: ${e.message}`);
            state.ffmpeg = null;
            if (i === cdns.length - 1) throw new Error('FFmpeg WASM 로드 실패 - 네트워크 확인 후 재시도');
        }
    }
}

async function writeBGMToFFmpeg() {
    const { fetchFile } = FFmpeg;
    state.ffmpeg.FS('writeFile', 'bgm.mp3', await fetchFile(state.bgm.file));
    log('배경 음악 로드 완료');
}

/* ========== 클립 전처리 (스트리밍 방식 — 1개씩 로드→처리→삭제) ========== */
async function preprocessClips() {
    const { fetchFile } = FFmpeg;
    const vfBase = `scale=${CONFIG.resolution.width}:${CONFIG.resolution.height}:force_original_aspect_ratio=decrease,pad=${CONFIG.resolution.width}:${CONFIG.resolution.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${CONFIG.fps}`;

    const hasTransition = state.transitionEffect !== 'none';
    const fadeDur = CONFIG.transitionDuration;
    const totalClips = state.clips.length;

    for (let i = 0; i < totalClips; i++) {
        if (state.processingAborted) throw new Error('중단됨');

        // ★ 클립 1개만 로드 (전체 로드 X → OOM 방지)
        const clip = state.clips[i];
        state.ffmpeg.FS('writeFile', `input_${i}.mp4`, await fetchFile(clip.file));
        log(`클립 ${i + 1}/${totalClips} 로드`);

        const clipDur = clip.meta.dur;
        const fadeOutStart = Math.max(0, clipDur - fadeDur);

        let vf = vfBase;

        // 트랜지션 효과: 클립 사이 페이드
        if (hasTransition) {
            if (i === 0) {
                vf += `,fade=t=out:st=${fadeOutStart}:d=${fadeDur}`;
            } else if (i === totalClips - 1) {
                vf += `,fade=t=in:st=0:d=${fadeDur}`;
            } else {
                vf += `,fade=t=in:st=0:d=${fadeDur},fade=t=out:st=${fadeOutStart}:d=${fadeDur}`;
            }
        }

        const af = state.normalizeVolume ? 'loudnorm=I=-16:TP=-1.5:LRA=11' : 'anull';

        await state.ffmpeg.run(
            '-i', `input_${i}.mp4`,
            '-vf', vf,
            '-af', af,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
            '-c:a', 'aac', '-b:a', CONFIG.audioBitrate, '-ar', '44100',
            '-y', `clip_${i}.mp4`
        );

        // ★ 원본 즉시 삭제 (다음 클립 로드 전에 메모리 확보)
        try { state.ffmpeg.FS('unlink', `input_${i}.mp4`); } catch(e) {}

        // GC 힌트 — 3개마다 쉬어줌 (4→3으로 더 자주)
        if (i > 0 && i % 3 === 0) {
            await new Promise(r => setTimeout(r, 200));
        }

        log(`클립 처리 ${i + 1}/${totalClips}`);
        setProgress(15 + Math.floor(((i + 1) / totalClips) * 35));
    }
}

/* ========== 청크 기반 병합 (메모리 최적화) ========== */
async function mergeClipsWithFilterComplex() {
    const n = state.clips.length;
    const chunkSize = CONFIG.chunkSize;

    // 클립이 적으면 기존 방식 사용
    if (n <= chunkSize) {
        await mergeClipsDirectly(0, n - 1, 'merged.mp4');
        // 처리된 클립 삭제
        for (let i = 0; i < n; i++) {
            try { state.ffmpeg.FS('unlink', `clip_${i}.mp4`); } catch(e) {}
        }
        log('클립 병합 완료');
        return;
    }

    // 청크로 나눠서 병합
    log(`청크 병합 시작 (${chunkSize}개씩 처리)`);
    const chunks = [];

    for (let i = 0; i < n; i += chunkSize) {
        const end = Math.min(i + chunkSize - 1, n - 1);
        const chunkName = `chunk_${chunks.length}.mp4`;

        log(`청크 ${chunks.length + 1} 병합 중 (클립 ${i + 1}~${end + 1})`);
        await mergeClipsDirectly(i, end, chunkName);

        // 병합된 클립들 즉시 삭제 (메모리 확보)
        for (let j = i; j <= end; j++) {
            try { state.ffmpeg.FS('unlink', `clip_${j}.mp4`); } catch(e) {}
        }

        chunks.push(chunkName);
        setProgress(50 + Math.floor((chunks.length / Math.ceil(n / chunkSize)) * 15));
    }

    // 청크들 최종 병합
    if (chunks.length > 1) {
        log(`최종 병합 중 (${chunks.length}개 청크)`);
        await mergeChunks(chunks, 'merged.mp4');
    } else {
        state.ffmpeg.FS('rename', chunks[0], 'merged.mp4');
    }

    log('클립 병합 완료');
}

/* ========== 클립 범위 직접 병합 ========== */
async function mergeClipsDirectly(startIdx, endIdx, outputName) {
    const count = endIdx - startIdx + 1;

    // concat demuxer 방식 사용 (더 효율적)
    let listContent = '';
    for (let i = startIdx; i <= endIdx; i++) {
        listContent += `file 'clip_${i}.mp4'\n`;
    }

    // 텍스트 파일 생성
    const encoder = new TextEncoder();
    state.ffmpeg.FS('writeFile', 'list.txt', encoder.encode(listContent));

    await state.ffmpeg.run(
        '-f', 'concat',
        '-safe', '0',
        '-i', 'list.txt',
        '-c', 'copy',
        '-y', outputName
    );

    try { state.ffmpeg.FS('unlink', 'list.txt'); } catch(e) {}
}

/* ========== 청크 병합 ========== */
async function mergeChunks(chunkNames, outputName) {
    // concat demuxer로 청크들 병합
    let listContent = '';
    for (const name of chunkNames) {
        listContent += `file '${name}'\n`;
    }

    const encoder = new TextEncoder();
    state.ffmpeg.FS('writeFile', 'chunk_list.txt', encoder.encode(listContent));

    await state.ffmpeg.run(
        '-f', 'concat',
        '-safe', '0',
        '-i', 'chunk_list.txt',
        '-c', 'copy',
        '-y', outputName
    );

    // 청크 파일들 삭제
    try { state.ffmpeg.FS('unlink', 'chunk_list.txt'); } catch(e) {}
    for (const name of chunkNames) {
        try { state.ffmpeg.FS('unlink', name); } catch(e) {}
    }
}

/* ========== 효과별 필터 정의 ========== */
const EFFECT_FILTERS = {
    none: '',
    tv: 'fade',
    vhs: 'fade',
    focus: 'fade',
    tremble: 'fade',
    zoom: 'fade',
    // 필름 효과: 세피아톤 + 비네팅 + 노이즈
    film: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,vignette=PI/4,noise=alls=12:allf=t'
};

/* ========== 시작/엔딩 효과 ========== */
async function applyIntroEndingEffects() {
    let totalDuration = state.clips.reduce((sum, clip) => sum + clip.meta.dur, 0);
    totalDuration = Math.min(totalDuration, CONFIG.targetDuration);

    const dur = CONFIG.transitionDuration;
    let filters = [];

    // 필름 효과가 선택된 경우 전체 영상에 필름 필터 적용
    const useFilmEffect = state.introEffect === 'film' || state.endingEffect === 'film';
    if (useFilmEffect) {
        filters.push(EFFECT_FILTERS.film);
        log('필름 효과 적용: 세피아톤 + 비네팅 + 그레인');
    }

    if (state.introEffect !== 'none') {
        filters.push(`fade=t=in:st=0:d=${dur}`);
        log(`시작 효과 적용: ${state.introEffect}`);
    }

    if (state.endingEffect !== 'none') {
        const fadeOutStart = Math.max(0, totalDuration - dur - 1);
        filters.push(`fade=t=out:st=${fadeOutStart}:d=${dur}`);
        log(`엔딩 효과 적용: ${state.endingEffect}`);
    }

    if (filters.length > 0) {
        try {
            await state.ffmpeg.run(
                '-i', 'merged.mp4',
                '-vf', filters.join(','),
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                '-c:a', 'copy',
                '-y', 'effected.mp4'
            );

            state.ffmpeg.FS('unlink', 'merged.mp4');
            state.ffmpeg.FS('rename', 'effected.mp4', 'merged.mp4');
            log('시작/엔딩 효과 적용 완료');
        } catch (e) {
            log(`효과 적용 실패: ${e.message}`);
        }
    }
}

/* ========== BGM 믹싱 ========== */
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
            '-y', 'bgm_mixed.mp4'
        );

        state.ffmpeg.FS('unlink', 'merged.mp4');
        state.ffmpeg.FS('rename', 'bgm_mixed.mp4', 'merged.mp4');
        log(`BGM 믹싱 완료 (BGM: ${Math.round(bgmVol*100)}%, 원본: ${Math.round(clipVol*100)}%)`);
    } catch (e) {
        log(`BGM 믹싱 실패: ${e.message}`);
    }

    try { state.ffmpeg.FS('unlink', 'bgm.mp3'); } catch(e) {}
}

/* ========== 최종 인코딩 ========== */
async function finalEncode() {
    try {
        state.ffmpeg.FS('readFile', 'merged.mp4');
    } catch (e) {
        throw new Error('병합된 파일이 없습니다.');
    }

    await state.ffmpeg.run(
        '-i', 'merged.mp4',
        '-t', String(CONFIG.targetDuration),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-c:a', 'aac', '-b:a', CONFIG.audioBitrate,
        '-movflags', '+faststart',
        '-y', 'output.mp4'
    );

    try {
        state.ffmpeg.FS('readFile', 'output.mp4');
        log('최종 인코딩 완료');
    } catch (e) {
        throw new Error('인코딩 실패');
    }
}

/* ========== 결과 표시 ========== */
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

    document.querySelectorAll('.effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });

    $('normalizeToggle').checked = true;
    state.normalizeVolume = true;

    // BGM 리셋
    const preview = $('bgmPreview');
    if (preview) { preview.pause(); preview.src = ''; }
    if (state.bgm.url) URL.revokeObjectURL(state.bgm.url);
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
    if (bgmToggle) { bgmToggle.checked = false; state.bgm.enabled = false; }
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

