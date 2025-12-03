// FFmpeg.wasm setup (single-thread version, no SharedArrayBuffer)
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

let videoFile = null;
let audioFile = null;

// DOM elements
const videoInput = document.getElementById('video-input');
const audioInput = document.getElementById('audio-input');
const videoStatus = document.getElementById('video-status');
const audioStatus = document.getElementById('audio-status');
const processBtn = document.getElementById('process-btn');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const errorSection = document.getElementById('error-section');
const errorText = document.getElementById('error-text');
const downloadSection = document.getElementById('download-section');
const downloadLink = document.getElementById('download-link');

// Step 1: Video upload handler
videoInput.addEventListener('change', (e) => {
    videoFile = e.target.files[0];
    if (videoFile) {
        videoStatus.textContent = '✓ ' + videoFile.name;
        e.target.parentElement.classList.add('active');
        checkReady();
    }
});

// Step 2: Audio upload handler
audioInput.addEventListener('change', (e) => {
    audioFile = e.target.files[0];
    if (audioFile) {
        audioStatus.textContent = '✓ ' + audioFile.name;
        e.target.parentElement.classList.add('active');
        checkReady();
    }
});

// Check if both files are ready
function checkReady() {
    processBtn.disabled = !(videoFile && audioFile);
}

// Update progress UI
function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

// Show error message
function showError(message) {
    errorSection.style.display = 'block';
    errorText.textContent = message;
    progressSection.style.display = 'none';
}

// Hide error message
function hideError() {
    errorSection.style.display = 'none';
}

// Get video duration using HTML5 video element
function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = function() {
            window.URL.revokeObjectURL(video.src);
            const duration = video.duration;
            resolve(duration);
        };
        
        video.onerror = function() {
            reject(new Error('Failed to load video metadata'));
        };
        
        video.src = URL.createObjectURL(file);
    });
}

// Step 3: Main processing function
processBtn.addEventListener('click', async () => {
    // Reset UI
    hideError();
    progressSection.style.display = 'block';
    downloadSection.style.display = 'none';
    processBtn.disabled = true;
    
    try {
        // 1. Load FFmpeg
        if (!ffmpeg.isLoaded()) {
            updateProgress(5, 'Loading FFmpeg...');
            await ffmpeg.load();
        }
        
        updateProgress(10, 'Analyzing video...');
        
        // 2. Get video duration
        const videoDuration = await getVideoDuration(videoFile);
        console.log('Video duration:', videoDuration, 'seconds');
        
        // Validate video duration (6-10 seconds recommended)
        if (videoDuration < 3) {
            throw new Error('Video is too short. Please upload a video at least 3 seconds long.');
        }
        
        // 3. Calculate loop count for exactly 120 seconds
        const targetDuration = 120; // 2 minutes
        const loopCount = Math.ceil(targetDuration / videoDuration);
        console.log('Loop count:', loopCount);
        
        updateProgress(15, `Preparing to loop ${loopCount}x...`);
        
        // 4. Write files to FFmpeg virtual filesystem
        updateProgress(20, 'Loading video file...');
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));
        
        updateProgress(25, 'Loading audio file...');
        ffmpeg.FS('writeFile', 'audio.mp3', await fetchFile(audioFile));
        
        // 5. Remove original audio from video
        updateProgress(30, 'Removing original audio...');
        await ffmpeg.run(
            '-i', 'input.mp4',
            '-an',
            '-c:v', 'copy',
            'silent.mp4'
        );
        
        // 6. Create concat file for looping
        updateProgress(40, 'Creating loop pattern...');
        let concatContent = '';
        for (let i = 0; i < loopCount; i++) {
            concatContent += "file 'silent.mp4'\n";
        }
        ffmpeg.FS('writeFile', 'concat.txt', concatContent);
        
        // 7. Concatenate video to create loops
        updateProgress(50, `Looping video ${loopCount} times...`);
        await ffmpeg.run(
            '-f', 'concat',
            '-safe', '0',
            '-i', 'concat.txt',
            '-c', 'copy',
            'looped.mp4'
        );
        
        // 8. Trim to exactly 120 seconds and add audio
        updateProgress(70, 'Adding audio track...');
        await ffmpeg.run(
            '-i', 'looped.mp4',
            '-i', 'audio.mp3',
            '-t', '120',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-shortest',
            'output.mp4'
        );
        
        updateProgress(90, 'Preparing download...');
        
        // 9. Read output file
        const data = ffmpeg.FS('readFile', 'output.mp4');
        
        // 10. Create download link
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        
        downloadLink.href = url;
        downloadLink.download = 'auto-shorts-2min.mp4';
        
        updateProgress(100, 'Complete! 🎉');
        downloadSection.style.display = 'block';
        
        // Clean up FFmpeg files
        try {
            ffmpeg.FS('unlink', 'input.mp4');
            ffmpeg.FS('unlink', 'audio.mp3');
            ffmpeg.FS('unlink', 'silent.mp4');
            ffmpeg.FS('unlink', 'concat.txt');
            ffmpeg.FS('unlink', 'looped.mp4');
            ffmpeg.FS('unlink', 'output.mp4');
        } catch (e) {
            console.log('Cleanup error (non-critical):', e);
        }
        
    } catch (error) {
        console.error('Processing error:', error);
        showError(`Error: ${error.message || 'Unknown error occurred. Please try again.'}`);
    } finally {
        processBtn.disabled = false;
    }
});

// Service Worker registration (optional, for offline support)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}
