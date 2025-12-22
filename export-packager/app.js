/**
 * Export / Packager v1.0
 * 출하 엔진 - 여러 PWA 결과물을 프로젝트 단위로 패키징
 *
 * Features:
 * - IndexedDB 프로젝트 저장 (최근 20개)
 * - 드래그&드롭 + 파일 선택
 * - Category/Subtype 매핑
 * - Field preset (YouTube/Blog/Instagram)
 * - ZIP Export
 */

// ============================================
// Constants
// ============================================
const DB_NAME = 'packager-db';
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

const SUBTYPES = {
    video: ['shorts', 'long', 'reel', 'raw'],
    audio: ['voice_cut', 'bgm', 'bgm_loop', 'raw'],
    image: ['youtube_thumb', 'insta_square', 'insta_portrait', 'blog_cover', 'raw'],
    text: ['title', 'description', 'tags', 'script', 'post', 'caption', 'subtitles'],
    meta: ['project', 'platforms', 'custom']
};

const FIELD_PRESETS = {
    youtube: {
        required: [
            { category: 'video', subtypes: ['shorts', 'long'] },
            { category: 'image', subtypes: ['youtube_thumb'] },
            { category: 'text', subtypes: ['title'] }
        ],
        optional: ['description', 'tags', 'bgm']
    },
    blog: {
        required: [
            { category: 'text', subtypes: ['post'] },
            { category: 'image', subtypes: ['blog_cover'] }
        ],
        optional: ['summary', 'inline_images']
    },
    instagram: {
        required: [
            { category: 'image', subtypes: ['insta_square', 'insta_portrait'] },
            { category: 'video', subtypes: ['reel'] }
        ],
        optional: ['caption']
    }
};

// ============================================
// State
// ============================================
let db = null;
let currentProject = null;
let uploadedFiles = [];
let selectedField = null;
let exportMode = 'zip';

// ============================================
// DOM Elements
// ============================================
const steps = document.querySelectorAll('.step');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const mappingList = document.getElementById('mappingList');
const projectList = document.getElementById('projectList');
const fieldValidation = document.getElementById('fieldValidation');
const exportSummary = document.getElementById('exportSummary');
const toast = document.getElementById('toast');

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await initDB();
    await loadProjects();
    setupEventListeners();
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

async function deleteOldProjects() {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('created_at');
    const request = index.openCursor(null, 'prev');

    let count = 0;
    request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            count++;
            if (count > MAX_PROJECTS) {
                cursor.delete();
            }
            cursor.continue();
        }
    };
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Step 1: New Project
    document.getElementById('newProjectBtn').addEventListener('click', createNewProject);

    // Step 2: File Upload
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileInput);
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);

    document.getElementById('backToStep1').addEventListener('click', () => goToStep(1));
    document.getElementById('toStep3').addEventListener('click', () => {
        renderMappingList();
        goToStep(3);
    });

    // Step 3: Mapping
    document.getElementById('backToStep2').addEventListener('click', () => goToStep(2));
    document.getElementById('toStep4').addEventListener('click', () => goToStep(4));

    // Step 4: Field
    document.querySelectorAll('.field-btn').forEach(btn => {
        btn.addEventListener('click', () => selectField(btn));
    });
    document.getElementById('backToStep3').addEventListener('click', () => goToStep(3));
    document.getElementById('toStep5').addEventListener('click', () => goToStep(5));

    // Step 5: Mode
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => selectMode(btn));
    });
    document.getElementById('backToStep4').addEventListener('click', () => goToStep(4));
    document.getElementById('toStep6').addEventListener('click', () => {
        renderExportSummary();
        goToStep(6);
    });

    // Step 6: Export
    document.getElementById('backToStep5').addEventListener('click', () => goToStep(5));
    document.getElementById('exportBtn').addEventListener('click', doExport);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
}

// ============================================
// Step Navigation
// ============================================
function goToStep(num) {
    steps.forEach(s => s.classList.remove('active'));
    document.getElementById(`step${num}`).classList.add('active');
}

// ============================================
// Step 1: Project Management
// ============================================
function generateProjectId() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `P${date}_${time}_${rand}`;
}

function createNewProject() {
    const projectId = generateProjectId();
    currentProject = {
        project_id: projectId,
        project_name: `Project ${projectId.slice(-4)}`,
        field: null,
        created_at: new Date().toISOString(),
        files: []
    };

    uploadedFiles = [];
    selectedField = null;
    exportMode = 'zip';

    document.getElementById('currentProjectName').textContent = currentProject.project_name;
    goToStep(2);
}

function loadProject(project) {
    currentProject = { ...project };
    uploadedFiles = [];
    selectedField = project.field;
    exportMode = 'zip';

    document.getElementById('currentProjectName').textContent = project.project_name;
    goToStep(2);
}

