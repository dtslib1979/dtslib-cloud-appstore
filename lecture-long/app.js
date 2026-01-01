/**
 * Lecture Long Factory v2.0
 * Professional PWA for Long Tutorial Video Processing
 *
 * Based on Lecture Shorts Factory v6.5 Pro
 * Target: 12 minutes output (from ~16 min input at 1.3x speed)
 *
 * Features:
 * - WebCodecs API (Hardware Acceleration)
 * - FFmpeg.wasm (Audio Processing)
 * - Configurable Output Settings
 * - Dark/Light Theme
 * - Keyboard Shortcuts
 * - Settings Persistence (LocalStorage)
 * - ETA Calculation
 * - File Validation
 * - Memory Management
 * - Drag & Drop Support
 * - Transition Effects (TV, VHS, Focus, Tremble, Zoom)
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

    // Default Settings
    defaults: {
        quality: 'medium',
        resolution: 720,
        targetDuration: 720, // 12 minutes
        fps: 30,
        bgmVolume: 0.1
    },

    // Limits
    limits: {
        maxFileSize: 500 * 1024 * 1024, // 500MB
        maxDuration: 1200, // 20 minutes
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
    bgmFile: null,

    // Metadata
    vidMeta: { dur: 0, w: 0, h: 0 },
    introMeta: { dur: 0, w: 0, h: 0 },

    // Settings
    quality: CONFIG.defaults.quality,
    resolution: CONFIG.defaults.resolution,
    targetDuration: CONFIG.defaults.targetDuration,
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

    // Transition Effects
    transitionEffect: 'none',
    endingEffect: 'none',
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
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}분 ${s}초`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
        const res = await fetch('/apps.json');
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

    // Service worker removed in v6.5

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

}

/* ========== KEYBOARD SHORTCUTS ========== */
function handleKeyboard(e) {
    // Ignore if in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
    }

    // Escape - close modal or abort
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal[style*="block"]');
        if (modals.length > 0) {
            modals.forEach(m => m.style.display = 'none');
        } else if (state.isProcessing) {
            abortProcessing();
        }
        return;
    }

    // Don't process other shortcuts if modal is open
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

function updateDuration() {
    const min = parseInt(el('targetMin').value) || 0;
    const sec = parseInt(el('targetSec').value) || 0;
    state.targetDuration = Math.max(CONFIG.limits.minDuration, Math.min(CONFIG.limits.maxDuration, min * 60 + sec));
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
        targetDuration: state.targetDuration,
        fps: state.fps,
        bgmVolume: state.bgmVolume
    };
    localStorage.setItem(CONFIG.storage.settings, JSON.stringify(settings));
    log('설정 저장됨');
    alert('✅ 설정이 저장되었습니다.');
}

function loadSettings() {
    try {
        const saved = localStorage.getItem(CONFIG.storage.settings);
        if (saved) {
            const settings = JSON.parse(saved);
            state.quality = settings.quality || CONFIG.defaults.quality;
            state.resolution = settings.resolution || CONFIG.defaults.resolution;
            state.targetDuration = settings.targetDuration || CONFIG.defaults.targetDuration;
            state.fps = settings.fps || CONFIG.defaults.fps;
            state.bgmVolume = settings.bgmVolume ?? CONFIG.defaults.bgmVolume;

            // Update UI
            applySettingsToUI();
            log('저장된 설정 로드됨');
        }
    } catch (e) {
        console.warn('설정 로드 실패:', e);
    }
}

function applySettingsToUI() {
    // Quality
    setQuality(state.quality);

    // Resolution
    el('resolutionSelect').value = state.resolution;

    // Duration
    el('targetMin').value = Math.floor(state.targetDuration / 60);
    el('targetSec').value = state.targetDuration % 60;

    // FPS
    el('fpsSelect').value = state.fps;

    // BGM Volume
    el('bgmVolSlider').value = Math.round(state.bgmVolume * 100);
    el('bgmVolValue').textContent = Math.round(state.bgmVolume * 100) + '%';
}

function resetSettings() {
    state.quality = CONFIG.defaults.quality;
    state.resolution = CONFIG.defaults.resolution;
    state.targetDuration = CONFIG.defaults.targetDuration;
    state.fps = CONFIG.defaults.fps;
    state.bgmVolume = CONFIG.defaults.bgmVolume;
    applySettingsToUI();
    log('설정 초기화됨');
}

