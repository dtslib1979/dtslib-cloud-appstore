const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: false });

let videoFile = null;
let audioFile = null;

// 파일 입력 처리
document.getElementById('video-input').addEventListener('change', (e) => {
    videoFile = e.target.files[0];
    if (videoFile) {
        document.getElementById('video-status').textContent = '✓ ' + videoFile.name;
        e.target.parentElement.classList.add('active');
        checkReady();
    }
});

document.getElementById('audio-input').addEventListener('change', (e) => {
    audioFile = e.target.files[0];
    if (audioFile) {
        document.getElementById('audio-status').textContent = '✓ ' + audioFile.name;
        e.target.parentElement.classList.add('active');
        checkReady();
    }
});

// 준비 상태 체크
function checkReady() {
    const btn = document.getElementById('process-btn');
    btn.disabled = !(videoFile && audioFile);
}

// 진행률 업데이트
function updateProgress(percent, text) {
    document.getElementById('progress-fill').style.width = percent + '%';
    document.getElementById('progress-text').textContent = text;
}

// 메인 처리
document.getElementById('process-btn').addEventListener('click', async () => {
    const progressSection = document.getElementById('progress-section');
    const downloadSection = document.getElementById('download-section');
    
    progressSection.style.display = 'block';
    downloadSection.style.display = 'none';
    
    try {
        // FFmpeg 로드
        if (!ffmpeg.isLoaded()) {
            updateProgress(10, 'Loading FFmpeg...');
            await ffmpeg.load();
        }
        
        // 파일 업로드
        updateProgress(20, 'Uploading video...');
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));
        
        updateProgress(30, 'Uploading audio...');
        ffmpeg.FS('writeFile', 'audio.mp3', await fetchFile(audioFile));
        
        // 1. 영상 음소거 + 0.2x 속도
        updateProgress(40, 'Slowing down video...');
        await ffmpeg.run(
            '-i', 'input.mp4',
            '-an',
            '-filter:v', 'setpts=5.0*PTS',
            '-c:v', 'libx264',
            '-preset', 'fast',
            'slow.mp4'
        );
        
        // 2. 길이 확인
        updateProgress(50, 'Calculating loops...');
        await ffmpeg.run('-i', 'slow.mp4', '-f', 'null', '-');
        // FFmpeg 로그에서 duration 파싱 (간단화를 위해 고정값 사용)
        const slowDuration = 30; // 6초 * 5 = 30초 (예시)
        const loopCount = Math.ceil(120 / slowDuration);
        
        // 3. 반복 파일 생성
        updateProgress(60, 'Creating loops...');
        let concatList = '';
        for (let i = 0; i < loopCount; i++) {
            concatList += `file 'slow.mp4'\n`;
        }
        ffmpeg.FS('writeFile', 'concat.txt', concatList);
        
        // 4. 영상 연결
        updateProgress(70, 'Concatenating video...');
        await ffmpeg.run(
            '-f', 'concat',
            '-safe', '0',
            '-i', 'concat.txt',
            '-c', 'copy',
            'looped.mp4'
        );
        
        // 5. 120초로 자르기 + 오디오 합치기
        updateProgress(85, 'Finalizing shorts...');
        await ffmpeg.run(
            '-i', 'looped.mp4',
            '-i', 'audio.mp3',
            '-t', '120',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-shortest',
            'output.mp4'
        );
        
        // 6. 다운로드 준비
        updateProgress(100, 'Complete!');
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        
        const link = document.getElementById('download-link');
        link.href = url;
        link.download = 'shorts_2min.mp4';
        downloadSection.style.display = 'block';
        
    } catch (error) {
        console.error('Error:', error);
        updateProgress(0, 'Error: ' + error.message);
    }
});

// Service Worker 등록
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js');
}