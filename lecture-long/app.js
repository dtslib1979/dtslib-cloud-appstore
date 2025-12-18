/**
 * Lecture Long Factory v1.0
 * Professional PWA for Long Tutorial Video Processing
 *
 * Features:
 * - Supports 40min ~ 2 hour tutorials
 * - No speed adjustment (1x playback)
 * - Start/End effects only (no middle transitions)
 * - Auto-looping BGM
 * - WebCodecs API (Hardware Acceleration)
 * - FFmpeg.wasm (Audio Processing)
 */

'use strict';

/* ========== CONFIGURATION ========== */
const CONFIG = {
    // Quality Presets
    quality: {
        low: { bitrate: 1_500_000, crf: 28, preset: 'ultrafast' },
        medium: { bitrate: 2_500_000, crf: 23, preset: 'fast' },
        high: { bitrate: 4_000_000, crf: 18, preset: 'medium' }
    },

    // Resolution Presets
    resolution: {
        480: { width: 480, height: 854 },
        720: { width: 720, height: 1280 },
        1080: { width: 1080, height: 1920 }
    },

    // Default Settings - Optimized for Long Tutorials
    defaults: {
        quality: 'medium',
        resolution: 720,
        fps: 30,
        bgmVolume: 0.1
    },

    // Limits - Extended for long tutorials
    limits: {
        maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
        maxDuration: 7200, // 2 hours
        minDuration: 60 // 1 minute
    },

    // Device Presets for Cropping
    devices: {
        TAB_S9: { name: 'Galaxy Tab S9', topCutPct: 0.055, bottomCutPct: 0.090, yShiftPct: -0.060 },
        S25_ULTRA: { name: 'Galaxy S25 Ultra', topCutPct: 0.090, bottomCutPct: 0.040, yShiftPct: -0.085 }
    },

    // Storage Keys
    storage: {
        settings: 'lectureLong_settings_v1',
        theme: 'lectureLong_theme'
    }
};

/* ========== STATE ========== */
const state = {
    // Files
    vidFile: null,
    introFile: null,
    outroFile: null,
    bgmFile: null,

    // Metadata
    vidMeta: { dur: 0, w: 0, h: 0 },
    introMeta: { dur: 0, w: 0, h: 0 },
    outroMeta: { dur: 0, w: 0, h: 0 },

    // Settings
    quality: CONFIG.defaults.quality,
    resolution: CONFIG.defaults.resolution,
    fps: CONFIG.defaults.fps,
    bgmVolume: CONFIG.defaults.bgmVolume,
    devicePreset: null,

    // Processing
    useWebCodecs: false,
    isProcessing: false,
    processingAborted: false,
    startTime: 0,

    // Background Protection
    wakeLock: null,
    audioContext: null,
    silentAudioNode: null,

    // BGM Preview
    bgmPreviewAudio: null,

    // FFmpeg
    ffmpeg: null,

    // Theme
    theme: 'dark',

    // Effects (Start/End only)
    startEffect: 'none',
    endEffect: 'none',
    effectDuration: 1.0,

    // Result
    resultBlob: null,
    resultUrl: null
};

/* ========== UTILITY FUNCTIONS ========== */
const el = id => document.getElementById(id);
const show = id => { const e = el(id); if(e) e.style.display = 'block'; };
const hide = id => { const e = el(id); if(e) e.style.display = 'none'; };

function formatDuration(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}시간 ${m}분 ${s}초`;
    return `${m}분 ${s}초`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatETA(seconds) {
    if (seconds < 60) return `약 ${Math.ceil(seconds)}초`;
    if (seconds < 3600) return `약 ${Math.ceil(seconds / 60)}분`;
    return `약 ${Math.floor(seconds / 3600)}시간 ${Math.ceil((seconds % 3600) / 60)}분`;
}

function showInfo(id, html, cls = '') {
    const e = el(id);
    if (!e) return;
    e.innerHTML = html;
    e.className = 'file-info show ' + cls;
}

function log(msg) {
    console.log(`[LectureLong] ${msg}`);
    const logEl = el('progressLog');
    if (logEl) {
        const time = new Date().toLocaleTimeString();
        logEl.innerHTML += `<div>[${time}] ${msg}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    }
}