/* ========== TRANSITION EFFECTS ========== */
function setTransition(effect) {
    state.transitionEffect = effect;

    // Update UI buttons
    const buttons = document.querySelectorAll('#transitionEffects .effect-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === effect);
    });

    updateSummary();
    log(`트랜지션 효과: ${effect}`);
}

function setEnding(effect) {
    state.endingEffect = effect;

    // Update UI buttons
    const buttons = document.querySelectorAll('#endingEffects .effect-btn');
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
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} effect - Effect type (tv, vhs, focus, tremble, zoom)
 * @param {number} progress - Effect progress 0-1 (0=start, 1=end)
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function applyTransitionEffect(ctx, effect, progress, width, height) {
    if (!ctx || !effect) {
        console.error('Invalid ctx or effect:', ctx, effect);
        return;
    }

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
            case 'tremble':
                applyTrembleEffect(ctx, progress, width, height);
                break;
            case 'zoom':
                applyZoomEffect(ctx, progress, width, height);
                break;
            default:
                console.warn('Unknown effect:', effect);
        }
    } catch (e) {
        console.error('Effect error:', e);
    }
}

/**
 * TV Effect - Black bars closing from top/bottom (like old TV turning off)
 * progress: 1 = normal, 0 = fully closed (black)
 */
function applyTVEffect(ctx, progress, width, height) {
    // 검은 바가 위아래에서 닫히는 효과
    const barSize = Math.floor((height / 2) * (1 - progress));

    if (barSize > 0) {
        // 위쪽 검은 바
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, barSize);

        // 아래쪽 검은 바
        ctx.fillRect(0, height - barSize, width, barSize);

        // 스캔라인 효과 (더 강하게)
        ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * (1 - progress)})`;
        for (let y = 0; y < height; y += 2) {
            ctx.fillRect(0, y, width, 1);
        }
    }

    // 마지막에 흰색 수평선 (TV 꺼질 때)
    if (progress < 0.15) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, height / 2 - 3, width, 6);
    }
}

/**
 * VHS Effect - Distortion, noise, tracking lines
 * progress: 1 = normal, 0 = max distortion
 */
function applyVHSEffect(ctx, progress, width, height) {
    const intensity = 1 - progress; // 0 -> 1

    // 노이즈 오버레이
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * intensity})`;
    for (let i = 0; i < 50 * intensity; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        ctx.fillRect(x, y, Math.random() * 3, 1);
    }

    // 수평 글리치 라인
    ctx.fillStyle = `rgba(0, 255, 255, ${0.3 * intensity})`;
    for (let i = 0; i < 5 * intensity; i++) {
        const y = Math.random() * height;
        ctx.fillRect(0, y, width, 2);
    }

    // 트래킹 라인 (위에서 아래로)
    const trackY = ((1 - progress) * 1.5 * height) % height;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * intensity})`;
    ctx.fillRect(0, trackY, width, 8);
    ctx.fillRect(0, trackY + 15, width, 3);

    // 색수차 효과 - 빨간색/파란색 오프셋
    if (intensity > 0.3) {
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(255, 0, 0, ${0.1 * intensity})`;
        ctx.fillRect(3 * intensity, 0, width, height);
        ctx.fillStyle = `rgba(0, 0, 255, ${0.1 * intensity})`;
        ctx.fillRect(-3 * intensity, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
    }
}

/**
 * Focus Effect - Vignette fade to black
 * progress: 1 = normal, 0 = fully dark vignette
 */
function applyFocusEffect(ctx, progress, width, height) {
    const intensity = 1 - progress;

    // 방사형 비네팅 (중앙은 밝고 가장자리는 어둡게)
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.6
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, `rgba(0,0,0,${0.3 * intensity})`);
    gradient.addColorStop(1, `rgba(0,0,0,${0.9 * intensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 페이드 투 블랙
    ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * intensity})`;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Tremble/Shake Effect - Flash and shake simulation
 * progress: 1 = normal, 0 = max shake/flash
 */
function applyTrembleEffect(ctx, progress, width, height) {
    const intensity = 1 - progress;

    // 플래시 효과 (흰색 깜빡임)
    if (Math.random() < intensity * 0.5) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * intensity})`;
        ctx.fillRect(0, 0, width, height);
    }

    // 검은색 프레임 깜빡임
    if (Math.random() < intensity * 0.3) {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * intensity})`;
        ctx.fillRect(0, 0, width, height);
    }

    // 수평 글리치 라인
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * intensity})`;
    for (let i = 0; i < 10 * intensity; i++) {
        const y = Math.random() * height;
        const h = Math.random() * 5 + 1;
        ctx.fillRect(0, y, width, h);
    }

    // 가장자리 어둡게
    ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * intensity})`;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Zoom Effect - Zoom out with fade to black
 * progress: 1 = normal, 0 = zoomed out and dark
 */
