/**
 * Audio Studio v2.0
 * Cut Mode: 파형에서 시작점 클릭 → 1/2/3분 컷 → MP3 저장
 * Loop Mode: 오디오 업로드 → 5/10/15분 반복 → MP3 저장
 */

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';

// Constants
const CUT_MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
const CUT_MAX_DURATION = 10 * 60; // 10분
const LOOP_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const LOOP_MAX_DURATION = 30 * 60; // 30분
const MP3_BITRATE = 128;
const CROSSFADE_DURATION = 1.0;
const FADEOUT_DURATION = 0.5;

// State
let currentMode = 'cut';
let wavesurfer = null;
let audioBuffer = null;
let audioContext = null;
let originalFileName = '';

// Cut Mode State
let startTime = 0;
let endTime = 0;
let selectedDuration = 0;
let isPlaying = false;

// Loop Mode State
let targetDuration = 0;
let previewSource = null;
let isLoopPlaying = false;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const uploadHint = document.getElementById('uploadHint');
const toast = document.getElementById('toast');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlayMsg');
const progressText = document.getElementById('progressText');

// Cut Mode Elements
const waveformSection = document.getElementById('waveformSection');
const startSection = document.getElementById('startSection');
const cutSection = document.getElementById('cutSection');
const selectionSection = document.getElementById('selectionSection');
const startTimeDisplay = document.getElementById('startTime');
const currentTimeDisplay = document.getElementById('currentTime');
const durationDisplay = document.getElementById('duration');
const selectionRange = document.getElementById('selectionRange');
const playBtn = document.getElementById('playBtn');
const exportCutBtn = document.getElementById('exportCutBtn');

// Loop Mode Elements
const infoSection = document.getElementById('infoSection');
const loopSection = document.getElementById('loopSection');
const actionSection = document.getElementById('actionSection');
const originalDurationEl = document.getElementById('originalDuration');
const loopCountEl = document.getElementById('loopCount');
const targetDurationEl = document.getElementById('targetDuration');
const previewBtn = document.getElementById('previewBtn');
const exportLoopBtn = document.getElementById('exportLoopBtn');

// Initialize
init();

function init() {
    setupTabNavigation();
    setupFileInput();
    setupCutMode();
    setupLoopMode();
}

// Tab Navigation
function setupTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchMode(mode);
        });
    });
}

function switchMode(mode) {
    currentMode = mode;

    // Update tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update content
    document.getElementById('cutMode').classList.toggle('active', mode === 'cut');
    document.getElementById('loopMode').classList.toggle('active', mode === 'loop');

    // Update upload hint
    if (mode === 'cut') {
        uploadHint.textContent = 'WAV / MP3 (30MB, 10분 이하)';
    } else {
        uploadHint.textContent = 'WAV / MP3 (50MB, 30분 이하)';
    }

    // Reset state if file loaded
    if (audioBuffer) {
        if (mode === 'cut') {
            initWaveSurferIfNeeded();
        } else {
            showLoopUI();
        }
    }
}

// File Handling (Shared)
function setupFileInput() {
    fileInput.addEventListener('change', handleFileSelect);
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = currentMode === 'cut' ? CUT_MAX_FILE_SIZE : LOOP_MAX_FILE_SIZE;
    const maxDur = currentMode === 'cut' ? CUT_MAX_DURATION : LOOP_MAX_DURATION;

    if (file.size > maxSize) {
        showToast(`파일이 너무 큽니다 (${maxSize / 1024 / 1024}MB 이하)`, 'error');
        fileInput.value = '';
        return;
    }

    if (!file.type.match(/audio\/(wav|mp3|mpeg)/) && !file.name.match(/\.(wav|mp3)$/i)) {
        showToast('WAV 또는 MP3 파일만 지원합니다', 'error');
        fileInput.value = '';
        return;
    }

    originalFileName = file.name.replace(/\.[^/.]+$/, '');
    fileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;

    try {
        await loadAudio(file, maxDur);
    } catch (err) {
        console.error('Audio load error:', err);
        showToast('오디오 디코딩 실패', 'error');
    }
}

async function loadAudio(file, maxDuration) {
    resetAllState();

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    if (audioBuffer.duration > maxDuration) {
        showToast(`파일이 너무 깁니다 (${maxDuration / 60}분 이하)`, 'error');
        audioBuffer = null;
        return;
    }

    if (currentMode === 'cut') {
        initWaveSurfer(file);
    } else {
        showLoopUI();
    }
}

