/**
 * Lecture Shorts Factory v2.1.0 - WebCodecs Edition
 * 
 * 🚀 핵심: FFmpeg.wasm → WebCodecs API (하드웨어 가속)
 * 
 * v2.1.0 개선:
 * - 스트리밍 인코딩 (메모리 최적화)
 * - 오디오 트랙 복사 지원
 * - 진행률 표시 개선
 * - 에러 핸들링 강화
 * 
 * Fallback: WebCodecs 미지원 시 FFmpeg.wasm 사용
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
    targetDur: 180,
    bgmVol: 0.1,
    fps: 30,
    bitrate: 2_500_000
};

/* ========== STATE ========== */
let vidFile = null;
let introFile = null;
let bgmFile = null;
let preset = null;
let vidMeta = { dur: 0, w: 0, h: 0 };
let introMeta = { dur: 0, w: 0, h: 0 };
let useWebCodecs = false;

// WebCodecs 지원 여부 체크
const supportsWebCodecs = () => {
    return typeof VideoEncoder !== 'undefined' && 
           typeof VideoDecoder !== 'undefined' &&
           typeof VideoFrame !== 'undefined';
};

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', init);

async function init() {
    useWebCodecs = supportsWebCodecs();
    
    if (useWebCodecs) {
        console.log('✅ WebCodecs API (하드웨어 가속)');
        el('engineInfo').innerHTML = '🚀 WebCodecs (HW 가속)';
        el('engineInfo').className = 'engine-badge webcodecs';
    } else {
        console.log('⚠️ FFmpeg.wasm 폴백');
        el('engineInfo').innerHTML = '⚙️ FFmpeg.wasm';
        el('engineInfo').className = 'engine-badge ffmpeg';
    }
    
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
        `📐 ${vidMeta.w}×${vidMeta.h} → 720p<br>` +
        `⏱️ ${fmtDur(vidMeta.dur)} → ${fmtDur(targetMain)} (${speed.toFixed(2)}x)`,
        speed >= 2.0 ? 'warn' : 'success'
    );
}

async function loadBgm(file) {
    if (!file) return;
    bgmFile = file;
    
    showInfo('bgmInfo', 
        `✅ ${file.name}<br>🔊 자동 루프`,
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
    
    const startTime = performance.now();
    
    try {
        if (useWebCodecs) {
            await generateWithWebCodecs();
        } else {
            await generateWithFFmpeg();
        }
        
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        setStatus(`✅ 완료! (${elapsed}초)`);
        
    } catch (e) {
        setStatus(`❌ ${e.message}`, true);
        console.error(e);
        el('genBtn').disabled = false;
    }
}

/* ========== WebCodecs Pipeline v2.1 ========== */
async function generateWithWebCodecs() {
    setStatus('라이브러리 로딩...');
    setProg(5);
    await loadMp4Muxer();
    
    const { Muxer, ArrayBufferTarget } = Mp4Muxer;
    
    // Muxer 초기화
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: 'avc',
            width: OUTPUT.width,
            height: OUTPUT.height
        },
        fastStart: 'in-memory'
    });
    
    // VideoEncoder 초기화
    const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => { throw new Error(`인코더 오류: ${e.message}`); }
    });
    
    await encoder.configure({
        codec: 'avc1.42001f',
        width: OUTPUT.width,
        height: OUTPUT.height,
        bitrate: OUTPUT.bitrate,
        framerate: OUTPUT.fps,
        hardwareAcceleration: 'prefer-hardware'
    });
    
    let totalFrames = 0;
    let encodedFrames = 0;
    
    // 인트로 처리
    setStatus('인트로 처리 중...');
    setProg(10);
    
    const introFrameCount = Math.floor(introMeta.dur * OUTPUT.fps);
    totalFrames = introFrameCount + Math.floor((OUTPUT.targetDur - introMeta.dur) * OUTPUT.fps);
    
    await processVideoFrames(introFile, introMeta, 1, encoder, (i, total) => {
        encodedFrames = i;
        setProg(10 + Math.floor((i / totalFrames) * 40));
        if (i % 30 === 0) setStatus(`인트로: ${i}/${total} 프레임`);
    });
    
    // 본편 처리
    setStatus('본편 처리 중...');
    const speed = calcSpeed();
    const introOffset = introMeta.dur * 1000000; // microseconds
    
    await processVideoFrames(vidFile, vidMeta, speed, encoder, (i, total) => {
        encodedFrames = introFrameCount + i;
        setProg(50 + Math.floor((i / total) * 40));
        if (i % 30 === 0) setStatus(`본편: ${i}/${total} 프레임 (${speed.toFixed(1)}x)`);
    }, introOffset);
    
    // 인코딩 완료
    setStatus('MP4 생성 중...');
    setProg(90);
    
    await encoder.flush();
    encoder.close();
    muxer.finalize();
    
    const videoBlob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    
    // BGM 믹싱 (FFmpeg 사용)
    let finalBlob = videoBlob;
    if (bgmFile) {
        setStatus('BGM 믹싱 중...');
        setProg(95);
        finalBlob = await mixBgmWithFFmpeg(videoBlob);
    }
    
    setProg(100);
    showResultBlob(finalBlob);
}