function applyZoomEffect(ctx, progress, width, height) {
    const intensity = 1 - progress;

    // 중앙으로 수렴하는 원형 페이드
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * (0.8 - intensity * 0.5)
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.7, `rgba(0,0,0,${0.5 * intensity})`);
    gradient.addColorStop(1, `rgba(0,0,0,${1 * intensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 추가 페이드
    ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * intensity})`;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Apply ending effect (inverse of transition - fades out)
 */
function applyEndingEffect(ctx, effect, progress, width, height) {
    // Ending effects work in reverse (1 to 0 progression)
    applyTransitionEffect(ctx, effect, 1 - progress, width, height);
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

    // Validate file
    const validation = validateFile(file, type);
    if (!validation.valid) {
        showInfo(type + 'Info', `❌ ${validation.error}`, 'error');
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
        } else if (type === 'bgm') {
            state.bgmFile = file;
            showInfo('bgmInfo', `✅ ${file.name}<br>🔊 자동 루프`, 'success');
            show('bgmVolControl');
        }

        checkReady();
        updateSummary();
    } catch (e) {
        showInfo(type + 'Info', `❌ ${e.message}`, 'error');
    }
}

function validateFile(file, type) {
    // Size check
    if (file.size > CONFIG.limits.maxFileSize) {
        return { valid: false, error: `파일이 너무 큽니다 (최대 ${formatFileSize(CONFIG.limits.maxFileSize)})` };
    }

    // Type check
    if (type === 'bgm') {
        if (!file.type.startsWith('audio/')) {
            return { valid: false, error: '오디오 파일만 지원됩니다' };
        }
    } else {
        if (!file.type.startsWith('video/')) {
            return { valid: false, error: '비디오 파일만 지원됩니다' };
        }
    }

    // Show warning for large files
    if (file.size > 200 * 1024 * 1024) {
        const warn = el('fileSizeWarn');
        warn.textContent = `⚠️ ${formatFileSize(file.size)} - 큰 파일은 처리 시간이 오래 걸릴 수 있습니다`;
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
    const speed = calcSpeed();
    const targetMain = state.targetDuration - state.introMeta.dur;
    const speedClass = speed >= 2.0 ? 'warn' : 'success';

    showInfo('vidInfo',
        `✅ ${state.vidFile.name}<br>` +
        `📐 ${state.vidMeta.w}×${state.vidMeta.h} → ${state.resolution}p<br>` +
        `⏱️ ${formatDuration(state.vidMeta.dur)} → ${formatDuration(targetMain)} (${speed.toFixed(2)}x)<br>` +
        `📦 ${formatFileSize(state.vidFile.size)}`,
        speedClass
    );
}

function updateIntroInfo() {
    let warn = '';
    if (state.introMeta.dur > 120) warn = ' ⚠️ 2분 초과';

    showInfo('introInfo',
        `✅ ${state.introFile.name}<br>⏱️ ${formatDuration(state.introMeta.dur)}${warn}`,
        state.introMeta.dur > 120 ? 'warn' : 'success'
    );

    // Update video info if already loaded
    if (state.vidFile) updateVidInfo();
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
    el('genBtn').disabled = !(state.vidFile && state.introFile);
}

function calcSpeed() {
    const targetMain = state.targetDuration - state.introMeta.dur;
    if (targetMain <= 0) return 2.0;
    return Math.max(1.0, Math.min(2.0, state.vidMeta.dur / targetMain));
}

function updateSummary() {
    if (!state.vidFile || !state.introFile) {
        hide('summary');
        return;
    }

    const res = CONFIG.resolution[state.resolution];
    const qual = CONFIG.quality[state.quality];
    const speed = calcSpeed();

    // Effect name mapping for display
    const effectNames = {
        'none': '없음',
        'tv': 'TV',
        'vhs': 'VHS',
        'focus': 'FOCUS',
        'tremble': 'TREMBLE',
        'zoom': 'ZOOM'
    };

    el('summaryContent').innerHTML = `
        <ul>
            <li>📐 해상도: ${res.width}×${res.height}</li>
            <li>⏱️ 목표 길이: ${formatDuration(state.targetDuration)}</li>
            <li>🎬 FPS: ${state.fps}</li>
            <li>📊 품질: ${state.quality} (${(qual.bitrate / 1000000).toFixed(1)}Mbps)</li>
            <li>⚡ 재생속도: ${speed.toFixed(2)}x</li>
            ${state.bgmFile ? `<li>🎵 BGM: ${Math.round(state.bgmVolume * 100)}%</li>` : ''}
            ${state.devicePreset ? `<li>📱 크롭: ${CONFIG.devices[state.devicePreset].name}</li>` : ''}
            ${state.transitionEffect !== 'none' ? `<li>✨ 트랜지션: ${effectNames[state.transitionEffect]} (${state.effectDuration}초)</li>` : ''}
            ${state.endingEffect !== 'none' ? `<li>🎬 엔딩: ${effectNames[state.endingEffect]} (${state.effectDuration}초)</li>` : ''}
        </ul>
    `;
    show('summary');
}

/* ========== BGM PREVIEW ========== */
function previewBgm() {
    if (!state.bgmFile) return;

    const btn = el('bgmPreviewBtn');

    // Stop if playing
    if (state.bgmPreviewAudio && !state.bgmPreviewAudio.paused) {
        state.bgmPreviewAudio.pause();
        state.bgmPreviewAudio = null;
        btn.textContent = '▶️ 미리듣기 (5초)';
        return;
    }

    // Play
    state.bgmPreviewAudio = new Audio(URL.createObjectURL(state.bgmFile));
    state.bgmPreviewAudio.volume = state.bgmVolume;
    state.bgmPreviewAudio.play();
    btn.textContent = '⏹️ 정지';

    // Auto stop after 5 seconds
    setTimeout(() => {
        if (state.bgmPreviewAudio) {
            state.bgmPreviewAudio.pause();
            state.bgmPreviewAudio = null;
            btn.textContent = '▶️ 미리듣기 (5초)';
        }
    }, 5000);

    state.bgmPreviewAudio.onended = () => {
        btn.textContent = '▶️ 미리듣기 (5초)';
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
        log('⚠️ 백그라운드 전환됨');
    } else {
        log('✅ 포그라운드 복귀');
        if (state.audioContext && state.audioContext.state === 'suspended') {
            state.audioContext.resume();
        }
    }
}

/* ========== MAIN GENERATION ========== */
async function generate() {
    el('genBtn').disabled = true;
    show('progress');
    hide('step5');

    state.isProcessing = true;
    state.processingAborted = false;
    state.startTime = performance.now();

    // Clear previous result
    if (state.resultUrl) {
        URL.revokeObjectURL(state.resultUrl);
        state.resultUrl = null;
    }

    // Background protection
    await requestWakeLock();
    startSilentAudio();

    log('처리 시작...');

    try {
        if (state.useWebCodecs) {
            await generateWithWebCodecs();
        } else {
            await generateWithFFmpeg();
        }

        const elapsed = ((performance.now() - state.startTime) / 1000).toFixed(1);
        setStatus(`✅ 완료! (${elapsed}초)`);
        log(`처리 완료: ${elapsed}초`);

    } catch (e) {
        if (state.processingAborted) {
            setStatus('⏸️ 중단됨', true);
            log('사용자에 의해 중단됨');
        } else {
            setStatus(`❌ ${e.message}`, true);
            log(`오류: ${e.message}`);
        }
        console.error(e);
        el('genBtn').disabled = false;
        show('step5');
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

    // Calculate ETA
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
    setStatus('⏸️ 중단 중...');
    log('중단 요청...');
}

/* ========== WebCodecs Pipeline ========== */
async function generateWithWebCodecs() {
    setStatus('라이브러리 로딩...');
    setProg(5);
    await loadMp4Muxer();

    const res = CONFIG.resolution[state.resolution];
    const qual = CONFIG.quality[state.quality];
    const { Muxer, ArrayBufferTarget } = Mp4Muxer;

    // Initialize Muxer
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'avc', width: res.width, height: res.height },
        fastStart: 'in-memory'
    });

    // Initialize Encoder
    const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => { throw new Error(`인코더 오류: ${e.message}`); }
    });

    await encoder.configure({
        codec: 'avc1.42001f',
        width: res.width,
        height: res.height,
        bitrate: qual.bitrate,
        framerate: state.fps,
        hardwareAcceleration: 'prefer-hardware'
    });

    // Process Intro
    setStatus('인트로 처리 중...');
    setProg(10);
    log('인트로 프레임 처리 시작');
    if (state.transitionEffect !== 'none') {
        log(`트랜지션 효과: ${state.transitionEffect} (${state.effectDuration}초)`);
    }

    const introFrames = Math.floor(state.introMeta.dur * state.fps);
    const mainFrames = Math.floor((state.targetDuration - state.introMeta.dur) * state.fps);
    const totalFrames = introFrames + mainFrames;

    // Intro with transition effect at the end
    const introEffectConfig = state.transitionEffect !== 'none'
        ? { type: 'transition', position: 'end' }
        : null;

    await processVideoFrames(state.introFile, state.introMeta, 1, encoder, res, (i, total) => {
        const pct = 10 + Math.floor((i / totalFrames) * 40);
        setProg(pct);
        if (i % 30 === 0) setStatus(`인트로: ${i}/${total} 프레임`);
    }, 0, null, introEffectConfig);

    // Process Main Video
    setStatus('본편 처리 중...');
    const speed = calcSpeed();
    const introOffset = state.introMeta.dur * 1000000; // microseconds
    log(`본편 처리 시작 (속도: ${speed.toFixed(2)}x)`);
    if (state.endingEffect !== 'none') {
        log(`엔딩 효과: ${state.endingEffect} (${state.effectDuration}초)`);
    }

    // Main video with ending effect at the end
    const mainEffectConfig = state.endingEffect !== 'none'
        ? { type: 'ending', position: 'end' }
        : null;

    await processVideoFrames(state.vidFile, state.vidMeta, speed, encoder, res, (i, total) => {
        const pct = 50 + Math.floor((i / mainFrames) * 40);
        setProg(pct);
        if (i % 30 === 0) setStatus(`본편: ${i}/${total} (${speed.toFixed(1)}x)`);
    }, introOffset, mainFrames, mainEffectConfig);

    // Finalize video
    setStatus('MP4 생성 중...');
    setProg(90);

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    const videoBlob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    log(`비디오 생성 완료: ${formatFileSize(videoBlob.size)}`);

    // Mix audio
    setStatus('오디오 처리 중...');
    setProg(92);
    const finalBlob = await mixAudioWithFFmpeg(videoBlob, speed);

    setProg(100);
    showResult(finalBlob);
}

