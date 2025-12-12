/**
 * Lecture Shorts Factory v1.3.0 - DYNAMIC INTRO
 * 4분 강의 → 3분 쇼츠 자동 변환
 * 
 * v1.3.0 변경:
 * - 인트로 길이 자동 감지 (하드코딩 제거)
 * - 본편 속도 = (4분 영상) / (3분 - 인트로길이)
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

/* ========== OUTPUT SPECS ========== */
const OUTPUT = {
    width: 720,
    height: 1280,
    targetDur: 180,  // 최종 목표: 3분
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
        const meta = await getVidMeta(file);
        vidMeta = meta;
        
        updateVidInfo();
        checkReady();
    } catch (e) {
        showInfo('vidInfo', `❌ 영상 로드 실패: ${e.message}`, 'warn');
    }
}

async function loadIntro(file) {
    if (!file) return;
    introFile = file;
    
    try {
        const meta = await getVidMeta(file);
        introMeta = meta;
        
        const durStr = fmtDur(meta.dur);
        
        // 인트로 길이 검증
        let status = 'success';
        let msg = '';
        
        if (meta.dur > 120) {
            status = 'warn';
            msg = ' ⚠️ 2분 초과! 본편 시간 부족';
        } else if (meta.dur > 60) {
            status = 'warn';
            msg = ' (본편 2분 미만)';
        }
        
        showInfo('introInfo', 
            `✅ ${file.name}<br>⏱️ ${durStr}${msg}`,
            status
        );
        
        // 본편 정보도 업데이트 (인트로 길이 반영)
        updateVidInfo();
        checkReady();
    } catch (e) {
        showInfo('introInfo', `❌ 인트로 로드 실패: ${e.message}`, 'warn');
    }
}

// 본편 정보 업데이트 (인트로 길이 반영)
function updateVidInfo() {
    if (!vidMeta.dur) return;
    
    const durStr = fmtDur(vidMeta.dur);
    const speedRatio = calcSpeed();
    const newDur = fmtDur(vidMeta.dur / speedRatio);
    const targetMain = OUTPUT.targetDur - introMeta.dur;
    
    let speedInfo = `${speedRatio.toFixed(2)}x`;
    if (speedRatio >= 2.0) {
        speedInfo += ' ⚠️ 최대 속도';
    }
    
    showInfo('vidInfo', 
        `✅ ${vidFile.name}<br>` +
        `📐 ${vidMeta.w}×${vidMeta.h}<br>` +
        `⏱️ ${durStr} → ${fmtDur(targetMain)} (${speedInfo})`,
        speedRatio >= 2.0 ? 'warn' : 'success'
    );
}

async function loadBgm(file) {
    if (!file) return;
    bgmFile = file;
    
    showInfo('bgmInfo', 
        `✅ ${file.name}<br>🔊 볼륨: ${OUTPUT.bgmVol * 100}%`,
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
            `Bottom: ${(p.bottomCutPct * 100).toFixed(1)}% | ` +
            `Shift: ${(p.yShiftPct * 100).toFixed(1)}%`;
    } else {
        el('presetInfo').innerHTML = '크롭 없이 원본 비율 유지';
    }
    
    checkReady();
}

/* ========== READINESS CHECK ========== */
function checkReady() {
    const ready = vidFile && introFile;
    el('genBtn').disabled = !ready;
}

/* ========== SPEED CALCULATION (동적) ========== */
function calcSpeed() {
    // 본편 목표 시간 = 전체 목표 - 실제 인트로 길이
    const targetMain = OUTPUT.targetDur - introMeta.dur;
    
    if (targetMain <= 0) {
        return 2.0;  // 인트로가 3분 이상이면 최대 속도
    }
    
    const ratio = vidMeta.dur / targetMain;
    return Math.max(1.0, Math.min(2.0, ratio));
}