/* ========== VERSION LOADER ========== */
async function loadAppVersion() {
    try {
        const res = await fetch('../apps.json');
        const data = await res.json();
        const app = data.apps.find(a => a.id === 'lecture-long');
        if (app) {
            el('appVersion').textContent = `v${app.version}`;
            log(`버전: ${app.version}`);
        }
    } catch (e) {
        console.warn('버전 로드 실패:', e);
    }
}

/* ========== INITIALIZATION ========== */
document.addEventListener('DOMContentLoaded', init);

async function init() {
    log('초기화 중...');

    // Load version from apps.json
    await loadAppVersion();

    // Check WebCodecs support
    state.useWebCodecs = checkWebCodecsSupport();
    updateEngineInfo();

    // Check memory
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        show('memWarn');
    }

    // Load saved settings and theme
    loadSettings();
    loadTheme();

    // Setup event listeners
    setupEventListeners();

    // Register service worker
    registerServiceWorker();

    log('초기화 완료');
}

function checkWebCodecsSupport() {
    const supported = typeof VideoEncoder !== 'undefined' &&
                      typeof VideoDecoder !== 'undefined' &&
                      typeof VideoFrame !== 'undefined';
    log(`WebCodecs: ${supported ? '지원' : '미지원'}`);
    return supported;
}

function updateEngineInfo() {
    const badge = el('engineInfo');
    if (!badge) return;

    if (state.useWebCodecs) {
        badge.innerHTML = '🚀 WebCodecs';
        badge.className = 'engine-badge webcodecs';
    } else {
        badge.innerHTML = '⚙️ FFmpeg';
        badge.className = 'engine-badge ffmpeg';
    }
}

function setupEventListeners() {
    // File inputs
    el('vidIn').onchange = e => handleFileSelect(e.target.files[0], 'vid');
    el('introIn').onchange = e => handleFileSelect(e.target.files[0], 'intro');
    el('outroIn').onchange = e => handleFileSelect(e.target.files[0], 'outro');
    el('bgmIn').onchange = e => handleFileSelect(e.target.files[0], 'bgm');

    // BGM Volume slider
    const slider = el('bgmVolSlider');
    if (slider) {
        slider.oninput = () => {
            state.bgmVolume = parseInt(slider.value) / 100;
            el('bgmVolValue').textContent = slider.value + '%';
            if (state.bgmPreviewAudio && !state.bgmPreviewAudio.paused) {
                state.bgmPreviewAudio.volume = state.bgmVolume;
            }
        };
    }

    // Page visibility
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Service worker updates
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            show('updateBanner');
        });
    }
}

/* ========== KEYBOARD SHORTCUTS ========== */
function handleKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
    }

    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal[style*="block"]');
        if (modals.length > 0) {
            modals.forEach(m => m.style.display = 'none');
        } else if (state.isProcessing) {
            abortProcessing();
        }
        return;
    }

    const modalOpen = document.querySelector('.modal[style*="block"]');
    if (modalOpen) return;

    switch(e.key.toLowerCase()) {
        case 'enter':
            if (!el('genBtn').disabled && !state.isProcessing) {
                generate();
            }
            break;
        case 'r':
            if (!state.isProcessing) reset();
            break;
        case 't':
            toggleTheme();
            break;
        case 's':
            toggleSettings();
            break;
        case '1':
            el('vidIn').click();
            break;
        case '2':
            el('introIn').click();
            break;
        case '3':
            el('outroIn').click();
            break;
        case '4':
            el('bgmIn').click();
            break;
        case '?':
            showHelp();
            break;
    }
}

/* ========== THEME ========== */
function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    el('themeIcon').textContent = state.theme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem(CONFIG.storage.theme, state.theme);
    log(`테마 변경: ${state.theme}`);
}

function loadTheme() {
    const saved = localStorage.getItem(CONFIG.storage.theme);
    if (saved) {
        state.theme = saved;
        document.documentElement.setAttribute('data-theme', state.theme);
        el('themeIcon').textContent = state.theme === 'dark' ? '🌙' : '☀️';
    }
}

/* ========== SETTINGS ========== */
function toggleSettings() {
    const content = el('settingsContent');
    const header = document.querySelector('.settings-header');
    const isOpen = content.style.display !== 'none';

    content.style.display = isOpen ? 'none' : 'block';
    header.setAttribute('aria-expanded', !isOpen);
}

