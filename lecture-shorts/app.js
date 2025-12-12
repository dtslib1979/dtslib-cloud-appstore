/**
 * Lecture Shorts Factory v1.4.0 - EXTREME MOBILE
 * 
 * v1.4.0:
 * - 480p SD (속도 2배 향상)
 * - BGM 자동 루프 (1~2분 → 3분 채움)
 * - CRF 32 + 24fps
 */

/* ========== DEVICE PRESETS ========== */
const PRESETS = {
    TAB_S9: {
        name: 'Galaxy Tab S9',
        topCutPct: 0.055,
        bottomCutPct: 0.090,
        yShiftPct: -0.060
    },
    S25_ULTRA: {
        name: 'Galaxy S25 Ultra',
        topCutPct: 0.090,
        bottomCutPct: 0.040,
        yShiftPct: -0.085
    }
};

/* ========== OUTPUT SPECS (480p for SPEED) ========== */
const OUTPUT = {
    width: 480,
    height: 854,
    targetDur: 180,
    bgmVol: 0.1
};

/* ========== STATE ========== */
let ffmpeg = null;
let vidFile = null;
let introFile = null;
let bgmFile = null;
let preset = null;
let vidMeta = { dur: 0, w: 0, h: 0 };
let introMeta = { dur: 0, w: 0, h: 0 };

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        show('memWarn');
    }
    
    el('vidIn').onchange = e => loadVid(e.target.files[0]);
    el('introIn').onchange = e => loadIntro(e.target.files[0]);
    el('bgmIn').onchange = e => loadBgm(e.target.files[0]);
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js');
    }
}

/* ========== FILE LOADERS ========== */
async function loadVid(file) {
    if (!file) return;
    vidFile = file;
    
    try {
        vidMeta = await getVidMeta(file);
        updateVidInfo();
        checkReady();
    } catch (e) {
        showInfo('vidInfo', `❌ ${e.message}`, 'warn');
    }
}

async function loadIntro(file) {
    if (!file) return;
    introFile = file;
    
    try {
        introMeta = await getVidMeta(file);
        
        let warn = '';
        if (introMeta.dur > 120) warn = ' ⚠️ 2분 초과';
        
        showInfo('introInfo', 
            `✅ ${file.name}<br>⏱️ ${fmtDur(introMeta.dur)}${warn}`,
            introMeta.dur > 120 ? 'warn' : 'success'
        );
        
        updateVidInfo();
        checkReady();
    } catch (e) {
        showInfo('introInfo', `❌ ${e.message}`, 'warn');
    }
}

function updateVidInfo() {
    if (!vidMeta.dur) return;
    
    const speed = calcSpeed();
    const targetMain = OUTPUT.targetDur - introMeta.dur;
    
    showInfo('vidInfo', 
        `✅ ${vidFile.name}<br>` +
        `📐 ${vidMeta.w}×${vidMeta.h} → 480p<br>` +
        `⏱️ ${fmtDur(vidMeta.dur)} → ${fmtDur(targetMain)} (${speed.toFixed(2)}x)`,
        speed >= 2.0 ? 'warn' : 'success'
    );
}

async function loadBgm(file) {
    if (!file) return;
    bgmFile = file;
    
    showInfo('bgmInfo', 
        `✅ ${file.name}<br>🔊 자동 루프 (3분 채움)`,
        'success'
    );
    
    checkReady();
}

/* ========== PRESET SELECTION ========== */
function setPreset(key) {
    preset = key;
    
    el('btnTabS9').classList.toggle('active', key === 'TAB_S9');
    el('btnS25').classList.toggle('active', key === 'S25_ULTRA');
    el('btnNone').classList.toggle('active', key === null);
    
    if (key && PRESETS[key]) {
        const p = PRESETS[key];
        el('presetInfo').innerHTML = 
            `Top: ${(p.topCutPct * 100).toFixed(1)}% | ` +
            `Bottom: ${(p.bottomCutPct * 100).toFixed(1)}%`;
    } else {
        el('presetInfo').innerHTML = '크롭 없음';
    }
    
    checkReady();
}

function checkReady() {
    el('genBtn').disabled = !(vidFile && introFile);
}

function calcSpeed() {
    const targetMain = OUTPUT.targetDur - introMeta.dur;
    if (targetMain <= 0) return 2.0;
    return Math.max(1.0, Math.min(2.0, vidMeta.dur / targetMain));
}

/* ========== MAIN GENERATION ========== */
async function generate() {
    el('genBtn').disabled = true;
    show('progress');
    
    try {
        setStatus('FFmpeg 로딩...');
        setProg(5);
        await initFFmpeg();
        
        setStatus('파일 준비...');
        setProg(10);
        await writeFiles();
        
        setStatus('인트로 처리...');
        setProg(15);
        await prepareIntro();
        
        setStatus('본편 처리... (시간 소요)');
        setProg(20);
        await processMain();
        
        setStatus('영상 합치기...');
        setProg(80);
        await concatVideos();
        
        if (bgmFile) {
            setStatus('BGM 믹싱...');
            setProg(90);
            await mixBgm();
        }
        
        setStatus('완료!');
        setProg(100);
        await showResult();
        
    } catch (e) {
        setStatus(`❌ ${e.message}`, true);
        console.error(e);
        el('genBtn').disabled = false;
    }
}

