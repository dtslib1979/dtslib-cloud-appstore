'use strict';

let ffmpeg = null;
let vidFile = null;
let audFile = null;

// 싱글스레드 모드 exit(0) 대응
let _useST = false;
let _coreCDN = null;

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

// FFmpeg 스크립트 동적 로딩
async function loadFFmpegScript() {
    if (typeof FFmpeg !== 'undefined') return;
    const cdns = [
        'https://unpkg.com/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.js',
        'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.js'
    ];
    for (const src of cdns) {
        try {
            await new Promise((resolve, reject) => {
                if (typeof FFmpeg !== 'undefined') { resolve(); return; }
                const s = document.createElement('script');
                s.src = src;
                s.crossOrigin = 'anonymous';
                s.onload = resolve;
                s.onerror = () => reject(new Error('CDN fail'));
                document.head.appendChild(s);
            });
            return;
        } catch (e) { /* try next */ }
    }
    throw { code: 'ERR_FFMPEG_LOAD' };
}

// FFmpeg lazy init (싱글/멀티스레드 자동 선택 + CDN 폴백 + CDN 캐시)
async function initFFmpeg() {
    if (ffmpeg && ffmpeg.isLoaded()) return;

    if (typeof FFmpeg === 'undefined') {
        await loadFFmpegScript();
    }

    _useST = !self.crossOriginIsolated;
    const corePkg = _useST ? '@ffmpeg/core-st@0.11.0' : '@ffmpeg/core@0.11.0';

    const cdns = _coreCDN ? [_coreCDN] : [
        `https://unpkg.com/${corePkg}/dist/ffmpeg-core.js`,
        `https://cdn.jsdelivr.net/npm/${corePkg}/dist/ffmpeg-core.js`
    ];

    for (let i = 0; i < cdns.length; i++) {
        try {
            const { createFFmpeg } = FFmpeg;
            ffmpeg = createFFmpeg({
                log: false,
                corePath: cdns[i],
                mainName: _useST ? 'main' : 'proxy_main'
            });

            ffmpeg.setProgress(({ ratio }) => {
                if (ratio > 0 && ratio <= 1) {
                    const pct = 50 + Math.floor(ratio * 40);
                    setProgress(pct, `인코딩 중... ${Math.floor(ratio * 100)}%`);
                }
            });

            await ffmpeg.load();
            _coreCDN = cdns[i];
            return;
        } catch (e) {
            ffmpeg = null;
            if (i === cdns.length - 1) throw { code: 'ERR_FFMPEG_LOAD' };
        }
    }
}

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
        setProgress(5, 'FFmpeg 로딩 중...');
        await initFFmpeg();

        const { fetchFile } = FFmpeg;

        setProgress(10, '영상 분석 중...');
        const dur = parseFloat(vidStat.dataset.dur) || await getVidDur(vidFile);

        if (dur < 3) throw { code: 'ERR_DURATION_SHORT' };
        if (dur > 30) throw { code: 'ERR_DURATION_LONG' };

        const loops = Math.ceil(120 / dur);
        setProgress(15, `${loops}회 반복 예정`);

        setProgress(20, '파일 로딩...');
        ffmpeg.FS('writeFile', 'in.mp4', await fetchFile(vidFile));
        ffmpeg.FS('writeFile', 'aud.mp3', await fetchFile(audFile));

        // 싱글스레드 exit(0) 대응: 3개 run → 1개 run 통합
        // -stream_loop N = 추가 N회 반복 (총 N+1회)
        setProgress(30, '쇼츠 생성 중...');
        await ffmpeg.run(
            '-stream_loop', String(loops - 1),
            '-i', 'in.mp4',
            '-i', 'aud.mp3',
            '-t', '120',
            '-map', '0:v', '-map', '1:a',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '192k',
            '-shortest', 'out.mp4'
        );

        setProgress(95, '완료 처리...');
        const data = ffmpeg.FS('readFile', 'out.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });

        // ST 모드: exit(0) 후 WASM 죽음 → null (재시도 시 재생성)
        if (_useST) ffmpeg = null;

        dlLink.href = URL.createObjectURL(blob);
        dlLink.download = `shorts-2min-${Date.now()}.mp4`;

        setProgress(100, '완료!');
        dlSec.style.display = 'block';

    } catch (err) {
        if (_useST) ffmpeg = null;
        const code = err.code || 'ERR_ENCODE';
        showErr(code, err.message);
    } finally {
        procBtn.disabled = false;
    }
}

procBtn.onclick = process;
retryBtn.onclick = () => { hideErr(); process(); };
newBtn.onclick = reset;
