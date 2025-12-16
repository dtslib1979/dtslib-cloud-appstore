/**
 * 10sec 적분 쇼츠 v1.0
 * 짧은 영상들을 합쳐서 유튜브 쇼츠로 자동 변환
 */

'use strict';

/* ========== STATE ========== */
const state = {
    clips: [],           // { file, duration, url }
    speed: 1.0,
    openingEffect: 'none',
    endingEffect: 'none',
    resolution: 720,
    processing: false,
    aborted: false,
    ffmpeg: null,
    ffmpegLoaded: false
};

/* ========== RESOLUTION CONFIG ========== */
const RESOLUTIONS = {
    480: { width: 480, height: 854 },
    720: { width: 720, height: 1280 },
    1080: { width: 1080, height: 1920 }
};

const MAX_DURATION = 180; // 3분

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Check WebCodecs
    checkEngine();

    // Setup file input
    const input = document.getElementById('videoInput');
    input.addEventListener('change', handleFileSelect);

    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();

    log('앱 초기화 완료');
}

function checkEngine() {
    const badge = document.getElementById('engineInfo');
    if (typeof VideoEncoder !== 'undefined') {
        badge.textContent = '🚀 WebCodecs';
        badge.style.background = 'linear-gradient(135deg, #00d4aa, #00b894)';
        badge.style.color = '#000';
    } else {
        badge.textContent = '🎵 FFmpeg';
        badge.style.background = '#667eea';
    }
}

/* ========== FILE HANDLING ========== */
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (files.length > 0) {
        addClips(files);
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        addClips(files);
    }
    e.target.value = '';
}

async function addClips(files) {
    for (const file of files) {
        const duration = await getVideoDuration(file);
        const url = URL.createObjectURL(file);
        state.clips.push({ file, duration, url });
    }
    updateClipList();
    showSections();
    updateSummary();
}

function getVideoDuration(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            resolve(video.duration);
            URL.revokeObjectURL(video.src);
        };
        video.onerror = () => resolve(0);
        video.src = URL.createObjectURL(file);
    });
}

/* ========== CLIP LIST ========== */
function updateClipList() {
    const container = document.getElementById('clipList');
    container.innerHTML = '';

    state.clips.forEach((clip, index) => {
        const item = document.createElement('div');
        item.className = 'clip-item';
        item.draggable = true;
        item.dataset.index = index;
        item.innerHTML = `
            <span class="clip-num">${index + 1}</span>
            <span class="clip-duration">${formatTime(clip.duration)}</span>
            <button class="clip-remove" onclick="removeClip(${index})">✕</button>
        `;

        // Drag events
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleItemDragOver);
        item.addEventListener('drop', handleItemDrop);
        item.addEventListener('dragend', handleDragEnd);

        container.appendChild(item);
    });
}

let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(e.target.dataset.index);
    e.target.classList.add('dragging');
}

function handleItemDragOver(e) {
    e.preventDefault();
}

function handleItemDrop(e) {
    e.preventDefault();
    const targetIndex = parseInt(e.target.closest('.clip-item').dataset.index);
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
        const [removed] = state.clips.splice(draggedIndex, 1);
        state.clips.splice(targetIndex, 0, removed);
        updateClipList();
        updateSummary();
    }
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedIndex = null;
}

function removeClip(index) {
    URL.revokeObjectURL(state.clips[index].url);
    state.clips.splice(index, 1);
    updateClipList();
    updateSummary();
    if (state.clips.length === 0) {
        hideSections();
    }
}

function clearAllClips() {
    state.clips.forEach(c => URL.revokeObjectURL(c.url));
    state.clips = [];
    updateClipList();
    hideSections();
}

/* ========== UI UPDATES ========== */
function showSections() {
    ['clipSection', 'speedSection', 'effectSection', 'outputSection', 'generateSection'].forEach(id => {
        document.getElementById(id).style.display = 'block';
    });
}

