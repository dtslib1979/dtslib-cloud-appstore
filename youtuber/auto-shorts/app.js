const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ 
    log: false,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.6/dist/ffmpeg-core.js'
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
const memWarn = $('memory-warning');

// Memory check
function checkMem() {
    const mem = navigator.deviceMemory;
    if (mem && mem < 4 && memWarn) {
        memWarn.style.display = 'block';
        memWarn.textContent = `⚠️ 기기 메모리 ${mem}GB - 처리가 느릴 수 있습니다`;
    }
}
checkMem();

// Version loader
async function loadAppVersion() {
    try {
        const res = await fetch('../apps.json');
        const data = await res.json();
        const app = data.apps.find(a => a.id === 'auto-shorts');
        if (app) {
            $('appVersion').textContent = `v${app.version}`;
        }
    } catch (e) {
        console.warn('버전 로드 실패:', e);
    }
}
loadAppVersion();

// Duration preview
function getVidDur(file) {
    return new Promise((res, rej) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => {
            URL.revokeObjectURL(v.src);
            res(v.duration);
        };
        v.onerror = () => rej(new Error('ERR_VIDEO_LOAD'));
        v.src = URL.createObjectURL(file);
    });
}

function fmtDur(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

vidIn.onchange = async e => {
    vidFile = e.target.files[0];
    if (!vidFile) return;
    try {
        const dur = await getVidDur(vidFile);
        const loops = Math.ceil(120 / dur);
        vidStat.textContent = `✓ ${vidFile.name} (${fmtDur(dur)}, ${loops}회 반복)`;
        vidStat.dataset.dur = dur;
        e.target.parentElement.classList.add('active');
        
        if (dur < 3 || dur > 30) {
            vidStat.textContent = `⚠️ ${fmtDur(dur)} - 3~30초 영상만 가능`;
            vidStat.classList.add('warn');
            vidFile = null;
        } else {
            vidStat.classList.remove('warn');
        }
    } catch (err) {
        vidStat.textContent = '❌ 영상 분석 실패';
        vidFile = null;
    }
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

function showErr(code, msg) {
    errSec.style.display = 'block';
    const msgs = {
        'ERR_VIDEO_LOAD': '영상 파일을 읽을 수 없습니다',
        'ERR_DURATION_SHORT': '3초 이상 영상이 필요합니다',
        'ERR_DURATION_LONG': '30초 이하 영상이 필요합니다',
        'ERR_FFMPEG_LOAD': 'FFmpeg 로딩 실패 (네트워크 확인)',
        'ERR_ENCODE': '인코딩 실패 (메모리 부족 가능)',
        'ERR_MEMORY': '메모리 부족 - 브라우저 재시작 권장'
    };
    errText.textContent = `[${code}] ${msgs[code] || msg || '알 수 없는 오류'}`;
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
    vidStat.classList.remove('warn');
    vidIn.parentElement.classList.remove('active');
    audIn.parentElement.classList.remove('active');
    procBtn.disabled = true;
    progSec.style.display = 'none';
    dlSec.style.display = 'none';
    hideErr();
    setProgress(0, '');
}

async function process() {
    hideErr();
    progSec.style.display = 'block';
    dlSec.style.display = 'none';
    procBtn.disabled = true;
    
    try {
        if (!ffmpeg.isLoaded()) {
            setProgress(5, 'FFmpeg 로딩 중...');
            try {
                await ffmpeg.load();
            } catch (e) {
                throw { code: 'ERR_FFMPEG_LOAD' };
            }
        }
        
        // Progress callback
        ffmpeg.setProgress(({ ratio }) => {
            if (ratio > 0 && ratio <= 1) {
                const pct = 50 + Math.floor(ratio * 40);
                setProgress(pct, `인코딩 중... ${Math.floor(ratio * 100)}%`);
            }
        });
        
        setProgress(10, '영상 분석 중...');
        const dur = parseFloat(vidStat.dataset.dur) || await getVidDur(vidFile);
        
        if (dur < 3) throw { code: 'ERR_DURATION_SHORT' };
        if (dur > 30) throw { code: 'ERR_DURATION_LONG' };
        
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
        
        setProgress(45, '영상 병합...');
        await ffmpeg.run('-f','concat','-safe','0','-i','list.txt','-c','copy','loop.mp4');
        
        setProgress(50, '최종 인코딩...');
        await ffmpeg.run(
            '-i','loop.mp4','-i','aud.mp3','-t','120',
            '-c:v','libx264','-preset','medium','-crf','18',
            '-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',
            '-shortest','out.mp4'
        );
        
        setProgress(95, '완료 처리...');
        const data = ffmpeg.FS('readFile', 'out.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        
        dlLink.href = URL.createObjectURL(blob);
        dlLink.download = `shorts-2min-${Date.now()}.mp4`;
        
        setProgress(100, '완료! 🎉');
        dlSec.style.display = 'block';
        
        ['in.mp4','aud.mp3','mute.mp4','list.txt','loop.mp4','out.mp4']
            .forEach(f => { try { ffmpeg.FS('unlink', f); } catch(e) {} });
        
    } catch (err) {
        const code = err.code || 'ERR_ENCODE';
        showErr(code, err.message);
    } finally {
        procBtn.disabled = false;
    }
}

procBtn.onclick = process;
retryBtn.onclick = () => { hideErr(); process(); };
newBtn.onclick = reset;

