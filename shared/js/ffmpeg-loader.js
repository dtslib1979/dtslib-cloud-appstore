/**
 * FFmpeg Loader - Shared Module
 * FFmpeg.wasm 초기화 및 관리
 */

let ffmpeg = null;
let ffmpegLoaded = false;

export async function loadFFmpeg(onProgress = () => {}) {
    if (ffmpegLoaded && ffmpeg) {
        return ffmpeg;
    }

    const { createFFmpeg, fetchFile } = FFmpeg;

    ffmpeg = createFFmpeg({
        log: false,
        progress: ({ ratio }) => {
            onProgress(Math.round(ratio * 100));
        }
    });

    await ffmpeg.load();
    ffmpegLoaded = true;

    return ffmpeg;
}

export function getFFmpeg() {
    return ffmpeg;
}

export function isFFmpegLoaded() {
    return ffmpegLoaded;
}

export async function writeFile(name, data) {
    if (!ffmpeg) throw new Error('FFmpeg not loaded');
    const { fetchFile } = FFmpeg;
    ffmpeg.FS('writeFile', name, await fetchFile(data));
}

export function readFile(name) {
    if (!ffmpeg) throw new Error('FFmpeg not loaded');
    return ffmpeg.FS('readFile', name);
}

export function deleteFile(name) {
    if (!ffmpeg) throw new Error('FFmpeg not loaded');
    try {
        ffmpeg.FS('unlink', name);
    } catch (e) {
        // File might not exist
    }
}

export async function runCommand(args) {
    if (!ffmpeg) throw new Error('FFmpeg not loaded');
    await ffmpeg.run(...args);
}
