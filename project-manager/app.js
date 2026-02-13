/**
 * Project Manager v1.0
 * Meta Tab: 메타데이터 생성 (from meta-kit)
 * Export Tab: ZIP 패키징 (from export-packager)
 * Batch Tab: run_plan.json 생성 (from control-engine)
 */

// ============================================
// Constants
// ============================================
const DB_NAME = 'project-manager-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const MAX_PROJECTS = 20;

const CATEGORIES = [
    { id: 'video', name: '영상', icon: '🎬' },
    { id: 'audio', name: '음원', icon: '🎵' },
    { id: 'image', name: '이미지', icon: '🖼️' },
    { id: 'text', name: '텍스트', icon: '📄' },
    { id: 'meta', name: '메타', icon: '📋' }
];

const PRESET_SETS = {
    youtube_v1: {
        name: 'youtube_v1',
        presets: {
            shorts_v1: { target_len_sec: 30, ratio: '9:16', fps: 30 },
            thumb_v1: { w: 1280, h: 720, max_mb: 2 },
            audio_v1: { lufs: -14, max_peak_db: -1 }
        },
        pipeline: ['meta_kit', 'image_pack', 'lecture_shorts', 'audio_loop', 'export_packager']
    },
    blog_v1: {
        name: 'blog_v1',
        presets: {
            post_img_v1: { w: 1200, h: 630, max_mb: 2 },
            cover_v1: { w: 1920, h: 1080, max_mb: 3 }
        },
        pipeline: ['meta_kit', 'image_pack', 'export_packager']
    },
    insta_v1: {
        name: 'insta_v1',
        presets: {
            square_v1: { w: 1080, h: 1080, max_mb: 2 },
            reel_v1: { ratio: '9:16', fps: 30, target_len_sec: 30 }
        },
        pipeline: ['image_pack', 'clip_shorts', 'export_packager']
    }
};

// ============================================
// State
// ============================================
let db = null;
let currentTab = 'meta';

// Meta Tab State
let selectedTool = null;
let selectedDuration = null;
let selectedType = null;
let sequence = 1;

// Export Tab State
let currentProject = null;
let uploadedFiles = [];
let selectedField = null;

// Batch Tab State
let batchField = 'youtube';
let batchPreset = 'youtube_v1';

// ============================================
// DOM Elements
// ============================================
const toast = document.getElementById('toast');

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await initDB();
    setupTabNavigation();
    setupMetaTab();
    setupExportTab();
    setupBatchTab();
    await loadProjects();
}

// ============================================
// IndexedDB
// ============================================
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'project_id' });
                store.createIndex('created_at', 'created_at', { unique: false });
            }
        };
    });
}

