/**
 * File Utils - Shared Module
 * 파일 관련 유틸리티 함수
 */

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * 초를 시:분:초 형식으로 변환
 */
export function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * 초를 시:분:초.밀리초 형식으로 변환
 */
export function formatDurationMs(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * 비디오 메타데이터 추출
 */
export async function getVideoMeta(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
            URL.revokeObjectURL(video.src);
            resolve({
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight,
                aspectRatio: video.videoWidth / video.videoHeight
            });
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video metadata'));
        };

        video.src = URL.createObjectURL(file);
    });
}

/**
 * 오디오 메타데이터 추출
 */
export async function getAudioMeta(file) {
    return new Promise((resolve, reject) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';

        audio.onloadedmetadata = () => {
            URL.revokeObjectURL(audio.src);
            resolve({
                duration: audio.duration
            });
        };

        audio.onerror = () => {
            URL.revokeObjectURL(audio.src);
            reject(new Error('Failed to load audio metadata'));
        };

        audio.src = URL.createObjectURL(file);
    });
}

/**
 * 이미지 메타데이터 추출
 */
export async function getImageMeta(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve({
                width: img.naturalWidth,
                height: img.naturalHeight,
                aspectRatio: img.naturalWidth / img.naturalHeight
            });
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Failed to load image metadata'));
        };

        img.src = URL.createObjectURL(file);
    });
}

/**
 * 파일 확장자 추출
 */
export function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

/**
 * 파일명에서 확장자 제거
 */
export function removeExtension(filename) {
    return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Blob 다운로드
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
