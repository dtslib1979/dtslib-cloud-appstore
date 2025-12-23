/**
 * Parksy AudioCut v1.0
 * 파형에서 시작점 클릭 → 1/2/3분 컷 → MP3 저장
 */

// WaveSurfer.js v7 ESM import
import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';

// Constants
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_DURATION = 10 * 60; // 10분
const MP3_BITRATE = 128;

// State
let wavesurfer = null;
let audioBuffer = null;
let audioContext = null;
let startTime = 0;
let endTime = 0;
let selectedDuration = 0;
let originalFileName = '';
let isPlaying = false;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const waveformSection = document.getElementById('waveformSection');
const startSection = document.getElementById('startSection');
const cutSection = document.getElementById('cutSection');
const selectionSection = document.getElementById('selectionSection');
const startTimeDisplay = document.getElementById('startTime');
const currentTimeDisplay = document.getElementById('currentTime');
const durationDisplay = document.getElementById('duration');
const selectionRange = document.getElementById('selectionRange');
const playBtn = document.getElementById('playBtn');
const exportBtn = document.getElementById('exportBtn');
const toast = document.getElementById('toast');
const overlay = document.getElementById('overlay');

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    // File input handler
    fileInput.addEventListener('change', handleFileSelect);

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
    exportBtn.addEventListener('click', exportMP3);
}

// File handling
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        showToast('파일이 너무 큽니다 (30MB 이하)', 'error');
        fileInput.value = '';
        return;
    }

    // Validate file type
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
        showToast('오디오 디코딩 실패', 'error');
    }
}

async function loadAudio(file) {
    // Reset state
    resetState();

    // Create AudioContext
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Decode audio
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Validate duration
    if (audioBuffer.duration > MAX_DURATION) {
        showToast('파일이 너무 깁니다 (10분 이하)', 'error');
        audioBuffer = null;
        return;
    }

    // Initialize WaveSurfer
    initWaveSurfer(file);
}

function initWaveSurfer(file) {
    // Destroy existing instance
    if (wavesurfer) {
        wavesurfer.destroy();
    }

    // Create WaveSurfer
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

    // Load file
    wavesurfer.loadBlob(file);

    // Events
    wavesurfer.on('ready', () => {
        const duration = wavesurfer.getDuration();
        durationDisplay.textContent = formatTime(duration);

        // Show UI sections
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

function resetState() {
    startTime = 0;
    endTime = 0;
    selectedDuration = 0;
    isPlaying = false;

    // Reset UI
    startTimeDisplay.textContent = '0:00.0';
    currentTimeDisplay.textContent = '0:00';
    selectionSection.classList.remove('active');
    document.querySelectorAll('.cut-btn').forEach(btn => btn.classList.remove('selected'));
}

// Start time handling
function setStartTime(time) {
    const duration = wavesurfer.getDuration();
    // Snap to 0.1s
    startTime = Math.round(time * 10) / 10;
    // Clamp to valid range
    startTime = Math.max(0, Math.min(startTime, duration));

    startTimeDisplay.textContent = formatTimeWithDecimal(startTime);

    // Update wavesurfer cursor
    wavesurfer.seekTo(startTime / duration);

    // If duration was selected, recalculate end time
    if (selectedDuration > 0) {
        calculateEndTime();
    }
}

function adjustStartTime(delta) {
    if (!wavesurfer) return;
    const newTime = startTime + delta;
    setStartTime(newTime);
}

// Cut duration selection
function selectCutDuration(duration, btn) {
    // Update button states
    document.querySelectorAll('.cut-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    selectedDuration = duration;
    calculateEndTime();
}

function calculateEndTime() {
    const totalDuration = wavesurfer.getDuration();
    let targetEnd = startTime + selectedDuration;

    // Edge case: clamp to total duration
    if (targetEnd > totalDuration) {
        endTime = totalDuration;
        const actualDuration = endTime - startTime;
        showToast(`파일 끝까지만 자릅니다 (${formatTime(actualDuration)})`, 'success');
    } else {
        endTime = targetEnd;
    }

    // Update selection info
    const cutDuration = endTime - startTime;
    selectionRange.textContent = `선택 구간: ${formatTimeWithDecimal(startTime)} ~ ${formatTimeWithDecimal(endTime)} (${formatTime(cutDuration)})`;

    // Show selection section
    selectionSection.classList.add('active');
}

// Playback
function playSelection() {
    if (!wavesurfer || selectedDuration === 0) return;

    if (isPlaying) {
        wavesurfer.pause();
        isPlaying = false;
    } else {
        wavesurfer.setTime(startTime);
        wavesurfer.play();
        isPlaying = true;

        // Stop at end time
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

// MP3 Export
async function exportMP3() {
    if (!audioBuffer || selectedDuration === 0) {
        showToast('먼저 구간을 선택하세요', 'error');
        return;
    }

    // Show overlay
    overlay.classList.add('active');

    try {
        // Slice audio buffer
        const slicedBuffer = sliceAudioBuffer(audioBuffer, startTime, endTime);

        // Encode to MP3
        const mp3Blob = await encodeMP3(slicedBuffer);

        // Download
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

async function encodeMP3(audioBuffer) {
    return new Promise((resolve, reject) => {
        try {
            const channels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const samples = audioBuffer.length;

            // Get channel data
            const left = audioBuffer.getChannelData(0);
            const right = channels > 1 ? audioBuffer.getChannelData(1) : left;

            // Convert to Int16
            const leftInt16 = floatTo16Bit(left);
            const rightInt16 = floatTo16Bit(right);

            // Initialize lamejs encoder
            const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, MP3_BITRATE);
            const mp3Data = [];

            // Encode in chunks
            const chunkSize = 1152;
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
            }

            // Flush remaining data
            const end = mp3encoder.flush();
            if (end.length > 0) {
                mp3Data.push(end);
            }

            // Create blob
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

// Utility functions
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

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}