function resetAllState() {
    // Cut state
    startTime = 0;
    endTime = 0;
    selectedDuration = 0;
    isPlaying = false;

    // Loop state
    targetDuration = 0;
    stopLoopPreview();

    // Reset Cut UI
    startTimeDisplay.textContent = '0:00.0';
    currentTimeDisplay.textContent = '0:00';
    waveformSection.classList.remove('active');
    startSection.classList.remove('active');
    cutSection.classList.remove('active');
    selectionSection.classList.remove('active');
    document.querySelectorAll('.cut-btn').forEach(btn => btn.classList.remove('selected'));

    // Reset Loop UI
    loopCountEl.textContent = '-';
    infoSection.classList.remove('active');
    loopSection.classList.remove('active');
    actionSection.classList.remove('active');
    document.querySelectorAll('.loop-btn').forEach(btn => btn.classList.remove('selected'));
}

// ========== CUT MODE ==========

function setupCutMode() {
    // Fine tune buttons
    document.querySelectorAll('.tune-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const delta = parseFloat(btn.dataset.delta);
            adjustStartTime(delta);
        });
    });

    // Cut buttons
    document.querySelectorAll('.cut-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const duration = parseInt(btn.dataset.duration);
            selectCutDuration(duration, btn);
        });
    });

    // Play button
    playBtn.addEventListener('click', playSelection);

    // Export button
    exportCutBtn.addEventListener('click', exportCutMP3);
}

function initWaveSurfer(file) {
    if (wavesurfer) {
        wavesurfer.destroy();
    }

    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#667eea',
        progressColor: '#4CAF50',
        cursorColor: '#f5576c',
        cursorWidth: 2,
        height: 120,
        normalize: true,
        interact: true,
        hideScrollbar: true,
    });

    wavesurfer.loadBlob(file);

    wavesurfer.on('ready', () => {
        const duration = wavesurfer.getDuration();
        durationDisplay.textContent = formatTime(duration);

        waveformSection.classList.add('active');
        startSection.classList.add('active');
        cutSection.classList.add('active');

        showToast('파형 클릭으로 시작점 선택', 'success');
    });

    wavesurfer.on('click', (relativeX) => {
        const duration = wavesurfer.getDuration();
        const clickedTime = relativeX * duration;
        setStartTime(clickedTime);
    });

    wavesurfer.on('audioprocess', () => {
        currentTimeDisplay.textContent = formatTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on('finish', () => {
        isPlaying = false;
        updatePlayButton();
    });
}

function initWaveSurferIfNeeded() {
    // Re-show Cut UI if audio already loaded
    if (audioBuffer && !wavesurfer) {
        // Need to reload file - show message
        showToast('파일을 다시 선택해주세요', 'error');
    }
}

function setStartTime(time) {
    const duration = wavesurfer.getDuration();
    startTime = Math.round(time * 10) / 10;
    startTime = Math.max(0, Math.min(startTime, duration));

    startTimeDisplay.textContent = formatTimeWithDecimal(startTime);
    wavesurfer.seekTo(startTime / duration);

    if (selectedDuration > 0) {
        calculateEndTime();
    }
}

function adjustStartTime(delta) {
    if (!wavesurfer) return;
    const newTime = startTime + delta;
    setStartTime(newTime);
}

function selectCutDuration(duration, btn) {
    document.querySelectorAll('.cut-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    selectedDuration = duration;
    calculateEndTime();
}

function calculateEndTime() {
    const totalDuration = wavesurfer.getDuration();
    let targetEnd = startTime + selectedDuration;

    if (targetEnd > totalDuration) {
        endTime = totalDuration;
        const actualDuration = endTime - startTime;
        showToast(`파일 끝까지만 자릅니다 (${formatTime(actualDuration)})`, 'success');
    } else {
        endTime = targetEnd;
    }

    const cutDuration = endTime - startTime;
    selectionRange.textContent = `선택 구간: ${formatTimeWithDecimal(startTime)} ~ ${formatTimeWithDecimal(endTime)} (${formatTime(cutDuration)})`;
    selectionSection.classList.add('active');
}

function playSelection() {
    if (!wavesurfer || selectedDuration === 0) return;

    if (isPlaying) {
        wavesurfer.pause();
        isPlaying = false;
    } else {
        wavesurfer.setTime(startTime);
        wavesurfer.play();
        isPlaying = true;

        const checkEnd = setInterval(() => {
            if (wavesurfer.getCurrentTime() >= endTime) {
                wavesurfer.pause();
                isPlaying = false;
                updatePlayButton();
                clearInterval(checkEnd);
            }
            if (!isPlaying) {
                clearInterval(checkEnd);
            }
        }, 50);
    }

    updatePlayButton();
}

function updatePlayButton() {
    playBtn.innerHTML = isPlaying ? '<span>⏸</span> 정지' : '<span>▶</span> 미리듣기';
}

async function exportCutMP3() {
    if (!audioBuffer || selectedDuration === 0) {
        showToast('먼저 구간을 선택하세요', 'error');
        return;
    }

    overlay.classList.add('active');
    overlayMsg.textContent = 'MP3 인코딩 중...';
    progressText.textContent = '';

    try {
        const slicedBuffer = sliceAudioBuffer(audioBuffer, startTime, endTime);
        const mp3Blob = await encodeMP3(slicedBuffer);

        const durationLabel = selectedDuration === 60 ? '1m' : selectedDuration === 120 ? '2m' : '3m';
        const fileName = `${originalFileName}_cut_${durationLabel}.mp3`;
        downloadBlob(mp3Blob, fileName);

        showToast('MP3 저장 완료!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showToast('MP3 인코딩 실패', 'error');
    } finally {
        overlay.classList.remove('active');
    }
}

// ========== LOOP MODE ==========

function setupLoopMode() {
    document.querySelectorAll('.loop-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const duration = parseInt(btn.dataset.duration);
            selectTargetDuration(duration, btn);
        });
    });

    previewBtn.addEventListener('click', toggleLoopPreview);
    exportLoopBtn.addEventListener('click', exportLoopMP3);
}