/**
 * Process video frames with optional transition/ending effects
 * @param {File} file - Video file
 * @param {Object} meta - Video metadata
 * @param {number} speed - Playback speed
 * @param {VideoEncoder} encoder - WebCodecs encoder
 * @param {Object} res - Resolution config
 * @param {Function} onProgress - Progress callback
 * @param {number} timestampOffset - Timestamp offset in microseconds
 * @param {number} maxFrames - Maximum frames to process
 * @param {Object} effectConfig - Effect configuration {type: 'transition'|'ending'|'none', position: 'end'}
 */
async function processVideoFrames(file, meta, speed, encoder, res, onProgress, timestampOffset = 0, maxFrames = null, effectConfig = null) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error('비디오 로드 실패'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = res.width;
    canvas.height = res.height;
    const ctx = canvas.getContext('2d', { alpha: false });

    const outputDuration = meta.dur / speed;
    const frameInterval = 1 / state.fps;
    let totalFrames = Math.floor(outputDuration * state.fps);

    if (maxFrames && totalFrames > maxFrames) {
        totalFrames = maxFrames;
    }

    // Calculate effect frames
    const effectFrames = Math.floor(state.effectDuration * state.fps);
    let effectType = null;
    let effectName = 'none';

    if (effectConfig) {
        effectType = effectConfig.type;
        if (effectType === 'transition') {
            effectName = state.transitionEffect;
        } else if (effectType === 'ending') {
            effectName = state.endingEffect;
        }
        log(`⚙️ 효과 설정: type=${effectType}, name=${effectName}, frames=${effectFrames}, total=${totalFrames}`);
    }

    for (let i = 0; i < totalFrames; i++) {
        if (state.processingAborted) throw new Error('사용자 중단');

        const sourceTime = i * frameInterval * speed;
        if (sourceTime >= meta.dur) break;

        video.currentTime = sourceTime;
        await new Promise(r => { video.onseeked = r; });

        // Calculate crop
        let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

        if (state.devicePreset && CONFIG.devices[state.devicePreset]) {
            const p = CONFIG.devices[state.devicePreset];
            sy = Math.floor(video.videoHeight * p.topCutPct);
            sh = Math.floor(video.videoHeight * (1 - p.topCutPct - p.bottomCutPct));
        }

        // Draw to canvas (letterbox)
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, res.width, res.height);

        const scale = Math.min(res.width / sw, res.height / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = (res.width - dw) / 2;
        const dy = (res.height - dh) / 2;

        ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);

        // Apply effects at the end of the video segment
        if (effectName !== 'none' && effectType) {
            const framesFromEnd = totalFrames - 1 - i;

            if (framesFromEnd < effectFrames) {
                // progress: 1 (시작) -> 0 (끝, 완전히 효과 적용)
                const progress = framesFromEnd / effectFrames;

                // 첫 프레임과 마지막 프레임에서 로그
                if (framesFromEnd === effectFrames - 1) {
                    log(`🎬 ${effectType} 효과 시작: ${effectName} (progress=${progress.toFixed(2)})`);
                }
                if (framesFromEnd === 0) {
                    log(`🎬 ${effectType} 효과 완료: ${effectName} (progress=${progress.toFixed(2)})`);
                }

                applyTransitionEffect(ctx, effectName, progress, res.width, res.height);
            }
        }

        // Create and encode frame
        const timestamp = timestampOffset + (i * frameInterval * 1000000);
        const frame = new VideoFrame(canvas, { timestamp });
        encoder.encode(frame, { keyFrame: i % 60 === 0 });
        frame.close();

        if (onProgress) onProgress(i + 1, totalFrames);

        // Yield to main thread periodically
        if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
    }

    URL.revokeObjectURL(video.src);
}

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