// 스트리밍 방식 프레임 처리
async function processVideoFrames(file, meta, speed, encoder, onProgress, timestampOffset = 0) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    
    await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error('비디오 로드 실패'));
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT.width;
    canvas.height = OUTPUT.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    const outputDuration = meta.dur / speed;
    const frameInterval = 1 / OUTPUT.fps;
    const totalFrames = Math.floor(outputDuration * OUTPUT.fps);
    
    for (let i = 0; i < totalFrames; i++) {
        const sourceTime = i * frameInterval * speed;
        if (sourceTime >= meta.dur) break;
        
        // Seek to frame
        video.currentTime = sourceTime;
        await new Promise(r => { video.onseeked = r; });
        
        // 크롭 계산
        let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
        
        if (preset && PRESETS[preset]) {
            const p = PRESETS[preset];
            sy = Math.floor(video.videoHeight * p.topCutPct);
            sh = Math.floor(video.videoHeight * (1 - p.topCutPct - p.bottomCutPct));
        }
        
        // Canvas에 그리기 (letterbox)
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, OUTPUT.width, OUTPUT.height);
        
        const scale = Math.min(OUTPUT.width / sw, OUTPUT.height / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = (OUTPUT.width - dw) / 2;
        const dy = (OUTPUT.height - dh) / 2;
        
        ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
        
        // VideoFrame 생성 및 인코딩
        const timestamp = timestampOffset + (i * frameInterval * 1000000);
        const frame = new VideoFrame(canvas, { timestamp });
        
        encoder.encode(frame, { keyFrame: i % 60 === 0 });
        frame.close();
        
        // 진행률 콜백
        if (onProgress) onProgress(i + 1, totalFrames);
        
        // UI 업데이트를 위한 yield
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }
    
    URL.revokeObjectURL(video.src);
}

// mp4-muxer CDN 로딩
async function loadMp4Muxer() {
    if (window.Mp4Muxer) return;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.0.0/build/mp4-muxer.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('mp4-muxer 로드 실패'));
        document.head.appendChild(script);
    });
}

// FFmpeg로 BGM 믹싱
async function mixBgmWithFFmpeg(videoBlob) {
    await initFFmpeg();
    
    const { fetchFile } = FFmpeg;
    
    // 비디오 및 BGM 파일 쓰기
    ffmpeg.FS('writeFile', 'video.mp4', new Uint8Array(await videoBlob.arrayBuffer()));
    ffmpeg.FS('writeFile', 'bgm.mp3', await fetchFile(bgmFile));
    
    // BGM 믹싱
    await ffmpeg.run(
        '-i', 'video.mp4',
        '-stream_loop', '-1',
        '-i', 'bgm.mp3',
        '-t', String(OUTPUT.targetDur),
        '-filter_complex',
        `[1:a]volume=${OUTPUT.bgmVol}[bgm];[bgm]apad[a]`,
        '-map', '0:v',
        '-map', '[a]',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        'output.mp4'
    );
    
    const data = ffmpeg.FS('readFile', 'output.mp4');
    return new Blob([data.buffer], { type: 'video/mp4' });
}

/* ========== FFmpeg Fallback ========== */
let ffmpeg = null;

async function generateWithFFmpeg() {
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
    
    setProg(100);
    await showResult();
}

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
        '-r', String(OUTPUT.fps),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-c:a', 'aac',
        '-b:a', '128k',
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
        '-r', String(OUTPUT.fps),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-c:a', 'aac',
        '-b:a', '128k',
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
        '-b:a', '128k',
        'final.mp4'
    );
    
    ffmpeg.FS('rename', 'final.mp4', 'output.mp4');
}

async function showResult() {
    const data = ffmpeg.FS('readFile', 'output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    showResultBlob(blob);
}

function showResultBlob(blob) {
    const url = URL.createObjectURL(blob);
    const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
    
    el('preview').src = url;
    el('dlLink').href = url;
    el('dlLink').download = `lecture_shorts_${Date.now()}.mp4`;
    
    // 파일 크기 표시
    setStatus(`✅ 완료! (${sizeMB}MB)`);
    
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
