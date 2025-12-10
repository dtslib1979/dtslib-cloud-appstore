const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

let vidFile = null;
let audFile = null;

const vidIn = document.getElementById('video-input');
const audIn = document.getElementById('audio-input');
const vidStat = document.getElementById('video-status');
const audStat = document.getElementById('audio-status');
const procBtn = document.getElementById('process-btn');
const progSec = document.getElementById('progress-section');
const progFill = document.getElementById('progress-fill');
const progText = document.getElementById('progress-text');
const errSec = document.getElementById('error-section');
const errText = document.getElementById('error-text');
const dlSec = document.getElementById('download-section');
const dlLink = document.getElementById('download-link');

vidIn.addEventListener('change', (e) => {
    vidFile = e.target.files[0];
    if (!vidFile) return;
    vidStat.textContent = '✓ ' + vidFile.name;
    e.target.parentElement.classList.add('active');
    checkReady();
});

audIn.addEventListener('change', (e) => {
    audFile = e.target.files[0];
    if (!audFile) return;
    audStat.textContent = '✓ ' + audFile.name;
    e.target.parentElement.classList.add('active');
    checkReady();
});

function checkReady() {
    procBtn.disabled = !(vidFile && audFile);
}

function setProgress(pct, txt) {
    progFill.style.width = pct + '%';
    progText.textContent = txt;
}

function showErr(msg) {
    errSec.style.display = 'block';
    errText.textContent = msg;
    progSec.style.display = 'none';
}

function hideErr() {
    errSec.style.display = 'none';
}

function getVidDur(file) {
    return new Promise((res, rej) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => {
            URL.revokeObjectURL(v.src);
            res(v.duration);
        };
        v.onerror = () => rej(new Error('영상 메타데이터 로드 실패'));
        v.src = URL.createObjectURL(file);
    });
}

procBtn.addEventListener('click', async () => {
    hideErr();
    progSec.style.display = 'block';
    dlSec.style.display = 'none';
    procBtn.disabled = true;
    
    try {
        if (!ffmpeg.isLoaded()) {
            setProgress(5, 'FFmpeg 로딩 중...');
            await ffmpeg.load();
        }
        
        setProgress(10, '영상 분석 중...');
        const dur = await getVidDur(vidFile);
        
        if (dur < 3) {
            throw new Error('영상이 너무 짧습니다. 3초 이상 업로드하세요.');
        }
        
        const loops = Math.ceil(120 / dur);
        setProgress(15, `${loops}회 반복 준비 중...`);
        
        setProgress(20, '영상 파일 로딩...');
        ffmpeg.FS('writeFile', 'in.mp4', await fetchFile(vidFile));
        
        setProgress(25, '오디오 파일 로딩...');
        ffmpeg.FS('writeFile', 'aud.mp3', await fetchFile(audFile));
        
        setProgress(30, '원본 오디오 제거...');
        await ffmpeg.run('-i','in.mp4','-an','-c:v','copy','mute.mp4');
        
        setProgress(40, '반복 패턴 생성...');
        let concat = '';
        for (let i = 0; i < loops; i++) concat += "file 'mute.mp4'\n";
        ffmpeg.FS('writeFile', 'list.txt', concat);
        
        setProgress(50, `영상 ${loops}회 반복 중...`);
        await ffmpeg.run('-f','concat','-safe','0','-i','list.txt','-c','copy','loop.mp4');
        
        setProgress(70, '오디오 합성 중...');
        await ffmpeg.run(
            '-i','loop.mp4','-i','aud.mp3','-t','120',
            '-c:v','libx264','-preset','medium','-crf','18',
            '-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',
            '-shortest','out.mp4'
        );
        
        setProgress(90, '다운로드 준비...');
        const data = ffmpeg.FS('readFile', 'out.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        
        dlLink.href = url;
        dlLink.download = 'shorts-2min.mp4';
        
        setProgress(100, '완료! 🎉');
        dlSec.style.display = 'block';
        
        try {
            ffmpeg.FS('unlink','in.mp4');
            ffmpeg.FS('unlink','aud.mp3');
            ffmpeg.FS('unlink','mute.mp4');
            ffmpeg.FS('unlink','list.txt');
            ffmpeg.FS('unlink','loop.mp4');
            ffmpeg.FS('unlink','out.mp4');
        } catch(e) {}
        
    } catch (err) {
        showErr('오류: ' + (err.message || '알 수 없는 오류'));
    } finally {
        procBtn.disabled = false;
    }
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}