async function saveProject(project) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(project);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadProjects() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('created_at');
        const request = index.openCursor(null, 'prev');

        const projects = [];
        request.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor && projects.length < MAX_PROJECTS) {
                projects.push(cursor.value);
                cursor.continue();
            } else {
                renderProjectList(projects);
                resolve(projects);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// ============================================
// Tab Navigation
// ============================================
function setupTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}Tab`).classList.add('active');
}

// ============================================
// META TAB
// ============================================
function setupMetaTab() {
    // Tool buttons
    document.getElementById('toolGroup').querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => selectOption('toolGroup', btn, 'tool'));
    });

    // Duration buttons
    document.getElementById('durationGroup').querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => selectOption('durationGroup', btn, 'duration'));
    });

    // Type buttons
    document.getElementById('typeGroup').querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => selectOption('typeGroup', btn, 'type'));
    });

    // Sequence controls
    document.getElementById('seqUp').addEventListener('click', () => adjustSequence(1));
    document.getElementById('seqDown').addEventListener('click', () => adjustSequence(-1));

    // Generate button
    document.getElementById('generateBtn').addEventListener('click', generateMetadata);

    // Copy button
    document.getElementById('copyBtn').addEventListener('click', copyToClipboard);

    updateProjectId();
}

function selectOption(groupId, btn, type) {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.select-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const value = btn.dataset.value;
    if (type === 'tool') selectedTool = value;
    else if (type === 'duration') selectedDuration = parseInt(value);
    else if (type === 'type') selectedType = value;

    updateProjectId();
    checkMetaReadyState();
}

function adjustSequence(delta) {
    sequence = Math.max(1, Math.min(99, sequence + delta));
    document.getElementById('seqNum').textContent = sequence.toString().padStart(2, '0');
    updateProjectId();
}

function updateProjectId() {
    const input = document.getElementById('projectId');
    if (!selectedTool) {
        input.value = 'parksy-{tool}-YYYYMMDD-NN';
        return;
    }

    const today = new Date();
    const dateStr = today.getFullYear().toString() +
        (today.getMonth() + 1).toString().padStart(2, '0') +
        today.getDate().toString().padStart(2, '0');
    const seqStr = sequence.toString().padStart(2, '0');
    input.value = `parksy-${selectedTool}-${dateStr}-${seqStr}`;
}

function checkMetaReadyState() {
    const ready = selectedTool && selectedDuration && selectedType;
    document.getElementById('generateBtn').disabled = !ready;
}

function generateMetadata() {
    if (!selectedTool || !selectedDuration || !selectedType) {
        showToast('모든 옵션을 선택하세요');
        return;
    }

    const projectId = document.getElementById('projectId').value;
    const toolDisplay = formatToolName(selectedTool);
    const typeDisplay = capitalize(selectedType);
    const durationStr = selectedDuration.toString();

    const metadata = {
        project_id: projectId,
        title: `[${toolDisplay}] ${durationStr}min ${typeDisplay} | Parksy`,
        description: [
            `This content was generated using ${toolDisplay}.`,
            `Duration: ${durationStr} minutes`,
            `Type: ${typeDisplay}`
        ].join('\n'),
        chapters: generateChapters(selectedDuration, selectedType),
        tags: ['parksy', selectedTool.toLowerCase(), selectedType.toLowerCase(), `${durationStr}min`],
        pinned_comment: 'Made with Parksy Content Factory.'
    };

    document.getElementById('outputJson').textContent = JSON.stringify(metadata, null, 2);
    document.getElementById('outputSection').classList.add('active');

    adjustSequence(1);
    showToast('Generated!', 'success');
}

function generateChapters(duration, type) {
    const isLoop = type.toLowerCase() === 'loop';
    const labelStart = isLoop ? 'Loop Start' : 'Start';
    const labelEnd = isLoop ? 'Loop End' : 'End';
    const endTime = duration < 10 ? `0${duration}:00` : `${duration}:00`;
    return [`00:00 ${labelStart}`, `${endTime} ${labelEnd}`];
}

function formatToolName(tool) {
    const names = {
        'audiocut': 'AudioCut', 'audioloop': 'AudioLoop', 'clipshorts': 'ClipShorts',
        'lectureshorts': 'LectureShorts', 'lecturelong': 'LectureLong', 'autoshorts': 'AutoShorts'
    };
    return names[tool] || tool;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function copyToClipboard() {
    const text = document.getElementById('outputJson').textContent;
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied!', 'success');
    } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied!', 'success');
    }
}

// ============================================
// EXPORT TAB
// ============================================
function setupExportTab() {
    document.getElementById('newProjectBtn').addEventListener('click', createNewProject);

    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('exportFileInput');

    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleExportFileInput);
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', handleExportDrop);

    document.getElementById('fieldGroup').querySelectorAll('.field-btn').forEach(btn => {
        btn.addEventListener('click', () => selectExportField(btn));
    });

    document.getElementById('exportZipBtn').addEventListener('click', doExport);
}

function createNewProject() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const projectId = `P${date}_${rand}`;

    currentProject = {
        project_id: projectId,
        project_name: `Project ${projectId.slice(-4)}`,
        field: null,
        created_at: now.toISOString(),
        files: []
    };

    uploadedFiles = [];
    selectedField = null;

    document.getElementById('exportUploadSection').style.display = 'block';
    document.getElementById('fieldSection').style.display = 'block';
    showToast('새 프로젝트 생성됨', 'success');
}

function renderProjectList(projects) {
    const list = document.getElementById('projectList');
    if (projects.length === 0) {
        list.innerHTML = '<div class="no-projects">저장된 프로젝트가 없습니다</div>';
        return;
    }

    list.innerHTML = projects.slice(0, 5).map(p => `
        <div class="project-item" data-id="${p.project_id}">
            <div class="project-info">
                <strong>${p.project_name}</strong>
                <span>${formatDate(p.created_at)} · ${p.files?.length || 0}개 파일</span>
            </div>
            ${p.field ? `<span class="project-field">${p.field}</span>` : ''}
        </div>
    `).join('');
}

function handleExportFileInput(e) {
    const files = Array.from(e.target.files);
    addExportFiles(files);
    e.target.value = '';
}

function handleExportDrop(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    addExportFiles(files);
}

function addExportFiles(files) {
    files.forEach(file => {
        if (!uploadedFiles.find(f => f.file.name === file.name)) {
            const guessed = guessCategory(file);
            uploadedFiles.push({ file, category: guessed.category, subtype: guessed.subtype });
        }
    });
    renderExportFileList();
    updateExportButton();
}

function guessCategory(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const name = file.name.toLowerCase();

    if (['mp4', 'mov', 'webm'].includes(ext)) return { category: 'video', subtype: name.includes('short') ? 'shorts' : 'raw' };
    if (['mp3', 'wav', 'aac'].includes(ext)) return { category: 'audio', subtype: name.includes('bgm') ? 'bgm' : 'raw' };
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { category: 'image', subtype: name.includes('thumb') ? 'youtube_thumb' : 'raw' };
    if (['txt', 'md', 'srt'].includes(ext)) return { category: 'text', subtype: 'script' };
    return { category: 'meta', subtype: 'custom' };
}

function renderExportFileList() {
    const list = document.getElementById('exportFileList');
    if (uploadedFiles.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = uploadedFiles.map((f, i) => {
        const cat = CATEGORIES.find(c => c.id === f.category);
        return `
            <div class="file-item">
                <span class="file-icon">${cat?.icon || '📁'}</span>
                <div class="file-info">
                    <span class="file-name">${f.file.name}</span>
                    <span class="file-size">${formatFileSize(f.file.size)}</span>
                </div>
                <button class="file-remove" data-index="${i}">✕</button>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.file-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            uploadedFiles.splice(parseInt(btn.dataset.index), 1);
            renderExportFileList();
            updateExportButton();
        });
    });
}