function showLoopUI() {
    originalDurationEl.textContent = formatTime(audioBuffer.duration);
    infoSection.classList.add('active');
    loopSection.classList.add('active');
    showToast('목표 길이를 선택하세요', 'success');
}

function selectTargetDuration(duration, btn) {
    document.querySelectorAll('.loop-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    targetDuration = duration;

    const loopCount = Math.ceil(targetDuration / audioBuffer.duration);
    loopCountEl.textContent = `${loopCount}회`;

    const mins = Math.floor(duration / 60);
    targetDurationEl.textContent = `${mins}분`;

    actionSection.classList.add('active');
}

function toggleLoopPreview() {
    if (isLoopPlaying) {
        stopLoopPreview();
    } else {
        startLoopPreview();
    }
}

function startLoopPreview() {
    if (!audioBuffer) return;

    stopLoopPreview();

    previewSource = audioContext.createBufferSource();
    previewSource.buffer = audioBuffer;
    previewSource.loop = true;
    previewSource.connect(audioContext.destination);
    previewSource.start();

    isLoopPlaying = true;
    previewBtn.innerHTML = '<span>⏸</span> 정지';

    setTimeout(() => {
        if (isLoopPlaying) stopLoopPreview();
    }, 10000);
}

function stopLoopPreview() {
    if (previewSource) {
        try {
            previewSource.stop();
        } catch (e) {}
        previewSource = null;
    }
    isLoopPlaying = false;
    previewBtn.innerHTML = '<span>▶</span> 미리듣기';
}

function createLoopedBuffer(sourceBuffer, targetSeconds) {
    const sampleRate = sourceBuffer.sampleRate;
    const channels = sourceBuffer.numberOfChannels;
    const sourceSamples = sourceBuffer.length;
    const targetSamples = Math.floor(targetSeconds * sampleRate);
    const crossfadeSamples = Math.floor(CROSSFADE_DURATION * sampleRate);
    const fadeoutSamples = Math.floor(FADEOUT_DURATION * sampleRate);

    const outputBuffer = audioContext.createBuffer(channels, targetSamples, sampleRate);

    for (let channel = 0; channel < channels; channel++) {
        const sourceData = sourceBuffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);

        let outputPos = 0;

        while (outputPos < targetSamples) {
            const remaining = targetSamples - outputPos;

            if (outputPos === 0) {
                const copyLength = Math.min(sourceSamples, remaining);
                for (let i = 0; i < copyLength; i++) {
                    outputData[outputPos + i] = sourceData[i];
                }
                outputPos += copyLength;
            } else {
                const crossfadeStart = outputPos - crossfadeSamples;

                for (let i = 0; i < crossfadeSamples && crossfadeStart + i < targetSamples; i++) {
                    const fadeOut = 1 - (i / crossfadeSamples);
                    const fadeIn = i / crossfadeSamples;
                    const idx = crossfadeStart + i;
                    if (idx >= 0 && idx < targetSamples) {
                        outputData[idx] = outputData[idx] * fadeOut + sourceData[i] * fadeIn;
                    }
                }

                const startIdx = crossfadeSamples;
                const copyLength = Math.min(sourceSamples - startIdx, remaining);

                for (let i = 0; i < copyLength && outputPos + i < targetSamples; i++) {
                    outputData[outputPos + i] = sourceData[startIdx + i];
                }
                outputPos += copyLength;
            }
        }

        for (let i = 0; i < fadeoutSamples; i++) {
            const idx = targetSamples - fadeoutSamples + i;
            if (idx >= 0 && idx < targetSamples) {
                const fadeMultiplier = 1 - (i / fadeoutSamples);
                outputData[idx] *= fadeMultiplier;
            }
        }
    }

    return outputBuffer;
}