function renderProjectList(projects) {
    if (projects.length === 0) {
        projectList.innerHTML = '<div class="no-projects">저장된 프로젝트가 없습니다</div>';
        return;
    }

    projectList.innerHTML = projects.map(p => `
        <div class="project-item" data-id="${p.project_id}">
            <div class="project-item-info">
                <h4>${p.project_name}</h4>
                <p>${formatDate(p.created_at)} · ${p.files.length}개 파일</p>
            </div>
            ${p.field ? `<span class="project-item-field">${p.field}</span>` : ''}
        </div>
    `).join('');

    projectList.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.id;
            const project = projects.find(p => p.project_id === id);
            if (project) loadProject(project);
        });
    });
}

// ============================================
// Step 2: File Upload
// ============================================
function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('dragover');
}

function handleDragLeave() {
    uploadZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
}

function handleFileInput(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
    fileInput.value = '';
}

function addFiles(files) {
    files.forEach(file => {
        const existing = uploadedFiles.find(f => f.file.name === file.name);
        if (!existing) {
            const guessed = guessCategory(file);
            uploadedFiles.push({
                file: file,
                category: guessed.category,
                subtype: guessed.subtype
            });
        }
    });
    renderFileList();
    updateStep2Button();
}

function guessCategory(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const name = file.name.toLowerCase();

    let category = 'meta';
    let subtype = 'custom';

    // Video
    if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) {
        category = 'video';
        if (name.includes('short')) subtype = 'shorts';
        else if (name.includes('long')) subtype = 'long';
        else if (name.includes('reel')) subtype = 'reel';
        else subtype = 'raw';
    }
    // Audio
    else if (['mp3', 'wav', 'aac', 'm4a', 'ogg'].includes(ext)) {
        category = 'audio';
        if (name.includes('bgm') && name.includes('loop')) subtype = 'bgm_loop';
        else if (name.includes('bgm')) subtype = 'bgm';
        else if (name.includes('voice') || name.includes('cut')) subtype = 'voice_cut';
        else subtype = 'raw';
    }
    // Image
    else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        category = 'image';
        if (name.includes('thumb')) subtype = 'youtube_thumb';
        else if (name.includes('square')) subtype = 'insta_square';
        else if (name.includes('portrait')) subtype = 'insta_portrait';
        else if (name.includes('cover')) subtype = 'blog_cover';
        else subtype = 'raw';
    }
    // Text
    else if (['txt', 'md', 'srt', 'vtt'].includes(ext)) {
        category = 'text';
        if (name.includes('title')) subtype = 'title';
        else if (name.includes('desc')) subtype = 'description';
        else if (name.includes('tag')) subtype = 'tags';
        else if (name.includes('script')) subtype = 'script';
        else if (name.includes('post')) subtype = 'post';
        else if (name.includes('caption')) subtype = 'caption';
        else if (ext === 'srt' || ext === 'vtt') subtype = 'subtitles';
        else subtype = 'script';
    }
    // JSON = meta
    else if (ext === 'json') {
        category = 'meta';
        if (name.includes('project')) subtype = 'project';
        else if (name.includes('platform')) subtype = 'platforms';
        else subtype = 'custom';
    }

    return { category, subtype };
}

function renderFileList() {
    if (uploadedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    fileList.innerHTML = uploadedFiles.map((f, i) => {
        const cat = CATEGORIES.find(c => c.id === f.category);
        return `
            <div class="file-item">
                <span class="file-icon">${cat ? cat.icon : '📁'}</span>
                <div class="file-info">
                    <div class="file-name">${f.file.name}</div>
                    <div class="file-size">${formatFileSize(f.file.size)}</div>
                </div>
                <button class="file-remove" data-index="${i}">✕</button>
            </div>
        `;
    }).join('');

    fileList.querySelectorAll('.file-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            uploadedFiles.splice(idx, 1);
            renderFileList();
            updateStep2Button();
        });
    });
}

function updateStep2Button() {
    document.getElementById('toStep3').disabled = uploadedFiles.length === 0;
}

// ============================================
// Step 3: File Mapping
// ============================================
function renderMappingList() {
    mappingList.innerHTML = uploadedFiles.map((f, i) => {
        const cat = CATEGORIES.find(c => c.id === f.category);
        return `
            <div class="mapping-item">
                <div class="mapping-file">
                    <span class="mapping-file-icon">${cat ? cat.icon : '📁'}</span>
                    <span class="mapping-file-name">${f.file.name}</span>
                </div>
                <div class="mapping-selects">
                    <select class="category-select" data-index="${i}">
                        ${CATEGORIES.map(c => `
                            <option value="${c.id}" ${c.id === f.category ? 'selected' : ''}>
                                ${c.icon} ${c.name}
                            </option>
                        `).join('')}
                    </select>
                    <select class="subtype-select" data-index="${i}">
                        ${SUBTYPES[f.category].map(s => `
                            <option value="${s}" ${s === f.subtype ? 'selected' : ''}>${s}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
    }).join('');

    // Category change updates subtype options
    mappingList.querySelectorAll('.category-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(sel.dataset.index);
            const newCat = sel.value;
            uploadedFiles[idx].category = newCat;
            uploadedFiles[idx].subtype = SUBTYPES[newCat][0];

            const subtypeSel = mappingList.querySelector(`.subtype-select[data-index="${idx}"]`);
            subtypeSel.innerHTML = SUBTYPES[newCat].map(s => `
                <option value="${s}">${s}</option>
            `).join('');
        });
    });

    mappingList.querySelectorAll('.subtype-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(sel.dataset.index);
            uploadedFiles[idx].subtype = sel.value;
        });
    });
}

