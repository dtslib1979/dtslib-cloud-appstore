const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: false,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

let vidFile = null;
let audFile = null;

const $ = id => document.getElementById(id);
const vidIn = $('video-input');
const audIn = $('audio-input');
const vidStat = $('video-status');
const audStat = $('audio-status');
const procBtn = $('process-btn');
const progSec = $('progress-section');
const progFill = $('progress-fill');
const progText = $('progress-text');
const errSec = $('error-section');
const errText = $('error-text');
const dlSec = $('download-section');
const dlLink = $('download-link');
const retryBtn = $('retry-btn');
const newBtn = $('new-btn');

vidIn.onchange = e => {
    vidFile = e.target.files[0];
    if (!vidFile) return;
    vidStat.textContent = '✓ ' + vidFile.name;
    e.target.parentElement.classList.add('active');
    checkReady();
};

audIn.onchange = e => {
    audFile = e.target.files[0];
    if (!audFile) return;
    audStat.textContent = '✓ ' + audFile.name;
    e.target.parentElement.classList.add('active');
    checkReady();
};

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

function reset() {
    vidFile = null;
    audFile = null;
    vidIn.value = '';
    audIn.value = '';
    vidStat.textContent = '';
    audStat.textContent = '';
    vidIn.parentElement.classList.remove('active');
    audIn.parentElement.classList.remove('active');
    procBtn.disabled = true;
    progSec.style.display = 'none';
    dlSec.style.display = 'none';
    hideErr();
    setProgress(0, '');
}

function getVidDur(file) {
    return new Promise((res, rej) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => {
            URL.revokeObjectURL(v.src);
            res(v.duration);
        };
        v.onerror = () => rej(new Error('영상 로드 실패'));
        v.src = URL.createObjectURL(file);
    });
}

async function process() {
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
        
        if (dur < 3) throw new Error('3초 이상 영상 필요');
        if (dur > 30) throw new Error('30초 이하 영상 필요');
        
        const loops = Math.ceil(120 / dur);
        setProgress(15, `${loops}회 반복 예정`);
        
        setProgress(20, '파일 로딩...');
        ffmpeg.FS('writeFile', 'in.mp4', await fetchFile(vidFile));
        ffmpeg.FS('writeFile', 'aud.mp3', await fetchFile(audFile));
        
        setProgress(30, '오디오 제거...');
        await ffmpeg.run('-i','in.mp4','-an','-c:v','copy','mute.mp4');
        
        setProgress(40, '반복 생성...');
        let list = '';
        for (let i = 0; i < loops; i++) list += "file 'mute.mp4'\n";
        ffmpeg.FS('writeFile', 'list.txt', list);
        
        setProgress(50, '영상 병합...');
        await ffmpeg.run('-f','concat','-safe','0','-i','list.txt','-c','copy','loop.mp4');
        
        setProgress(70, '최종 인코딩...');
        await ffmpeg.run(
            '-i','loop.mp4','-i','aud.mp3','-t','120',
            '-c:v','libx264','-preset','medium','-crf','18',
            '-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',
            '-shortest','out.mp4'
        );
        
        setProgress(90, '완료 처리...');
        const data = ffmpeg.FS('readFile', 'out.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        
        dlLink.href = URL.createObjectURL(blob);
        dlLink.download = `shorts-2min-${Date.now()}.mp4`;
        
        setProgress(100, '완료! 🎉');
        dlSec.style.display = 'block';
        
        ['in.mp4','aud.mp3','mute.mp4','list.txt','loop.mp4','out.mp4']
            .forEach(f => { try { ffmpeg.FS('unlink', f); } catch(e) {} });
        
    } catch (err) {
        showErr(err.message || '처리 실패');
    } finally {
        procBtn.disabled = false;
    }
}

procBtn.onclick = process;
retryBtn.onclick = () => { hideErr(); process(); };
newBtn.onclick = reset;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}