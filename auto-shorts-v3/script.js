// Auto Shorts Maker v3 - Real ffmpeg.wasm implementation
// 싱글스레드 방식으로 브라우저에서 직접 영상 편집

const { FFmpeg } = FFmpegWASM;
const { fetchFile } = FFmpegUtil;

let ffmpeg = null;
let videoFile = null;
let audioFile = null;
let videoDuration = 0;

// 해상도 설정
const MAX_HEIGHT = 720;

// DOM 요소
const videoInput = document.getElementById('video-input');
const audioInput = document.getElementById('audio-input');
const videoStatus = document.getElementById('video-status');
const audioStatus = document.getElementById('audio-status');
const processBtn = document.getElementById('process-btn');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressDetail = document.getElementById('progress-detail');
const downloadSection = document.getElementById('download-section');
const downloadLink = document.getElementById('download-link');
const fileInfo = document.getElementById('file-info');
const errorSection = document.getElementById('error-section');
const errorMsg = document.getElementById('error-msg');
const downscaleOption = document.getElementById('downscale-option');

// FFmpeg 로드
async function loadFFmpeg() {
    if (!ffmpeg) {
        ffmpeg = new FFmpeg();
        
        ffmpeg.on('log', ({ message }) => {
            console.log(message);
            // 진행률 파싱
            if (message.includes('frame=')) {
                const match = message.match(/time=(\d{2}):(\d{2}):(\d{2})/);
                if (match) {
                    const hours = parseInt(match[1]);
                    const minutes = parseInt(match[2]);
                    const seconds = parseInt(match[3]);
                    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                    const progress = Math.min((totalSeconds / 120) * 100, 95);
                    updateProgress(progress, `Processing: ${Math.floor(totalSeconds)}s / 120s`);
                }
            }
        });

        ffmpeg.on('progress', ({ progress, time }) => {
            const percent = Math.min(progress * 100, 95);
            updateProgress(percent, `Processing: ${Math.floor(time / 1000000)}s`);
        });
    }
    
    updateProgress(10, 'Loading FFmpeg...');
    
    try {
        await ffmpeg.load({
            coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
        });
        updateProgress(20, 'FFmpeg loaded successfully');
        return true;
    } catch (error) {
        console.error('FFmpeg load error:', error);
        showError('Failed to load FFmpeg: ' + error.message);
        return false;
    }
}

// 비디오 길이 측정
async function getVideoDuration(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = function() {
            window.URL.revokeObjectURL(video.src);
            resolve(video.duration);
        };
        video.src = URL.createObjectURL(file);
    });
}

// 파일 입력 처리
videoInput.addEventListener('change', async (e) => {
    videoFile = e.target.files[0];
    if (videoFile) {
        videoStatus.textContent = '✓ ' + videoFile.name;
        videoInput.parentElement.classList.add('active');
        
        // 비디오 길이 측정
        try {
            videoDuration = await getVideoDuration(videoFile);
            progressDetail.textContent = `Video duration: ${videoDuration.toFixed(1)}s`;
        } catch (error) {
            console.error('Duration error:', error);
        }
        
        checkReady();
    }
});

audioInput.addEventListener('change', (e) => {
    audioFile = e.target.files[0];
    if (audioFile) {
        audioStatus.textContent = '✓ ' + audioFile.name;
        audioInput.parentElement.classList.add('active');
        checkReady();
    }
});

// 준비 상태 체크
function checkReady() {
    processBtn.disabled = !(videoFile && audioFile);
}

// 진행률 업데이트
function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

// 에러 표시
function showError(msg) {
    errorSection.style.display = 'block';
    errorMsg.textContent = '❌ ' + msg;
    console.error(msg);
}

// 메인 처리
processBtn.addEventListener('click', async () => {
    // UI 초기화
    progressSection.style.display = 'block';
    downloadSection.style.display = 'none';
    errorSection.style.display = 'none';
    processBtn.disabled = true;
    
    try {
        // 1. FFmpeg 로드
        const loaded = await loadFFmpeg();
        if (!loaded) return;
        
        // 2. 파일 업로드
        updateProgress(25, 'Writing video file...');
        await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
        
        updateProgress(30, 'Writing audio file...');
        await ffmpeg.writeFile('audio.mp3', await fetchFile(audioFile));
        
        // 3. 반복 횟수 계산
        const slowDuration = videoDuration * 5.0; // 0.2x 속도
        const loopCount = Math.ceil(120 / slowDuration);
        progressDetail.textContent = `Slow: ${slowDuration.toFixed(1)}s, Loops: ${loopCount}`;
        
        // 4. FFmpeg 명령 실행
        updateProgress(35, 'Processing video...');
        
        const scaleFilter = downscaleOption.checked 
            ? `,scale=-2:${MAX_HEIGHT}` 
            : '';
        
        const args = [
            '-stream_loop', String(loopCount - 1), // 0부터 시작하므로 -1
            '-i', 'input.mp4',
            '-i', 'audio.mp3',
            '-vf', `setpts=5.0*PTS${scaleFilter}`,
            '-map', '0:v',
            '-map', '1:a',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-t', '120',
            '-y',
            'output.mp4'
        ];
        
        console.log('FFmpeg command:', args.join(' '));
        await ffmpeg.exec(args);
        
        // 5. 결과 파일 읽기
        updateProgress(95, 'Preparing download...');
        const data = await ffmpeg.readFile('output.mp4');
        
        // 6. 다운로드 링크 생성
        const blob = new Blob([data], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const size = (blob.size / (1024 * 1024)).toFixed(2);
        
        downloadLink.href = url;
        fileInfo.textContent = `File size: ${size} MB`;
        
        updateProgress(100, 'Complete! 🎉');
        downloadSection.style.display = 'block';
        
        // 메모리 정리
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 300000); // 5분 후 정리
        
    } catch (error) {
        console.error('Processing error:', error);
        showError('Processing failed: ' + error.message);
        updateProgress(0, 'Error occurred');
    } finally {
        processBtn.disabled = false;
    }
});

// Service Worker 등록
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => console.log('SW registered'))
        .catch(err => console.log('SW error:', err));
}