function setQuality(q) {
    state.quality = q;
    ['qualityLow', 'qualityMid', 'qualityHigh'].forEach(id => {
        el(id).classList.toggle('active', id === 'quality' + q.charAt(0).toUpperCase() + q.slice(1));
    });
    updateSummary();
}

function updateResolution() {
    state.resolution = parseInt(el('resolutionSelect').value);
    updateSummary();
}

function updateFps() {
    state.fps = parseInt(el('fpsSelect').value);
    updateSummary();
}

function saveSettings() {
    const settings = {
        quality: state.quality,
        resolution: state.resolution,
        fps: state.fps,
        bgmVolume: state.bgmVolume
    };
    localStorage.setItem(CONFIG.storage.settings, JSON.stringify(settings));
    log('설정 저장됨');
    alert('설정이 저장되었습니다.');
}

function loadSettings() {
    try {
        const saved = localStorage.getItem(CONFIG.storage.settings);
        if (saved) {
            const settings = JSON.parse(saved);
            state.quality = settings.quality || CONFIG.defaults.quality;
            state.resolution = settings.resolution || CONFIG.defaults.resolution;
            state.fps = settings.fps || CONFIG.defaults.fps;
            state.bgmVolume = settings.bgmVolume ?? CONFIG.defaults.bgmVolume;

            applySettingsToUI();
            log('저장된 설정 로드됨');
        }
    } catch (e) {
        console.warn('설정 로드 실패:', e);
    }
}

function applySettingsToUI() {
    setQuality(state.quality);
    el('resolutionSelect').value = state.resolution;
    el('fpsSelect').value = state.fps;
    el('bgmVolSlider').value = Math.round(state.bgmVolume * 100);
    el('bgmVolValue').textContent = Math.round(state.bgmVolume * 100) + '%';
}

function resetSettings() {
    state.quality = CONFIG.defaults.quality;
    state.resolution = CONFIG.defaults.resolution;
    state.fps = CONFIG.defaults.fps;
    state.bgmVolume = CONFIG.defaults.bgmVolume;
    applySettingsToUI();
    log('설정 초기화됨');
}