function hideSections() {
    ['clipSection', 'speedSection', 'effectSection', 'outputSection', 'generateSection'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
}

function updateSummary() {
    const totalDuration = state.clips.reduce((sum, c) => sum + c.duration, 0);
    const adjustedDuration = totalDuration / state.speed;
    const partCount = Math.ceil(adjustedDuration / MAX_DURATION) || 1;

    document.getElementById('totalClips').textContent = `${state.clips.length}개 클립`;
    document.getElementById('totalDuration').textContent = formatTime(totalDuration);
    document.getElementById('adjustedDuration').textContent = formatTime(adjustedDuration);
    document.getElementById('partCount').textContent = `${partCount}개`;

    // Enable/disable generate button
    const btn = document.getElementById('generateBtn');
    btn.disabled = state.clips.length === 0;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ========== SPEED CONTROL ========== */
function updateSpeed() {
    const slider = document.getElementById('speedSlider');
    state.speed = slider.value / 100;
    document.getElementById('speedValue').textContent = `${state.speed.toFixed(2)}x`;

    // Update preset buttons
    document.querySelectorAll('.speed-presets button').forEach(btn => {
        btn.classList.remove('active');
    });

    updateSummary();
}

function setSpeed(value) {
    state.speed = value / 100;
    document.getElementById('speedSlider').value = value;
    document.getElementById('speedValue').textContent = `${state.speed.toFixed(2)}x`;

    document.querySelectorAll('.speed-presets button').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(state.speed.toFixed(2)));
    });

    updateSummary();
}