async function exportLoopMP3() {
    if (!audioBuffer || targetDuration === 0) {
        showToast('먼저 목표 길이를 선택하세요', 'error');
        return;
    }

    stopLoopPreview();
    overlay.classList.add('active');
    overlayMsg.textContent = '오디오 반복 처리 중...';
    progressText.textContent = '';

    try {
        await sleep(50);
        const loopedBuffer = createLoopedBuffer(audioBuffer, targetDuration);

        overlayMsg.textContent = 'MP3 인코딩 중...';
        await sleep(50);

        const mp3Blob = await encodeMP3(loopedBuffer, true);

        const mins = Math.floor(targetDuration / 60);
        const fileName = `${originalFileName}_loop_${mins}m.mp3`;
        downloadBlob(mp3Blob, fileName);

        showToast('MP3 저장 완료!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showToast('MP3 인코딩 실패', 'error');
    } finally {
        overlay.classList.remove('active');
    }
}

// ========== SHARED UTILITIES ==========

function sliceAudioBuffer(buffer, start, end) {
    const sampleRate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);
    const length = endSample - startSample;

    const slicedBuffer = audioContext.createBuffer(channels, length, sampleRate);

    for (let channel = 0; channel < channels; channel++) {
        const sourceData = buffer.getChannelData(channel);
        const targetData = slicedBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            targetData[i] = sourceData[startSample + i];
        }
    }

    return slicedBuffer;
}

async function encodeMP3(buffer, showProgress = false) {
    return new Promise((resolve, reject) => {
        try {
            const channels = buffer.numberOfChannels;
            const sampleRate = buffer.sampleRate;
            const samples = buffer.length;

            const left = buffer.getChannelData(0);
            const right = channels > 1 ? buffer.getChannelData(1) : left;

            const leftInt16 = floatTo16Bit(left);
            const rightInt16 = floatTo16Bit(right);

            const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, MP3_BITRATE);
            const mp3Data = [];

            const chunkSize = 1152;
            const totalChunks = Math.ceil(samples / chunkSize);
            let processedChunks = 0;

            for (let i = 0; i < samples; i += chunkSize) {
                const leftChunk = leftInt16.subarray(i, i + chunkSize);
                const rightChunk = rightInt16.subarray(i, i + chunkSize);

                let mp3buf;
                if (channels === 1) {
                    mp3buf = mp3encoder.encodeBuffer(leftChunk);
                } else {
                    mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                }

                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }

                processedChunks++;
                if (showProgress && processedChunks % 1000 === 0) {
                    const percent = Math.round((processedChunks / totalChunks) * 100);
                    progressText.textContent = `${percent}%`;
                }
            }

            const end = mp3encoder.flush();
            if (end.length > 0) {
                mp3Data.push(end);
            }

            const blob = new Blob(mp3Data, { type: 'audio/mp3' });
            resolve(blob);
        } catch (err) {
            reject(err);
        }
    });
}

function floatTo16Bit(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeWithDecimal(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const decimal = Math.round((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${decimal}`;
}

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}
