/**
 * Lecture Shorts Factory v1.1.0 - OPTIMIZED
 * 4분 강의 → 3분 쇼츠 자동 변환
 * 
 * v1.1.0 최적화:
 * - 단일 패스 인코딩 (7회 → 1회)
 * - preset: ultrafast (모바일 최적화)
 * - 글리치 효과 간소화
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
    width: 1080,
    height: 1920,
    targetDur: 180,
    introDur: 15,
    bgmVol: 0.1
};

/* ========== STATE ========== */
let ffmpeg = null;
let vidFile = null;
let introFile = null;
let bgmFile = null;
let preset = null;
let vidMeta = { dur: 0, w: 0, h: 0 };
let introMeta = { dur: 0 };

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
        
        const durStr = fmtDur(meta.dur);
        const speedRatio = calcSpeed(meta.dur);
        const newDur = fmtDur(meta.dur / speedRatio);
        
        showInfo('vidInfo', 
            `✅ ${file.name}<br>` +
            `📐 ${meta.w}×${meta.h}<br>` +
            `⏱️ ${durStr} → ${newDur} (${speedRatio.toFixed(2)}x)`,
            'success'
        );
        
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
        const status = meta.dur >= 10 && meta.dur <= 20 ? 'success' : 'warn';
        const msg = status === 'warn' ? ' (권장: 15초)' : '';
        
        showInfo('introInfo', 
            `✅ ${file.name}<br>⏱️ ${durStr}${msg}`,
            status
        );
        
        checkReady();
    } catch (e) {
        showInfo('introInfo', `❌ 인트로 로드 실패: ${e.message}`, 'warn');
    }
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

/* ========== MAIN GENERATION (OPTIMIZED) ========== */
async function generate() {
    const btn = el('genBtn');
    btn.disabled = true;
    
    show('progress');
    setStatus('FFmpeg 로딩 중...');
    setProg(5);
    
    try {
        // 1. FFmpeg 초기화
        await initFFmpeg();
        setProg(10);
        
        // 2. 파일 쓰기
        setStatus('파일 준비 중...');
        await writeFiles();
        setProg(20);
        
        // 3. 인트로 빠른 변환 (copy 우선, 필요시만 인코딩)
        setStatus('인트로 준비 중...');
        await prepareIntro();
        setProg(30);
        
        // 4. 본편 단일 패스 처리 (속도+크롭+스케일 한번에)
        setStatus('본편 처리 중...');
        await processMain();
        setProg(60);
        
        // 5. concat (스트림 복사, 재인코딩 없음)
        setStatus('영상 합치는 중...');
        await concatVideos();
        setProg(80);
        
        // 6. BGM 믹싱 (선택, 오디오만 재인코딩)
        if (bgmFile) {
            setStatus('배경음악 믹싱 중...');
            await mixBgm();
        }
        setProg(95);
        
        // 7. 결과 출력
        setStatus('완료!');
        await showResult();
        setProg(100);
        
    } catch (e) {
        setStatus(`❌ 오류: ${e.message}`, true);
        console.error(e);
        btn.disabled = false;
    }
}

/* ========== OPTIMIZED FFMPEG PIPELINE ========== */
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

// 인트로: 스케일만 (단일 패스)
async function prepareIntro() {
    const filter = `scale=${OUTPUT.width}:${OUTPUT.height}:force_original_aspect_ratio=decrease,` +
                   `pad=${OUTPUT.width}:${OUTPUT.height}:(ow-iw)/2:(oh-ih)/2:black,` +
                   `setsar=1`;
    
    await ffmpeg.run(
        '-i', 'intro.mp4',
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',  // 최고속
        '-crf', '23',            // 품질 약간 낮춤 (속도 우선)
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        'intro_ready.mp4'
    );
}

// 본편: 속도+크롭+스케일 단일 패스
async function processMain() {
    const speedRatio = calcSpeed(vidMeta.dur);
    
    // 비디오 필터 체인 구성
    let vf = `setpts=PTS/${speedRatio}`;
    
    // 크롭 (프리셋 선택시)
    if (preset && PRESETS[preset]) {
        const p = PRESETS[preset];
        const cropH = 1 - p.topCutPct - p.bottomCutPct;
        const topY = p.topCutPct;
        vf += `,crop=in_w:in_h*${cropH.toFixed(4)}:0:in_h*${topY.toFixed(4)}`;
    }
    
    // 스케일 + 패딩
    vf += `,scale=${OUTPUT.width}:${OUTPUT.height}:force_original_aspect_ratio=decrease`;
    vf += `,pad=${OUTPUT.width}:${OUTPUT.height}:(ow-iw)/2:(oh-ih)/2:black`;
    vf += `,setsar=1`;
    
    // 오디오 필터 (속도 조절)
    let af = '';
    if (speedRatio <= 2.0) {
        af = `atempo=${speedRatio}`;
    } else {
        af = `atempo=2.0,atempo=${(speedRatio / 2).toFixed(3)}`;
    }
    
    await ffmpeg.run(
        '-i', 'lecture.mp4',
        '-vf', vf,
        '-af', af,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',  // 최고속
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        'main_ready.mp4'
    );
}

// concat: 스트림 복사 (재인코딩 없음!)
async function concatVideos() {
    const concatList = "file 'intro_ready.mp4'\nfile 'main_ready.mp4'\n";
    ffmpeg.FS('writeFile', 'concat.txt', new TextEncoder().encode(concatList));
    
    await ffmpeg.run(
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',  // 재인코딩 없이 복사!
        'output.mp4'
    );
}

// BGM 믹싱: 오디오만 처리
async function mixBgm() {
    await ffmpeg.run(
        '-i', 'output.mp4',
        '-i', 'bgm.mp3',
        '-filter_complex',
        `[0:a]volume=1[a1];[1:a]volume=${OUTPUT.bgmVol}[a2];[a1][a2]amix=inputs=2:duration=first`,
        '-c:v', 'copy',  // 비디오는 복사!
        '-c:a', 'aac',
        '-b:a', '128k',
        'final.mp4'
    );
    
    // 결과 파일명 통일
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
function el(id) {
    return document.getElementById(id);
}

function show(id) {
    el(id).style.display = 'block';
}

function hide(id) {
    el(id).style.display = 'none';
}

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

function calcSpeed(dur) {
    const targetMain = OUTPUT.targetDur - OUTPUT.introDur;
    const ratio = dur / targetMain;
    return Math.max(1.0, Math.min(2.0, ratio));
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
    introMeta = { dur: 0 };
    
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