/* ========== MAIN GENERATION ========== */
async function generate() {
    const btn = el('genBtn');
    btn.disabled = true;
    
    show('progress');
    setStatus('FFmpeg 로딩 중...');
    setProg(5);
    
    try {
        await initFFmpeg();
        setProg(10);
        
        setStatus('파일 준비 중...');
        await writeFiles();
        setProg(15);
        
        setStatus('인트로 처리 중...');
        await prepareIntro();
        setProg(25);
        
        setStatus('본편 처리 중... (가장 오래 걸림)');
        await processMain();
        setProg(75);
        
        setStatus('영상 합치는 중...');
        await concatVideos();
        setProg(85);
        
        if (bgmFile) {
            setStatus('배경음악 믹싱 중...');
            await mixBgm();
        }
        setProg(95);
        
        setStatus('완료!');
        await showResult();
        setProg(100);
        
    } catch (e) {
        setStatus(`❌ 오류: ${e.message}`, true);
        console.error(e);
        btn.disabled = false;
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
            const pct = Math.round(ratio * 100);
            el('progText').textContent = `처리: ${pct}%`;
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
    const filter = `scale=${OUTPUT.width}:${OUTPUT.height}:force_original_aspect_ratio=decrease,` +
                   `pad=${OUTPUT.width}:${OUTPUT.height}:(ow-iw)/2:(oh-ih)/2:black`;
    
    await ffmpeg.run(
        '-i', 'intro.mp4',
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '96k',
        'intro_ready.mp4'
    );
}

async function processMain() {
    const speedRatio = calcSpeed();
    
    let vf = `setpts=PTS/${speedRatio}`;
    
    if (preset && PRESETS[preset]) {
        const p = PRESETS[preset];
        const cropH = 1 - p.topCutPct - p.bottomCutPct;
        const topY = p.topCutPct;
        vf += `,crop=in_w:in_h*${cropH.toFixed(4)}:0:in_h*${topY.toFixed(4)}`;
    }
    
    vf += `,scale=${OUTPUT.width}:${OUTPUT.height}:force_original_aspect_ratio=decrease`;
    vf += `,pad=${OUTPUT.width}:${OUTPUT.height}:(ow-iw)/2:(oh-ih)/2:black`;
    
    let af = speedRatio <= 2.0 
        ? `atempo=${speedRatio}` 
        : `atempo=2.0,atempo=${(speedRatio / 2).toFixed(3)}`;
    
    await ffmpeg.run(
        '-i', 'lecture.mp4',
        '-vf', vf,
        '-af', af,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '96k',
        'main_ready.mp4'
    );
}

async function concatVideos() {
    const concatList = "file 'intro_ready.mp4'\nfile 'main_ready.mp4'\n";
    ffmpeg.FS('writeFile', 'concat.txt', new TextEncoder().encode(concatList));
    
    await ffmpeg.run(
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        'output.mp4'
    );
}

async function mixBgm() {
    await ffmpeg.run(
        '-i', 'output.mp4',
        '-i', 'bgm.mp3',
        '-filter_complex',
        `[0:a]volume=1[a1];[1:a]volume=${OUTPUT.bgmVol}[a2];[a1][a2]amix=inputs=2:duration=first`,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '96k',
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
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}분 ${s}초`;
}

async function getVidMeta(file) {
    return new Promise((resolve, reject) => {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        
        vid.onloadedmetadata = () => {
            resolve({
                dur: vid.duration,
                w: vid.videoWidth,
                h: vid.videoHeight
            });
            URL.revokeObjectURL(vid.src);
        };
        
        vid.onerror = () => reject(new Error('메타데이터 로드 실패'));
        vid.src = URL.createObjectURL(file);
    });
}

function reset() {
    vidFile = null;
    introFile = null;
    bgmFile = null;
    preset = null;
    vidMeta = { dur: 0, w: 0, h: 0 };
    introMeta = { dur: 0, w: 0, h: 0 };
    
    el('vidIn').value = '';
    el('introIn').value = '';
    el('bgmIn').value = '';
    
    el('vidInfo').className = 'file-info';
    el('introInfo').className = 'file-info';
    el('bgmInfo').className = 'file-info';
    
    setPreset(null);
    
    hide('result');
    hide('progress');
    show('step5');
    
    el('genBtn').disabled = true;
    setStatus('');
    setProg(0);
}