/* ========== EFFECTS ========== */
function setOpening(effect) {
    state.openingEffect = effect;
    document.querySelectorAll('#openingEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });
}

function setEnding(effect) {
    state.endingEffect = effect;
    document.querySelectorAll('#endingEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });
}

/* ========== THEME ========== */
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon();
}

function updateThemeIcon() {
    const theme = document.documentElement.getAttribute('data-theme');
    document.getElementById('themeIcon').textContent = theme === 'dark' ? '🌙' : '☀️';
}

/* ========== LOGGING ========== */
function log(msg) {
    console.log(`[10sec] ${msg}`);
    const logEl = document.getElementById('progressLog');
    if (logEl) {
        logEl.innerHTML = `${msg}<br>` + logEl.innerHTML;
    }
}

function setStatus(text) {
    document.getElementById('status').textContent = text;
}

function setProgress(percent) {
    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('progressText').textContent = `${Math.round(percent)}%`;
}

/* ========== FFMPEG ========== */
async function loadFFmpeg() {
    if (state.ffmpegLoaded) return;

    setStatus('FFmpeg 로딩 중...');
    log('FFmpeg 로딩 시작');

    try {
        const { createFFmpeg, fetchFile } = FFmpeg;
        state.ffmpeg = createFFmpeg({
            log: false,
            corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
        });
        await state.ffmpeg.load();
        state.ffmpegLoaded = true;
        log('FFmpeg 로딩 완료');
    } catch (err) {
        log('FFmpeg 로딩 실패: ' + err.message);
        throw err;
    }
}

/* ========== GENERATE ========== */
async function generate() {
    if (state.processing || state.clips.length === 0) return;

    state.processing = true;
    state.aborted = false;

    // Show progress section
    document.getElementById('progressSection').style.display = 'block';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('generateSection').style.display = 'none';
    document.getElementById('progressLog').innerHTML = '';

    try {
        await loadFFmpeg();

        const totalDuration = state.clips.reduce((sum, c) => sum + c.duration, 0);
        const adjustedDuration = totalDuration / state.speed;
        const partCount = Math.ceil(adjustedDuration / MAX_DURATION);

        log(`총 길이: ${formatTime(totalDuration)}, 속도 적용: ${formatTime(adjustedDuration)}`);
        log(`${partCount}개 파트로 분할`);

        // Process with FFmpeg
        setStatus('영상 처리 중...');

        // Write all clips to FFmpeg
        for (let i = 0; i < state.clips.length; i++) {
            if (state.aborted) throw new Error('사용자 중단');
            const clip = state.clips[i];
            const data = await clip.file.arrayBuffer();
            state.ffmpeg.FS('writeFile', `clip${i}.mp4`, new Uint8Array(data));
            log(`클립 ${i + 1} 로드됨: ${formatTime(clip.duration)}`);
            setProgress((i + 1) / state.clips.length * 20);
        }

        // Create concat file
        let concatContent = '';
        state.clips.forEach((_, i) => {
            concatContent += `file 'clip${i}.mp4'\n`;
        });
        state.ffmpeg.FS('writeFile', 'concat.txt', concatContent);

        setStatus('영상 합치는 중...');
        setProgress(30);

        // Concat videos
        const res = RESOLUTIONS[state.resolution];
        const speedFilter = state.speed !== 1.0 ? `,setpts=${(1/state.speed).toFixed(3)}*PTS` : '';
        const atempoFilter = state.speed !== 1.0 ? getAtempoFilter(state.speed) : '';

        await state.ffmpeg.run(
            '-f', 'concat',
            '-safe', '0',
            '-i', 'concat.txt',
            '-vf', `scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease,pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2${speedFilter}`,
            '-af', atempoFilter || 'anull',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            'combined.mp4'
        );

        setProgress(60);
        log('영상 합치기 완료');

        // Split into parts
        const results = [];

        if (partCount === 1) {
            // Single output
            setStatus('최종 처리 중...');
            const data = state.ffmpeg.FS('readFile', 'combined.mp4');
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            results.push({
                name: '10sec_shorts.mp4',
                url: URL.createObjectURL(blob),
                duration: adjustedDuration
            });
            setProgress(100);
        } else {
            // Multiple parts
            for (let i = 0; i < partCount; i++) {
                if (state.aborted) throw new Error('사용자 중단');

                const startTime = i * MAX_DURATION;
                const partDuration = Math.min(MAX_DURATION, adjustedDuration - startTime);

                setStatus(`파트 ${i + 1}/${partCount} 생성 중...`);
                log(`파트 ${i + 1}: ${formatTime(startTime)} ~ ${formatTime(startTime + partDuration)}`);

                await state.ffmpeg.run(
                    '-i', 'combined.mp4',
                    '-ss', startTime.toString(),
                    '-t', partDuration.toString(),
                    '-c', 'copy',
                    `part${i}.mp4`
                );

                const data = state.ffmpeg.FS('readFile', `part${i}.mp4`);
                const blob = new Blob([data.buffer], { type: 'video/mp4' });
                results.push({
                    name: `10sec_shorts_part${i + 1}.mp4`,
                    url: URL.createObjectURL(blob),
                    duration: partDuration
                });

                setProgress(60 + (i + 1) / partCount * 40);
            }
        }

        // Show results
        showResults(results);

    } catch (err) {
        log('오류: ' + err.message);
        setStatus('오류 발생');
        alert('처리 중 오류: ' + err.message);
    } finally {
        state.processing = false;
        cleanupFFmpeg();
    }
}

function getAtempoFilter(speed) {
    // atempo only supports 0.5 to 2.0, chain multiple if needed
    if (speed >= 0.5 && speed <= 2.0) {
        return `atempo=${speed}`;
    } else if (speed < 0.5) {
        return `atempo=0.5,atempo=${speed / 0.5}`;
    } else {
        return `atempo=2.0,atempo=${speed / 2.0}`;
    }
}

function cleanupFFmpeg() {
    if (!state.ffmpeg || !state.ffmpegLoaded) return;
    try {
        const files = ['concat.txt', 'combined.mp4'];
        state.clips.forEach((_, i) => files.push(`clip${i}.mp4`));
        for (let i = 0; i < 10; i++) files.push(`part${i}.mp4`);

        files.forEach(f => {
            try { state.ffmpeg.FS('unlink', f); } catch (e) {}
        });
    } catch (e) {}
}

function showResults(results) {
    const container = document.getElementById('resultList');
    container.innerHTML = '';

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <video src="${result.url}" controls playsinline></video>
            <div class="result-info">
                <div class="result-name">${result.name}</div>
                <div class="result-meta">${formatTime(result.duration)}</div>
            </div>
            <a href="${result.url}" download="${result.name}" class="result-download">💾</a>
        `;
        container.appendChild(item);
    });

    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'block';
    log('생성 완료!');
}

/* ========== CONTROLS ========== */
function abort() {
    state.aborted = true;
    log('중단 요청됨');
}

function reset() {
    clearAllClips();
    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('generateSection').style.display = 'none';
    state.speed = 1.0;
    state.openingEffect = 'none';
    state.endingEffect = 'none';
    document.getElementById('speedSlider').value = 100;
    document.getElementById('speedValue').textContent = '1.0x';
}

/* ========== SERVICE WORKER ========== */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => log('Service Worker 등록됨'))
        .catch(err => log('SW 등록 실패: ' + err.message));
}