function selectExportField(btn) {
    document.querySelectorAll('.field-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedField = btn.dataset.field;
    currentProject.field = selectedField;
    updateExportButton();
}

function updateExportButton() {
    const btn = document.getElementById('exportZipBtn');
    btn.style.display = uploadedFiles.length > 0 && selectedField ? 'block' : 'none';
}

async function doExport() {
    if (!currentProject || uploadedFiles.length === 0) return;

    const btn = document.getElementById('exportZipBtn');
    btn.classList.add('loading');
    btn.textContent = '처리 중...';

    try {
        const projectJson = {
            project_id: currentProject.project_id,
            project_name: currentProject.project_name,
            field: selectedField,
            created_at: currentProject.created_at,
            exported_at: new Date().toISOString(),
            files: uploadedFiles.map(f => ({
                name: f.file.name,
                category: f.category,
                subtype: f.subtype
            }))
        };

        const zip = new JSZip();

        for (const f of uploadedFiles) {
            const path = `${f.category}/${f.subtype}_${f.file.name}`;
            const content = await readFileAsArrayBuffer(f.file);
            zip.file(path, content);
        }

        zip.file('meta/project.json', JSON.stringify(projectJson, null, 2));

        const blob = await zip.generateAsync({ type: 'blob' });
        const filename = `Project_${currentProject.project_id}.zip`;
        downloadBlob(blob, filename);

        currentProject.files = projectJson.files;
        await saveProject(currentProject);
        await loadProjects();

        showToast('Export 완료!', 'success');
    } catch (err) {
        console.error(err);
        showToast('Export 실패', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.textContent = 'ZIP 내보내기';
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ============================================
// BATCH TAB
// ============================================
function setupBatchTab() {
    document.getElementById('batchFieldGroup').querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('batchFieldGroup').querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            batchField = btn.dataset.field;
        });
    });

    document.getElementById('presetGroup').querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('presetGroup').querySelectorAll('.select-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            batchPreset = btn.dataset.preset;
            renderPipelinePreview();
        });
    });

    document.getElementById('batchProjectName').addEventListener('input', checkBatchReadyState);
    document.getElementById('exportRunPlanBtn').addEventListener('click', exportRunPlan);

    renderPipelinePreview();
}

function renderPipelinePreview() {
    const preset = PRESET_SETS[batchPreset];
    const preview = document.getElementById('pipelinePreview');

    preview.innerHTML = preset.pipeline.map((module, i) => `
        <div class="pipeline-item">
            <span class="pipeline-num">${i + 1}</span>
            <span class="pipeline-name">${module}</span>
        </div>
    `).join('');
}

function checkBatchReadyState() {
    const name = document.getElementById('batchProjectName').value.trim();
    document.getElementById('exportRunPlanBtn').disabled = !name;
}

function exportRunPlan() {
    const projectName = document.getElementById('batchProjectName').value.trim();
    if (!projectName) {
        showToast('프로젝트 이름을 입력하세요');
        return;
    }

    const preset = PRESET_SETS[batchPreset];
    const runPlan = {
        schema_version: 'run_plan@1.0',
        created_at: new Date().toISOString(),
        field: batchField,
        project: {
            project_name: projectName,
            author: 'PARKSY',
            note: ''
        },
        preset_set: batchPreset,
        presets: preset.presets,
        pipeline: preset.pipeline.map(module => ({
            module: module,
            enabled: true
        }))
    };

    const json = JSON.stringify(runPlan, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, 'run_plan.json');

    showToast('run_plan.json 내보내기 완료!', 'success');
}

// ============================================
// Utilities
// ============================================
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.classList.remove('show'), 2500);
}