/* ========== FFMPEG PIPELINE ========== */
async function initFFmpeg() {
    if (ffmpeg && ffmpeg.isLoaded()) return;
    
    const { createFFmpeg } = FFmpeg;
    ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
    });
    
    ffmpeg.setProgress(({ ratio }) => {
        if (ratio > 0) {
            el('progText').textContent = `처리: ${Math.round(ratio * 100)}%`;
        }
    });
    
    await ffmpeg.load();
}

async function writeFiles() {
    const { fetchFile } = FFmpeg;
    ffmpeg.FS('writeFile', 'lecture.mp4', await fetchFile(vidFile));
    ffmpeg.FS('writeFile', 'intro.mp4', await fetchFile(introFile));
    if (bgmFile) {
        ffmpeg.FS('writeFile', 'bgm.mp3', await fetchFile(bgmFile));
    }
}

async function prepareIntro() {
    const vf = `scale=${OUTPUT.width}:${OUTPUT.height}:force_original_aspect_ratio=decrease,` +
               `pad=${OUTPUT.width}:${OUTPUT.height}:(ow-iw)/2:(oh-ih)/2:black`;
    
    await ffmpeg.run(
        '-i', 'intro.mp4',
        '-vf', vf,
        '-r', '24',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '32',
        '-c:a', 'aac',
        '-b:a', '64k',
        'intro_ready.mp4'
    );
}

async function processMain() {
    const speed = calcSpeed();
    
    let vf = `setpts=PTS/${speed}`;
    
    if (preset && PRESETS[preset]) {
        const p = PRESETS[preset];
        const cropH = 1 - p.topCutPct - p.bottomCutPct;
        vf += `,crop=in_w:in_h*${cropH.toFixed(4)}:0:in_h*${p.topCutPct.toFixed(4)}`;
    }
    
    vf += `,scale=${OUTPUT.width}:${OUTPUT.height}:force_original_aspect_ratio=decrease`;
    vf += `,pad=${OUTPUT.width}:${OUTPUT.height}:(ow-iw)/2:(oh-ih)/2:black`;
    
    const af = speed <= 2.0 ? `atempo=${speed}` : `atempo=2.0,atempo=${(speed/2).toFixed(3)}`;
    
    await ffmpeg.run(
        '-i', 'lecture.mp4',
        '-vf', vf,
        '-af', af,
        '-r', '24',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '32',
        '-c:a', 'aac',
        '-b:a', '64k',
        'main_ready.mp4'
    );
}

async function concatVideos() {
    ffmpeg.FS('writeFile', 'concat.txt', 
        new TextEncoder().encode("file 'intro_ready.mp4'\nfile 'main_ready.mp4'\n"));
    
    await ffmpeg.run(
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        'output.mp4'
    );
}

// BGM 자동 루프 (1~2분 → 3분 채움)
async function mixBgm() {
    await ffmpeg.run(
        '-i', 'output.mp4',
        '-stream_loop', '-1',
        '-i', 'bgm.mp3',
        '-t', String(OUTPUT.targetDur),
        '-filter_complex',
        `[0:a]volume=1[a1];[1:a]volume=${OUTPUT.bgmVol}[a2];[a1][a2]amix=inputs=2:duration=first`,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '64k',
        'final.mp4'
    );
    
    ffmpeg.FS('rename', 'final.mp4', 'output.mp4');
}

async function showResult() {
    const data = ffmpeg.FS('readFile', 'output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    
    el('preview').src = url;
    el('dlLink').href = url;
    
    show('result');
    hide('step5');
}

/* ========== UTILITIES ========== */
function el(id) { return document.getElementById(id); }
function show(id) { el(id).style.display = 'block'; }
function hide(id) { el(id).style.display = 'none'; }

function showInfo(id, html, cls) {
    const e = el(id);
    e.innerHTML = html;
    e.className = 'file-info show ' + (cls || '');
}

function setStatus(msg, isErr) {
    const e = el('status');
    e.textContent = msg;
    e.className = 'status' + (isErr ? ' error' : '');
}

function setProg(pct) {
    el('progFill').style.width = pct + '%';
    el('progText').textContent = pct + '%';
}

function fmtDur(sec) {
    return `${Math.floor(sec/60)}분 ${Math.floor(sec%60)}초`;
}

async function getVidMeta(file) {
    return new Promise((resolve, reject) => {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.onloadedmetadata = () => {
            resolve({ dur: vid.duration, w: vid.videoWidth, h: vid.videoHeight });
            URL.revokeObjectURL(vid.src);
        };
        vid.onerror = () => reject(new Error('로드 실패'));
        vid.src = URL.createObjectURL(file);
    });
}

function reset() {
    vidFile = introFile = bgmFile = preset = null;
    vidMeta = introMeta = { dur: 0, w: 0, h: 0 };
    
    el('vidIn').value = el('introIn').value = el('bgmIn').value = '';
    el('vidInfo').className = el('introInfo').className = el('bgmInfo').className = 'file-info';
    
    setPreset(null);
    hide('result');
    hide('progress');
    show('step5');
    el('genBtn').disabled = true;
    setStatus('');
    setProg(0);
}