/* ========== Audio Mixing with FFmpeg ========== */
async function mixAudioWithFFmpeg(videoBlob, mainSpeed) {
    setStatus('FFmpeg 로딩 중...');
    await initFFmpeg();

    if (typeof FFmpeg === 'undefined' || !FFmpeg.fetchFile) {
        throw new Error('FFmpeg 초기화 실패');
    }

    const { fetchFile } = FFmpeg;

    // Write files to FFmpeg
    log('파일 쓰기 시작...');
    state.ffmpeg.FS('writeFile', 'video.mp4', new Uint8Array(await videoBlob.arrayBuffer()));
    state.ffmpeg.FS('writeFile', 'intro.mp4', await fetchFile(state.introFile));
    state.ffmpeg.FS('writeFile', 'lecture.mp4', await fetchFile(state.vidFile));
    if (state.bgmFile) {
        state.ffmpeg.FS('writeFile', 'bgm.mp3', await fetchFile(state.bgmFile));
    }

    setStatus('인트로 오디오 추출...');
    setProg(93);
    log('인트로 오디오 추출');

    // Extract intro audio to PCM for reliable concatenation
    await state.ffmpeg.run(
        '-i', 'intro.mp4',
        '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2',
        'intro_audio.wav'
    );

    setStatus('본편 오디오 추출...');
    setProg(94);
    log('본편 오디오 추출');

    // Extract main audio to PCM
    await state.ffmpeg.run(
        '-i', 'lecture.mp4',
        '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2',
        'lecture_audio_raw.wav'
    );

    setStatus('오디오 속도 조절...');
    log(`오디오 속도 조절: ${mainSpeed.toFixed(2)}x`);

    // Speed adjust (atempo supports 0.5-2.0)
    const af = mainSpeed <= 2.0
        ? `atempo=${mainSpeed.toFixed(4)}`
        : `atempo=2.0,atempo=${(mainSpeed / 2).toFixed(4)}`;

    await state.ffmpeg.run(
        '-i', 'lecture_audio_raw.wav',
        '-filter:a', af,
        '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2',
        'main_audio.wav'
    );

    setStatus('오디오 합치기...');
    setProg(95);
    log('인트로 + 본편 오디오 연결 (filter_complex)');

    // Use filter_complex concat for reliable audio concatenation
    await state.ffmpeg.run(
        '-i', 'intro_audio.wav',
        '-i', 'main_audio.wav',
        '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[aout]',
        '-map', '[aout]',
        '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2',
        'combined_audio.wav'
    );

    setStatus('영상에 오디오 합성...');
    setProg(96);

    // Mix with BGM or just add audio
    if (state.bgmFile && state.bgmVolume > 0) {
        setStatus('BGM 믹싱 중...');
        setProg(97);
        log(`BGM 믹싱: 볼륨 ${(state.bgmVolume * 100).toFixed(0)}%`);

        // First convert BGM to consistent format
        await state.ffmpeg.run(
            '-stream_loop', '-1',
            '-i', 'bgm.mp3',
            '-t', String(state.targetDuration),
            '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2',
            'bgm_loop.wav'
        );

        // Mix combined audio with BGM
        await state.ffmpeg.run(
            '-i', 'video.mp4',
            '-i', 'combined_audio.wav',
            '-i', 'bgm_loop.wav',
            '-filter_complex',
            `[1:a]volume=1.0[voice];[2:a]volume=${state.bgmVolume.toFixed(2)}[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
            '-map', '0:v', '-map', '[aout]',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
            '-t', String(state.targetDuration),
            '-shortest',
            'output.mp4'
        );
    } else {
        await state.ffmpeg.run(
            '-i', 'video.mp4',
            '-i', 'combined_audio.wav',
            '-map', '0:v', '-map', '1:a',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
            '-t', String(state.targetDuration),
            '-shortest',
            'output.mp4'
        );
    }

    setProg(99);
    log('최종 파일 읽기...');
    const data = state.ffmpeg.FS('readFile', 'output.mp4');

    // Cleanup
    cleanupFFmpegFiles();

    return new Blob([data.buffer], { type: 'video/mp4' });
}

/* ========== FFmpeg Fallback ========== */
async function generateWithFFmpeg() {
    setStatus('FFmpeg 로딩...');
    setProg(5);
    await initFFmpeg();

    setStatus('파일 준비...');
    setProg(10);
    await writeFilesToFFmpeg();

    setStatus('인트로 처리...');
    setProg(15);
    await prepareIntroFFmpeg();

    setStatus('본편 처리... (시간 소요)');
    setProg(20);
    await processMainFFmpeg();

    setStatus('영상 합치기...');
    setProg(80);
    await concatVideosFFmpeg();

    if (state.bgmFile) {
        setStatus('BGM 믹싱...');
        setProg(90);
        await mixBgmFFmpeg();
    }

    setProg(100);
    await showFFmpegResult();
}

async function initFFmpeg() {
    if (state.ffmpeg && state.ffmpeg.isLoaded()) return;

    // Load FFmpeg script if not available
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
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.6/dist/ffmpeg-core.js'
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
    state.ffmpeg.FS('writeFile', 'intro.mp4', await fetchFile(state.introFile));
    if (state.bgmFile) {
        state.ffmpeg.FS('writeFile', 'bgm.mp3', await fetchFile(state.bgmFile));
    }
}

async function prepareIntroFFmpeg() {
    const res = CONFIG.resolution[state.resolution];
    const vf = `scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease,pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2:black`;

    await state.ffmpeg.run(
        '-i', 'intro.mp4',
        '-vf', vf,
        '-r', String(state.fps),
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26',
        '-c:a', 'aac', '-b:a', '128k',
        'intro_ready.mp4'
    );
}

async function processMainFFmpeg() {
    const res = CONFIG.resolution[state.resolution];
    const speed = calcSpeed();

    let vf = `setpts=PTS/${speed}`;

    if (state.devicePreset && CONFIG.devices[state.devicePreset]) {
        const p = CONFIG.devices[state.devicePreset];
        const cropH = 1 - p.topCutPct - p.bottomCutPct;
        vf += `,crop=in_w:in_h*${cropH.toFixed(4)}:0:in_h*${p.topCutPct.toFixed(4)}`;
    }

    vf += `,scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease`;
    vf += `,pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2:black`;

    const af = speed <= 2.0 ? `atempo=${speed}` : `atempo=2.0,atempo=${(speed/2).toFixed(3)}`;

    await state.ffmpeg.run(
        '-i', 'lecture.mp4',
        '-vf', vf,
        '-af', af,
        '-r', String(state.fps),
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26',
        '-c:a', 'aac', '-b:a', '128k',
        'main_ready.mp4'
    );
}

async function concatVideosFFmpeg() {
    state.ffmpeg.FS('writeFile', 'concat.txt',
        new TextEncoder().encode("file 'intro_ready.mp4'\nfile 'main_ready.mp4'\n"));

    await state.ffmpeg.run(
        '-f', 'concat', '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        'output.mp4'
    );
}

async function mixBgmFFmpeg() {
    await state.ffmpeg.run(
        '-i', 'output.mp4',
        '-stream_loop', '-1', '-i', 'bgm.mp3',
        '-t', String(state.targetDuration),
        '-filter_complex',
        `[0:a]volume=1[a1];[1:a]volume=${state.bgmVolume.toFixed(2)}[a2];[a1][a2]amix=inputs=2:duration=first`,
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        'final.mp4'
    );

    state.ffmpeg.FS('rename', 'final.mp4', 'output.mp4');
}

async function showFFmpegResult() {
    const data = state.ffmpeg.FS('readFile', 'output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    cleanupFFmpegFiles();
    showResult(blob);
}

function cleanupFFmpegFiles() {
    const files = [
        'video.mp4', 'intro.mp4', 'lecture.mp4', 'bgm.mp3',
        'intro_audio.m4a', 'lecture_audio_raw.m4a', 'main_audio.m4a', 'combined_audio.m4a',
        'intro_audio.wav', 'lecture_audio_raw.wav', 'main_audio.wav', 'combined_audio.wav', 'bgm_loop.wav',
        'intro_ready.mp4', 'main_ready.mp4',
        'output.mp4', 'final.mp4', 'audio_list.txt', 'concat.txt'
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

    // Stats
    el('resultStats').innerHTML = `
        📦 파일 크기: ${sizeMB}MB | ⏱️ 처리 시간: ${elapsed}초
    `;

    // Preview
    el('preview').src = state.resultUrl;

    // Download link
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
                    text: 'Lecture Long Factory로 만든 영상'
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

    // Fallback: copy URL
    alert('이 브라우저에서는 공유 기능을 사용할 수 없습니다.\n다운로드 후 직접 공유해주세요.');
}

/* ========== RESET ========== */
function reset() {
    // Clear files
    state.vidFile = null;
    state.introFile = null;
    state.bgmFile = null;
    state.vidMeta = { dur: 0, w: 0, h: 0 };
    state.introMeta = { dur: 0, w: 0, h: 0 };

    // Clear inputs
    el('vidIn').value = '';
    el('introIn').value = '';
    el('bgmIn').value = '';

    // Clear info
    ['vidInfo', 'introInfo', 'bgmInfo'].forEach(id => {
        const e = el(id);
        e.className = 'file-info';
        e.innerHTML = '';
    });

    // Reset BGM controls
    hide('bgmVolControl');
    state.bgmVolume = CONFIG.defaults.bgmVolume;
    el('bgmVolSlider').value = Math.round(state.bgmVolume * 100);
    el('bgmVolValue').textContent = Math.round(state.bgmVolume * 100) + '%';
    if (state.bgmPreviewAudio) {
        state.bgmPreviewAudio.pause();
        state.bgmPreviewAudio = null;
    }
    el('bgmPreviewBtn').textContent = '▶️ 미리듣기 (5초)';

    // Reset device preset
    setPreset(null);

    // Reset transition effects
    state.transitionEffect = 'none';
    state.endingEffect = 'none';
    state.effectDuration = 1.0;

    // Reset effect buttons in UI
    document.querySelectorAll('#transitionEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });
    document.querySelectorAll('#endingEffects .effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.effect === 'none');
    });
    const effectDurationSelect = el('effectDuration');
    if (effectDurationSelect) effectDurationSelect.value = '1';

    // Clear result
    if (state.resultUrl) {
        URL.revokeObjectURL(state.resultUrl);
        state.resultUrl = null;
    }
    state.resultBlob = null;

    // Reset UI
    hide('result');
    hide('progress');
    hide('summary');
    hide('fileSizeWarn');
    show('step5');

    el('genBtn').disabled = true;
    setStatus('');
    setProg(0);
    el('progressLog').innerHTML = '';

    // Reset processing state
    state.isProcessing = false;
    state.processingAborted = false;
    releaseWakeLock();
    stopSilentAudio();

    log('리셋 완료');
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
