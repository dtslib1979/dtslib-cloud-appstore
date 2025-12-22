/**
 * Parksy AudioLoop v1.0
 * 오디오 업로드 → 5/10/15분 반복 → MP3 저장
 * 크로스페이드 1초, 마지막 0.5초 페이드아웃
 */

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DURATION = 30 * 60; // 30분
const MP3_BITRATE = 128;
const CROSSFADE_DURATION = 1.0; // 1초 크로스페이드
const FADEOUT_DURATION = 0.5; // 0.5초 페이드아웃

// State
let audioBuffer = null;
let audioContext = null;
let targetDuration = 0;
let originalFileName = '';
let previewSource = null;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const infoSection = document.getElementById('infoSection');
const loopSection = document.getElementById('loopSection');
const actionSection = document.getElementById('actionSection');
const originalDurationEl = document.getElementById('originalDuration');
const loopCountEl = document.getElementById('loopCount');
const targetDurationEl = document.getElementById('targetDuration');
const previewBtn = document.getElementById('previewBtn');
const exportBtn = document.getElementById('exportBtn');
const toast = document.getElementById('toast');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlayMsg');
const progressText = document.getElementById('progressText');

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    fileInput.addEventListener('change', handleFileSelect);

    document.querySelectorAll('.loop-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const duration = parseInt(btn.dataset.duration);
            selectTargetDuration(duration, btn);
        });
    });

    previewBtn.addEventListener('click', togglePreview);
    exportBtn.addEventListener('click', exportMP3);
}

// File handling
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
        showToast('파일이 너무 큽니다 (50MB 이하)', 'error');
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
        await loadAudio(file);
    } catch (err) {
        console.error('Audio load error:', err);
        showToast('오디오를 불러올 수 없습니다', 'error');
    }
}

async function loadAudio(file) {
    resetState();

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    if (audioBuffer.duration > MAX_DURATION) {
        showToast('파일이 너무 깁니다 (30분 이하)', 'error');
        audioBuffer = null;
        return;
    }

    // Show UI
    originalDurationEl.textContent = formatTime(audioBuffer.duration);
    infoSection.classList.add('active');
    loopSection.classList.add('active');

    showToast('목표 길이를 선택하세요', 'success');
}

function resetState() {
    targetDuration = 0;
    stopPreview();

    loopCountEl.textContent = '-';
    actionSection.classList.remove('active');
    document.querySelectorAll('.loop-btn').forEach(btn => btn.classList.remove('selected'));
}

// Duration selection
function selectTargetDuration(duration, btn) {
    document.querySelectorAll('.loop-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    targetDuration = duration;

    // Calculate loop count
    const loopCount = Math.ceil(targetDuration / audioBuffer.duration);
    loopCountEl.textContent = `${loopCount}회`;

    // Update target info
    const mins = Math.floor(duration / 60);
    targetDurationEl.textContent = `${mins}분`;

    actionSection.classList.add('active');
}

// Preview
let isPlaying = false;

function togglePreview() {
    if (isPlaying) {
        stopPreview();
    } else {
        startPreview();
    }
}

function startPreview() {
    if (!audioBuffer) return;

    stopPreview();

    previewSource = audioContext.createBufferSource();
    previewSource.buffer = audioBuffer;
    previewSource.loop = true;
    previewSource.connect(audioContext.destination);
    previewSource.start();

    isPlaying = true;
    previewBtn.innerHTML = '<span>⏸</span> 정지';

    // Auto stop after 10 seconds
    setTimeout(() => {
        if (isPlaying) stopPreview();
    }, 10000);
}

function stopPreview() {
    if (previewSource) {
        try {
            previewSource.stop();
        } catch (e) {}
        previewSource = null;
    }
    isPlaying = false;
    previewBtn.innerHTML = '<span>▶</span> 미리듣기';
}

// Create looped audio with crossfade
function createLoopedBuffer(sourceBuffer, targetSeconds) {
    const sampleRate = sourceBuffer.sampleRate;
    const channels = sourceBuffer.numberOfChannels;
    const sourceSamples = sourceBuffer.length;
    const targetSamples = Math.floor(targetSeconds * sampleRate);
    const crossfadeSamples = Math.floor(CROSSFADE_DURATION * sampleRate);
    const fadeoutSamples = Math.floor(FADEOUT_DURATION * sampleRate);

    // Create output buffer
    const outputBuffer = audioContext.createBuffer(channels, targetSamples, sampleRate);

    for (let channel = 0; channel < channels; channel++) {
        const sourceData = sourceBuffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);

        let outputPos = 0;

        while (outputPos < targetSamples) {
            const remaining = targetSamples - outputPos;

            if (outputPos === 0) {
                // First loop: copy without crossfade at start
                const copyLength = Math.min(sourceSamples, remaining);
                for (let i = 0; i < copyLength; i++) {
                    outputData[outputPos + i] = sourceData[i];
                }
                outputPos += copyLength;
            } else {
                // Subsequent loops: apply crossfade
                const crossfadeStart = outputPos - crossfadeSamples;

                // Apply crossfade to overlap region
                for (let i = 0; i < crossfadeSamples && crossfadeStart + i < targetSamples; i++) {
                    const fadeOut = 1 - (i / crossfadeSamples); // Previous audio fading out
                    const fadeIn = i / crossfadeSamples; // New audio fading in
                    const idx = crossfadeStart + i;
                    if (idx >= 0 && idx < targetSamples) {
                        outputData[idx] = outputData[idx] * fadeOut + sourceData[i] * fadeIn;
                    }
                }

                // Copy rest of the loop (after crossfade region)
                const startIdx = crossfadeSamples;
                const copyLength = Math.min(sourceSamples - startIdx, remaining);

                for (let i = 0; i < copyLength && outputPos + i < targetSamples; i++) {
                    outputData[outputPos + i] = sourceData[startIdx + i];
                }
                outputPos += copyLength;
            }
        }

        // Apply fadeout at the end
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

// MP3 Export
async function exportMP3() {
    if (!audioBuffer || targetDuration === 0) {
        showToast('먼저 목표 길이를 선택하세요', 'error');
        return;
    }

    stopPreview();
    overlay.classList.add('active');
    overlayMsg.textContent = '오디오 반복 처리 중...';
    progressText.textContent = '';

    try {
        // Create looped buffer
        await sleep(50); // UI update
        const loopedBuffer = createLoopedBuffer(audioBuffer, targetDuration);

        overlayMsg.textContent = 'MP3 인코딩 중...';
        await sleep(50);

        // Encode to MP3
        const mp3Blob = await encodeMP3(loopedBuffer);

        // Download
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

async function encodeMP3(buffer) {
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
                if (processedChunks % 1000 === 0) {
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

// Utilities
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