// ============================================
// Step 4: Field Selection
// ============================================
function selectField(btn) {
    document.querySelectorAll('.field-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedField = btn.dataset.field;
    currentProject.field = selectedField;

    validateField();
    document.getElementById('toStep5').disabled = false;
}

function validateField() {
    const preset = FIELD_PRESETS[selectedField];
    const missing = [];

    preset.required.forEach(req => {
        const hasFile = uploadedFiles.some(f =>
            f.category === req.category && req.subtypes.includes(f.subtype)
        );
        if (!hasFile) {
            missing.push(`${req.category}/${req.subtypes.join(' 또는 ')}`);
        }
    });

    if (missing.length > 0) {
        fieldValidation.className = 'field-validation warning';
        fieldValidation.textContent = `⚠️ 누락: ${missing.join(', ')}`;
    } else {
        fieldValidation.className = 'field-validation success';
        fieldValidation.textContent = '✅ 필수 파일 완료';
    }
}

// ============================================
// Step 5: Export Mode
// ============================================
function selectMode(btn) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    exportMode = btn.dataset.mode;
}

// ============================================
// Step 6: Export
// ============================================
function renderExportSummary() {
    const fileCount = exportMode === 'field'
        ? getFieldFiles().length
        : uploadedFiles.length;

    exportSummary.innerHTML = `
        <h3>Export 요약</h3>
        <div class="export-summary-item">
            <span class="export-summary-label">Project ID</span>
            <span class="export-summary-value">${currentProject.project_id}</span>
        </div>
        <div class="export-summary-item">
            <span class="export-summary-label">Field</span>
            <span class="export-summary-value">${selectedField.toUpperCase()}</span>
        </div>
        <div class="export-summary-item">
            <span class="export-summary-label">Mode</span>
            <span class="export-summary-value">${exportMode === 'zip' ? 'ZIP (전체)' : 'Field (필수만)'}</span>
        </div>
        <div class="export-summary-item">
            <span class="export-summary-label">파일 수</span>
            <span class="export-summary-value">${fileCount}개</span>
        </div>
    `;
}

function getFieldFiles() {
    const preset = FIELD_PRESETS[selectedField];
    return uploadedFiles.filter(f => {
        return preset.required.some(req =>
            f.category === req.category && req.subtypes.includes(f.subtype)
        );
    });
}

function getTargetPath(file) {
    return `${file.category}/${file.subtype}.${file.file.name.split('.').pop()}`;
}

async function doExport() {
    const exportBtn = document.getElementById('exportBtn');
    exportBtn.classList.add('loading');

    try {
        const filesToExport = exportMode === 'field' ? getFieldFiles() : uploadedFiles;

        // Build project.json
        const projectJson = {
            project_id: currentProject.project_id,
            project_name: currentProject.project_name,
            field: selectedField,
            created_at: currentProject.created_at,
            exported_at: new Date().toISOString(),
            files: filesToExport.map(f => ({
                name: f.file.name,
                category: f.category,
                subtype: f.subtype,
                target_path: getTargetPath(f)
            }))
        };

        // Create ZIP
        const zip = new JSZip();

        // Add files to correct folders
        for (const f of filesToExport) {
            const path = getTargetPath(f);
            const content = await readFileAsArrayBuffer(f.file);
            zip.file(path, content);
        }

        // Add project.json
        zip.file('meta/project.json', JSON.stringify(projectJson, null, 2));

        // Generate ZIP
        const blob = await zip.generateAsync({ type: 'blob' });
        const suffix = exportMode === 'field' ? `_${selectedField.toUpperCase()}` : '';
        const filename = `Project_${currentProject.project_id}${suffix}.zip`;

        // Download
        downloadBlob(blob, filename);

        // Save to IndexedDB
        currentProject.files = projectJson.files;
        await saveProject(currentProject);
        await deleteOldProjects();

        showToast('Export 완료!');
    } catch (err) {
        console.error(err);
        showToast('Export 실패');
    } finally {
        exportBtn.classList.remove('loading');
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

// ============================================
// Utilities
// ============================================
function resetAll() {
    currentProject = null;
    uploadedFiles = [];
    selectedField = null;
    exportMode = 'zip';

    fileList.innerHTML = '';
    document.querySelectorAll('.field-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.mode-btn[data-mode="zip"]').classList.add('selected');
    fieldValidation.className = 'field-validation';
    document.getElementById('toStep3').disabled = true;
    document.getElementById('toStep5').disabled = true;

    loadProjects();
    goToStep(1);
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

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================================
// Service Worker
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}