/* ========== EFFECTS (Start/End Only) ========== */
function setStartEffect(effect) {
    state.startEffect = effect;
    const buttons = document.querySelectorAll('#startEffects .effect-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });
    updateSummary();
    log(`시작 효과: ${effect}`);
}

function setEndEffect(effect) {
    state.endEffect = effect;
    const buttons = document.querySelectorAll('#endEffects .effect-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });
    updateSummary();
    log(`엔딩 효과: ${effect}`);
}

function updateEffectDuration() {
    const select = el('effectDuration');
    if (select) {
        state.effectDuration = parseFloat(select.value);
        log(`효과 길이: ${state.effectDuration}초`);
    }
}

/**
 * Apply transition effect to canvas context
 */
function applyTransitionEffect(ctx, effect, progress, width, height) {
    if (!ctx || !effect) return;

    try {
        switch (effect) {
            case 'tv':
                applyTVEffect(ctx, progress, width, height);
                break;
            case 'vhs':
                applyVHSEffect(ctx, progress, width, height);
                break;
            case 'focus':
                applyFocusEffect(ctx, progress, width, height);
                break;
            case 'zoom':
                applyZoomEffect(ctx, progress, width, height);
                break;
            default:
                break;
        }
    } catch (e) {
        console.error('Effect error:', e);
    }
}

function applyTVEffect(ctx, progress, width, height) {
    const barSize = Math.floor((height / 2) * (1 - progress));
    if (barSize > 0) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, barSize);
        ctx.fillRect(0, height - barSize, width, barSize);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * (1 - progress)})`;
        for (let y = 0; y < height; y += 2) {
            ctx.fillRect(0, y, width, 1);
        }
    }
    if (progress < 0.15) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, height / 2 - 3, width, 6);
    }
}

function applyVHSEffect(ctx, progress, width, height) {
    const intensity = 1 - progress;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * intensity})`;
    for (let i = 0; i < 50 * intensity; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        ctx.fillRect(x, y, Math.random() * 3, 1);
    }
    ctx.fillStyle = `rgba(0, 255, 255, ${0.3 * intensity})`;
    for (let i = 0; i < 5 * intensity; i++) {
        const y = Math.random() * height;
        ctx.fillRect(0, y, width, 2);
    }
    const trackY = ((1 - progress) * 1.5 * height) % height;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * intensity})`;
    ctx.fillRect(0, trackY, width, 8);
}

function applyFocusEffect(ctx, progress, width, height) {
    const intensity = 1 - progress;
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.6
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, `rgba(0,0,0,${0.3 * intensity})`);
    gradient.addColorStop(1, `rgba(0,0,0,${0.9 * intensity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * intensity})`;
    ctx.fillRect(0, 0, width, height);
}

function applyZoomEffect(ctx, progress, width, height) {
    const intensity = 1 - progress;
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * (0.8 - intensity * 0.5)
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.7, `rgba(0,0,0,${0.5 * intensity})`);
    gradient.addColorStop(1, `rgba(0,0,0,${1 * intensity})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * intensity})`;
    ctx.fillRect(0, 0, width, height);
}

/* ========== DRAG & DROP ========== */
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDrop(e, type) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0], type);
    }
}

/* ========== FILE HANDLING ========== */
async function handleFileSelect(file, type) {
    if (!file) return;

    const validation = validateFile(file, type);
    if (!validation.valid) {
        showInfo(type + 'Info', `${validation.error}`, 'error');
        return;
    }

    try {
        if (type === 'vid') {
            state.vidFile = file;
            state.vidMeta = await getVideoMeta(file);
            updateVidInfo();
        } else if (type === 'intro') {
            state.introFile = file;
            state.introMeta = await getVideoMeta(file);
            updateIntroInfo();
        } else if (type === 'outro') {
            state.outroFile = file;
            state.outroMeta = await getVideoMeta(file);
            updateOutroInfo();
        } else if (type === 'bgm') {
            state.bgmFile = file;
            showInfo('bgmInfo', `${file.name}<br>자동 반복 재생`, 'success');
            show('bgmVolControl');
        }

        checkReady();
        updateSummary();
    } catch (e) {
        showInfo(type + 'Info', `${e.message}`, 'error');
    }
}

function validateFile(file, type) {
    if (file.size > CONFIG.limits.maxFileSize) {
        return { valid: false, error: `파일이 너무 큽니다 (최대 ${formatFileSize(CONFIG.limits.maxFileSize)})` };
    }

    if (type === 'bgm') {
        if (!file.type.startsWith('audio/')) {
            return { valid: false, error: '오디오 파일만 지원됩니다' };
        }
    } else {
        if (!file.type.startsWith('video/')) {
            return { valid: false, error: '비디오 파일만 지원됩니다' };
        }
    }

    if (file.size > 500 * 1024 * 1024) {
        const warn = el('fileSizeWarn');
        warn.textContent = `${formatFileSize(file.size)} - 큰 파일은 처리 시간이 오래 걸릴 수 있습니다`;
        show('fileSizeWarn');
    }

    return { valid: true };
}

async function getVideoMeta(file) {
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
        vid.onerror = () => reject(new Error('비디오 메타데이터 로드 실패'));
        vid.src = URL.createObjectURL(file);
    });
}

function updateVidInfo() {
    showInfo('vidInfo',
        `${state.vidFile.name}<br>` +
        `${state.vidMeta.w}x${state.vidMeta.h} | ${formatDuration(state.vidMeta.dur)}<br>` +
        `${formatFileSize(state.vidFile.size)}`,
        'success'
    );
}

function updateIntroInfo() {
    showInfo('introInfo',
        `${state.introFile.name}<br>${formatDuration(state.introMeta.dur)}`,
        'success'
    );
}

function updateOutroInfo() {
    showInfo('outroInfo',
        `${state.outroFile.name}<br>${formatDuration(state.outroMeta.dur)}`,
        'success'
    );
}

/* ========== DEVICE PRESET ========== */
function setPreset(key) {
    state.devicePreset = key;

    el('btnTabS9').classList.toggle('active', key === 'TAB_S9');
    el('btnS25').classList.toggle('active', key === 'S25_ULTRA');
    el('btnNone').classList.toggle('active', key === null);

    if (key && CONFIG.devices[key]) {
        const p = CONFIG.devices[key];
        el('presetInfo').textContent = `Top: ${(p.topCutPct * 100).toFixed(1)}% | Bottom: ${(p.bottomCutPct * 100).toFixed(1)}%`;
    } else {
        el('presetInfo').textContent = '크롭 없음';
    }

    updateSummary();
}

/* ========== SUMMARY & READY CHECK ========== */
function checkReady() {
    // Only main video is required
    el('genBtn').disabled = !state.vidFile;
}

function calcTotalDuration() {
    let total = state.vidMeta.dur;
    if (state.introFile) total += state.introMeta.dur;
    if (state.outroFile) total += state.outroMeta.dur;
    return total;
}

function updateSummary() {
    if (!state.vidFile) {
        hide('summary');
        return;
    }

    const res = CONFIG.resolution[state.resolution];
    const qual = CONFIG.quality[state.quality];
    const total = calcTotalDuration();

    const effectNames = {
        'none': '없음',
        'tv': 'TV',
        'vhs': 'VHS',
        'focus': 'FOCUS',
        'zoom': 'ZOOM'
    };

    el('summaryContent').innerHTML = `
        <ul>
            <li>해상도: ${res.width}x${res.height}</li>
            <li>총 길이: ${formatDuration(total)}</li>
            <li>FPS: ${state.fps}</li>
            <li>품질: ${state.quality} (${(qual.bitrate / 1000000).toFixed(1)}Mbps)</li>
            ${state.bgmFile ? `<li>BGM: ${Math.round(state.bgmVolume * 100)}% (자동 반복)</li>` : ''}
            ${state.devicePreset ? `<li>크롭: ${CONFIG.devices[state.devicePreset].name}</li>` : ''}
            ${state.startEffect !== 'none' ? `<li>시작 효과: ${effectNames[state.startEffect]}</li>` : ''}
            ${state.endEffect !== 'none' ? `<li>엔딩 효과: ${effectNames[state.endEffect]}</li>` : ''}
        </ul>
    `;
    show('summary');
}

/* ========== BGM PREVIEW ========== */
function previewBgm() {
    if (!state.bgmFile) return;

    const btn = el('bgmPreviewBtn');

    if (state.bgmPreviewAudio && !state.bgmPreviewAudio.paused) {
        state.bgmPreviewAudio.pause();
        state.bgmPreviewAudio = null;
        btn.textContent = '미리듣기 (5초)';
        return;
    }

    state.bgmPreviewAudio = new Audio(URL.createObjectURL(state.bgmFile));
    state.bgmPreviewAudio.volume = state.bgmVolume;
    state.bgmPreviewAudio.play();
    btn.textContent = '정지';

    setTimeout(() => {
        if (state.bgmPreviewAudio) {
            state.bgmPreviewAudio.pause();
            state.bgmPreviewAudio = null;
            btn.textContent = '미리듣기 (5초)';
        }
    }, 5000);

    state.bgmPreviewAudio.onended = () => {
        btn.textContent = '미리듣기 (5초)';
    };
}

/* ========== BACKGROUND PROTECTION ========== */
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            state.wakeLock = await navigator.wakeLock.request('screen');
            log('Wake Lock 활성화');
            state.wakeLock.addEventListener('release', () => log('Wake Lock 해제됨'));
        } catch (e) {
            console.warn('Wake Lock 실패:', e.message);
        }
    }
}

function releaseWakeLock() {
    if (state.wakeLock) {
        state.wakeLock.release();
        state.wakeLock = null;
    }
}

function startSilentAudio() {
    if (state.audioContext) return;

    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = state.audioContext.createOscillator();
        const gainNode = state.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(state.audioContext.destination);
        gainNode.gain.value = 0.001;
        oscillator.frequency.value = 1;
        oscillator.start();
        state.silentAudioNode = oscillator;

        log('Silent Audio 시작');
    } catch (e) {
        console.warn('Silent Audio 실패:', e.message);
    }
}

function stopSilentAudio() {
    if (state.silentAudioNode) {
        state.silentAudioNode.stop();
        state.silentAudioNode = null;
    }
    if (state.audioContext) {
        state.audioContext.close();
        state.audioContext = null;
    }
}

function handleVisibilityChange() {
    if (!state.isProcessing) return;

    if (document.hidden) {
        log('백그라운드 전환됨 - 처리 계속 진행');
    } else {
        log('포그라운드 복귀');
        if (state.audioContext && state.audioContext.state === 'suspended') {
            state.audioContext.resume();
        }
    }
}

/* ========== MAIN GENERATION ========== */
async function generate() {
    el('genBtn').disabled = true;
    show('progress');
    hide('step6');

    state.isProcessing = true;
    state.processingAborted = false;
    state.startTime = performance.now();

    if (state.resultUrl) {
        URL.revokeObjectURL(state.resultUrl);
        state.resultUrl = null;
    }

    await requestWakeLock();
    startSilentAudio();

    log('처리 시작...');
    log(`총 예상 길이: ${formatDuration(calcTotalDuration())}`);

    try {
        // For long videos, use FFmpeg-only pipeline for stability
        await generateWithFFmpeg();

        const elapsed = ((performance.now() - state.startTime) / 1000).toFixed(1);
        setStatus(`완료! (${elapsed}초)`);
        log(`처리 완료: ${elapsed}초`);

    } catch (e) {
        if (state.processingAborted) {
            setStatus('중단됨', true);
            log('사용자에 의해 중단됨');
        } else {
            setStatus(`오류: ${e.message}`, true);
            log(`오류: ${e.message}`);
        }
        console.error(e);
        el('genBtn').disabled = false;
        show('step6');
    } finally {
        state.isProcessing = false;
        releaseWakeLock();
        stopSilentAudio();
    }
}

function setStatus(msg, isError = false) {
    const e = el('status');
    e.textContent = msg;
    e.className = 'status' + (isError ? ' error' : '');
}

function setProg(pct) {
    el('progFill').style.width = pct + '%';
    el('progText').textContent = pct + '%';

    if (pct > 5 && pct < 100) {
        const elapsed = (performance.now() - state.startTime) / 1000;
        const estimated = (elapsed / pct) * (100 - pct);
        el('etaText').textContent = `남은 시간: ${formatETA(estimated)}`;
    } else {
        el('etaText').textContent = '';
    }
}

function abortProcessing() {
    state.processingAborted = true;
    setStatus('중단 중...');
    log('중단 요청...');
}

/* ========== FFmpeg Pipeline ========== */
async function generateWithFFmpeg() {
    setStatus('FFmpeg 로딩...');
    setProg(5);
    await initFFmpeg();

    setStatus('파일 준비...');
    setProg(10);
    await writeFilesToFFmpeg();

    const res = CONFIG.resolution[state.resolution];
    const qual = CONFIG.quality[state.quality];

    // Process each segment
    let segments = [];
    let progressOffset = 10;

    // 1. Process Intro (if exists)
    if (state.introFile) {
        setStatus('인트로 처리...');
        setProg(15);
        await processSegmentFFmpeg('intro.mp4', 'intro_ready.mp4', res, state.startEffect, 'end');
        segments.push('intro_ready.mp4');
        progressOffset = 20;
    }

    // 2. Process Main Video (no speed change, no middle effects)
    setStatus('본편 처리 중... (시간이 오래 걸릴 수 있습니다)');
    setProg(progressOffset);
    log(`본편 처리 시작: ${formatDuration(state.vidMeta.dur)}`);

    // For main video: apply end effect only if no outro
    const mainEndEffect = state.outroFile ? 'none' : state.endEffect;
    await processSegmentFFmpeg('lecture.mp4', 'main_ready.mp4', res, 'none', mainEndEffect);
    segments.push('main_ready.mp4');
    progressOffset = 70;

    // 3. Process Outro (if exists)
    if (state.outroFile) {
        setStatus('아웃트로 처리...');
        setProg(75);
        await processSegmentFFmpeg('outro.mp4', 'outro_ready.mp4', res, 'none', state.endEffect);
        segments.push('outro_ready.mp4');
        progressOffset = 80;
    }

    // 4. Concatenate all segments
    setStatus('영상 합치기...');
    setProg(80);
    await concatVideosFFmpeg(segments);

    // 5. Mix BGM if exists
    if (state.bgmFile) {
        setStatus('BGM 믹싱... (자동 반복)');
        setProg(90);
        await mixBgmFFmpeg();
    }

    setProg(100);
    await showFFmpegResult();
}

async function initFFmpeg() {
    if (state.ffmpeg && state.ffmpeg.isLoaded()) return;

    if (typeof FFmpeg === 'undefined') {
        log('FFmpeg 스크립트 로드...');
        await loadFFmpegScript();
    }

    if (typeof FFmpeg === 'undefined') {
        throw new Error('FFmpeg 로드 실패 - 네트워크 확인 후 새로고침하세요');
    }

    const { createFFmpeg } = FFmpeg;
    state.ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
    });

    state.ffmpeg.setProgress(({ ratio }) => {
        if (ratio > 0) {
            el('progText').textContent = `처리: ${Math.round(ratio * 100)}%`;
        }
    });

    await state.ffmpeg.load();
    log('FFmpeg 로드 완료');
}

async function loadFFmpegScript() {
    return new Promise((resolve, reject) => {
        if (typeof FFmpeg !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
        script.onload = () => {
            log('FFmpeg 스크립트 로드 완료');
            resolve();
        };
        script.onerror = () => reject(new Error('FFmpeg CDN 로드 실패'));
        document.head.appendChild(script);
    });
}

async function writeFilesToFFmpeg() {
    const { fetchFile } = FFmpeg;
    state.ffmpeg.FS('writeFile', 'lecture.mp4', await fetchFile(state.vidFile));
    if (state.introFile) {
        state.ffmpeg.FS('writeFile', 'intro.mp4', await fetchFile(state.introFile));
    }
    if (state.outroFile) {
        state.ffmpeg.FS('writeFile', 'outro.mp4', await fetchFile(state.outroFile));
    }
    if (state.bgmFile) {
        state.ffmpeg.FS('writeFile', 'bgm.mp3', await fetchFile(state.bgmFile));
    }
}

async function processSegmentFFmpeg(inputFile, outputFile, res, startEffect, endEffect) {
    let vf = `scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease,pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2:black`;

    if (state.devicePreset && CONFIG.devices[state.devicePreset]) {
        const p = CONFIG.devices[state.devicePreset];
        const cropH = 1 - p.topCutPct - p.bottomCutPct;
        vf = `crop=in_w:in_h*${cropH.toFixed(4)}:0:in_h*${p.topCutPct.toFixed(4)},` + vf;
    }

    // Add fade effects
    const effectDur = state.effectDuration;
    if (startEffect !== 'none') {
        vf += `,fade=t=in:st=0:d=${effectDur}`;
    }
    if (endEffect !== 'none') {
        // We need to know the duration for fade out
        // This is a simplified approach - fade at the end
        vf += `,fade=t=out:st=0:d=${effectDur}:alpha=1`;
    }

    await state.ffmpeg.run(
        '-i', inputFile,
        '-vf', vf,
        '-r', String(state.fps),
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26',
        '-c:a', 'aac', '-b:a', '128k',
        outputFile
    );
}

async function concatVideosFFmpeg(segments) {
    const concatList = segments.map(s => `file '${s}'`).join('\n');
    state.ffmpeg.FS('writeFile', 'concat.txt', new TextEncoder().encode(concatList));

    await state.ffmpeg.run(
        '-f', 'concat', '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        'output.mp4'
    );
}

async function mixBgmFFmpeg() {
    const totalDuration = calcTotalDuration();

    // BGM auto-loop with -stream_loop -1
    await state.ffmpeg.run(
        '-i', 'output.mp4',
        '-stream_loop', '-1', '-i', 'bgm.mp3',
        '-t', String(Math.ceil(totalDuration)),
        '-filter_complex',
        `[0:a]volume=1[a1];[1:a]volume=${state.bgmVolume.toFixed(2)}[a2];[a1][a2]amix=inputs=2:duration=first`,
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        'final.mp4'
    );

    state.ffmpeg.FS('rename', 'final.mp4', 'output.mp4');
    log('BGM 자동 반복 믹싱 완료');
}

async function showFFmpegResult() {
    const data = state.ffmpeg.FS('readFile', 'output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    cleanupFFmpegFiles();
    showResult(blob);
}

function cleanupFFmpegFiles() {
    const files = [
        'lecture.mp4', 'intro.mp4', 'outro.mp4', 'bgm.mp3',
        'intro_ready.mp4', 'main_ready.mp4', 'outro_ready.mp4',
        'output.mp4', 'final.mp4', 'concat.txt'
    ];

    files.forEach(f => {
        try { state.ffmpeg.FS('unlink', f); } catch (e) {}
    });
    log('임시 파일 정리 완료');
}

/* ========== RESULT ========== */
function showResult(blob) {
    state.resultBlob = blob;
    state.resultUrl = URL.createObjectURL(blob);

    const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
    const elapsed = ((performance.now() - state.startTime) / 1000).toFixed(1);

    el('resultStats').innerHTML = `
        파일 크기: ${sizeMB}MB | 처리 시간: ${elapsed}초
    `;

    el('preview').src = state.resultUrl;

    el('dlLink').href = state.resultUrl;
    el('dlLink').download = `lecture_long_${Date.now()}.mp4`;

    hide('progress');
    show('result');

    log(`결과: ${sizeMB}MB, ${elapsed}초`);
}

async function shareResult() {
    if (!state.resultBlob) return;

    if (navigator.share && navigator.canShare) {
        const file = new File([state.resultBlob], 'lecture_long.mp4', { type: 'video/mp4' });

        if (navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Lecture Long',
                    text: 'Lecture Long Factory로 만든 튜토리얼 영상'
                });
                log('공유 완료');
            } catch (e) {
                if (e.name !== 'AbortError') {
                    alert('공유에 실패했습니다.');
                }
            }
            return;
        }
    }

    alert('이 브라우저에서는 공유 기능을 사용할 수 없습니다.\n다운로드 후 직접 공유해주세요.');
}

/* ========== RESET ========== */
function reset() {
    state.vidFile = null;
    state.introFile = null;
    state.outroFile = null;
    state.bgmFile = null;
    state.vidMeta = { dur: 0, w: 0, h: 0 };
    state.introMeta = { dur: 0, w: 0, h: 0 };
    state.outroMeta = { dur: 0, w: 0, h: 0 };

    el('vidIn').value = '';
    el('introIn').value = '';
    el('outroIn').value = '';
    el('bgmIn').value = '';

    ['vidInfo', 'introInfo', 'outroInfo', 'bgmInfo'].forEach(id => {
        const e = el(id);
        e.className = 'file-info';
        e.innerHTML = '';
    });

    hide('bgmVolControl');
    state.bgmVolume = CONFIG.defaults.bgmVolume;
    el('bgmVolSlider').value = Math.round(state.bgmVolume * 100);
    el('bgmVolValue').textContent = Math.round(state.bgmVolume * 100) + '%';
    if (state.bgmPreviewAudio) {
        state.bgmPreviewAudio.pause();
        state.bgmPreviewAudio = null;
    }
    el('bgmPreviewBtn').textContent = '미리듣기 (5초)';

    setPreset(null);

    state.startEffect = 'none';
    state.endEffect = 'none';
    state.effectDuration = 1.0;

    document.querySelectorAll('#startEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });
    document.querySelectorAll('#endEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });
    const effectDurationSelect = el('effectDuration');
    if (effectDurationSelect) effectDurationSelect.value = '1';

    if (state.resultUrl) {
        URL.revokeObjectURL(state.resultUrl);
        state.resultUrl = null;
    }
    state.resultBlob = null;

    hide('result');
    hide('progress');
    hide('summary');
    hide('fileSizeWarn');
    show('step6');

    el('genBtn').disabled = true;
    setStatus('');
    setProg(0);
    el('progressLog').innerHTML = '';

    state.isProcessing = false;
    state.processingAborted = false;
    releaseWakeLock();
    stopSilentAudio();

    log('리셋 완료');
}

/* ========== SERVICE WORKER ========== */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('./sw.js');
            log('Service Worker 등록됨');

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        show('updateBanner');
                    }
                });
            });
        } catch (e) {
            console.warn('SW 등록 실패:', e);
        }
    }
}

function dismissUpdate() {
    hide('updateBanner');
}

/* ========== MODALS ========== */
function showHelp() {
    el('helpModal').style.display = 'flex';
}

function showKeyboardShortcuts() {
    el('shortcutsModal').style.display = 'flex';
}

function showAbout() {
    el('aboutModal').style.display = 'flex';
}

function closeModal(id) {
    el(id).style.display = 'none';
}
