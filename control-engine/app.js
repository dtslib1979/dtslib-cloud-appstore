/**
 * Prompt / Control Engine v1.0
 * PC Batch Runner용 실행 계획(run_plan.json) 생성기
 *
 * 이 앱은 "설정 생성기"다. 실행하지 않는다.
 * 실행은 PC Batch Runner(Python)가 한다.
 * 출하는 Export/Packager가 한다.
 */

// ============================================
// Constants - Module Names (snake_case 고정)
// ============================================
const MODULES = [
    { id: 'meta_kit', name: 'Meta Kit', desc: '메타데이터 생성' },
    { id: 'image_pack', name: 'Image Pack', desc: '이미지 규격 변환' },
    { id: 'lecture_shorts', name: 'Lecture Shorts', desc: '4분→3분 쇼츠' },
    { id: 'lecture_long', name: 'Lecture Long', desc: '16분→12분 튜토리얼' },
    { id: 'auto_shorts', name: 'Auto Shorts', desc: '자동 쇼츠 변환' },
    { id: 'clip_shorts', name: 'Clip Shorts', desc: '클립 조합 쇼츠' },
    { id: 'slim_lens', name: 'Slim Lens', desc: '이미지 슬림 변환' },
    { id: 'bilingual_aligner', name: 'Bilingual Aligner', desc: '한영 정렬' },
    { id: 'audio_cut', name: 'Audio Cut', desc: '오디오 컷' },
    { id: 'audio_loop', name: 'Audio Loop', desc: '오디오 루프' },
    { id: 'export_packager', name: 'Export Packager', desc: 'ZIP 출하' }
];

// ============================================
// Preset Sets - 기본 3개 (하드코딩)
// ============================================
const PRESET_SETS = {
    youtube_v1: {
        name: 'youtube_v1',
        presets: {
            shorts_v1: {
                target_len_sec: 30,
                ratio: '9:16',
                fps: 30
            },
            thumb_v1: {
                w: 1280,
                h: 720,
                max_mb: 2
            },
            audio_v1: {
                lufs: -14,
                max_peak_db: -1
            }
        },
        defaultPipeline: ['meta_kit', 'image_pack', 'lecture_shorts', 'audio_loop', 'export_packager']
    },
    blog_v1: {
        name: 'blog_v1',
        presets: {
            post_img_v1: {
                w: 1200,
                h: 630,
                max_mb: 2
            },
            cover_v1: {
                w: 1920,
                h: 1080,
                max_mb: 3
            }
        },
        defaultPipeline: ['meta_kit', 'image_pack', 'export_packager']
    },
    insta_v1: {
        name: 'insta_v1',
        presets: {
            square_v1: {
                w: 1080,
                h: 1080,
                max_mb: 2
            },
            reel_v1: {
                ratio: '9:16',
                fps: 30,
                target_len_sec: 30
            }
        },
        defaultPipeline: ['image_pack', 'clip_shorts', 'export_packager']
    }
};

// ============================================
// State
// ============================================
let currentStep = 1;
let state = {
    field: 'youtube',
    project: {
        project_name: '',
        author: 'PARKSY',
        note: ''
    },
    preset_set: 'youtube_v1',
    presets: JSON.parse(JSON.stringify(PRESET_SETS.youtube_v1.presets)),
    pipeline: []
};

// ============================================
// DOM Elements
// ============================================
const steps = document.querySelectorAll('.step');
const progressSteps = document.querySelectorAll('.progress-step');
const toast = document.getElementById('toast');

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupFieldSelection();
    setupProjectForm();
    setupPresetSelection();
    setupNavigation();
    initPipeline();
    updatePresetForm();
}

// ============================================
// Step Navigation
// ============================================
function goToStep(num) {
    currentStep = num;

    steps.forEach(s => s.classList.remove('active'));
    document.getElementById(`step${num}`).classList.add('active');

    progressSteps.forEach((ps, i) => {
        ps.classList.remove('active', 'completed');
        if (i + 1 < num) ps.classList.add('completed');
        if (i + 1 === num) ps.classList.add('active');
    });

    if (num === 6) {
        renderJsonPreview();
    }
}

function setupNavigation() {
    // Step 1 → 2
    document.getElementById('toStep2').addEventListener('click', () => goToStep(2));

    // Step 2 → 3
    document.getElementById('backToStep1').addEventListener('click', () => goToStep(1));
    document.getElementById('toStep3').addEventListener('click', () => {
        if (validateStep2()) goToStep(3);
    });

    // Step 3 → 4
    document.getElementById('backToStep2').addEventListener('click', () => goToStep(2));
    document.getElementById('toStep4').addEventListener('click', () => {
        updatePresetForm();
        goToStep(4);
    });

    // Step 4 → 5
    document.getElementById('backToStep3').addEventListener('click', () => goToStep(3));
    document.getElementById('toStep5').addEventListener('click', () => {
        savePresetValues();
        renderPipeline();
        goToStep(5);
    });

    // Step 5 → 6
    document.getElementById('backToStep4').addEventListener('click', () => goToStep(4));
    document.getElementById('toStep6').addEventListener('click', () => goToStep(6));

    // Step 6
    document.getElementById('backToStep5').addEventListener('click', () => goToStep(5));
    document.getElementById('startOver').addEventListener('click', startOver);
    document.getElementById('exportBtn').addEventListener('click', exportRunPlan);

    // Reset presets
    document.getElementById('resetPresets').addEventListener('click', resetPresets);
}

// ============================================
// Step 1: Field Selection
// ============================================
function setupFieldSelection() {
    document.querySelectorAll('.field-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.field-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.field = btn.dataset.field;
        });
    });
}

// ============================================
// Step 2: Project Form
// ============================================
function setupProjectForm() {
    const nameInput = document.getElementById('projectName');
    const authorInput = document.getElementById('author');
    const noteInput = document.getElementById('note');
    const nextBtn = document.getElementById('toStep3');

    nameInput.addEventListener('input', () => {
        state.project.project_name = nameInput.value.trim();
        nextBtn.disabled = !state.project.project_name;
    });

    authorInput.addEventListener('input', () => {
        state.project.author = authorInput.value.trim() || 'PARKSY';
    });

    noteInput.addEventListener('input', () => {
        state.project.note = noteInput.value;
    });
}

function validateStep2() {
    if (!state.project.project_name) {
        showToast('프로젝트 이름을 입력하세요');
        return false;
    }
    return true;
}

// ============================================
// Step 3: Preset Set Selection
// ============================================
function setupPresetSelection() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.preset_set = btn.dataset.preset;
            state.presets = JSON.parse(JSON.stringify(PRESET_SETS[state.preset_set].presets));
            initPipeline();
        });
    });
}

// ============================================
// Step 4: Preset Parameters
// ============================================
function updatePresetForm() {
    const form = document.getElementById('presetForm');
    form.innerHTML = '';

    const presets = state.presets;

    for (const [presetKey, presetValues] of Object.entries(presets)) {
        const section = document.createElement('div');
        section.className = 'preset-section';

        section.innerHTML = `
            <div class="preset-section-title">${presetKey}</div>
            <div class="preset-fields">
                ${Object.entries(presetValues).map(([key, value]) => `
                    <div class="preset-field">
                        <label>${key}</label>
                        <input type="${typeof value === 'number' ? 'number' : 'text'}"
                               data-preset="${presetKey}"
                               data-key="${key}"
                               value="${value}">
                    </div>
                `).join('')}
            </div>
        `;

        form.appendChild(section);
    }
}

function savePresetValues() {
    document.querySelectorAll('.preset-field input').forEach(input => {
        const preset = input.dataset.preset;
        const key = input.dataset.key;
        let value = input.value;

        // Convert to number if needed
        if (input.type === 'number') {
            value = parseFloat(value) || 0;
        }

        if (state.presets[preset]) {
            state.presets[preset][key] = value;
        }
    });
}

function resetPresets() {
    state.presets = JSON.parse(JSON.stringify(PRESET_SETS[state.preset_set].presets));
    updatePresetForm();
    showToast('기본값으로 초기화됨');
}

// ============================================
// Step 5: Pipeline Configuration
// ============================================
function initPipeline() {
    const defaultPipeline = PRESET_SETS[state.preset_set].defaultPipeline;

    state.pipeline = MODULES.map(m => ({
        module: m.id,
        enabled: defaultPipeline.includes(m.id)
    }));

    // Sort: enabled first, in default order
    state.pipeline.sort((a, b) => {
        const aIdx = defaultPipeline.indexOf(a.module);
        const bIdx = defaultPipeline.indexOf(b.module);
        if (a.enabled && !b.enabled) return -1;
        if (!a.enabled && b.enabled) return 1;
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
    });
}

function renderPipeline() {
    const list = document.getElementById('pipelineList');
    list.innerHTML = '';

    state.pipeline.forEach((item, index) => {
        const module = MODULES.find(m => m.id === item.module);
        const div = document.createElement('div');
        div.className = `pipeline-item ${item.enabled ? '' : 'disabled'}`;
        div.dataset.index = index;

        div.innerHTML = `
            <input type="checkbox" class="pipeline-checkbox"
                   ${item.enabled ? 'checked' : ''}
                   data-index="${index}">
            <div class="pipeline-info">
                <div class="pipeline-name">${module.name}</div>
                <div class="pipeline-module">${module.id}</div>
            </div>
            <div class="pipeline-order">
                <button class="move-up" data-index="${index}">▲</button>
                <button class="move-down" data-index="${index}">▼</button>
            </div>
        `;

        list.appendChild(div);
    });

    // Checkbox handlers
    list.querySelectorAll('.pipeline-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            state.pipeline[idx].enabled = e.target.checked;
            renderPipeline();
        });
    });

    // Move handlers
    list.querySelectorAll('.move-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            if (idx > 0) {
                [state.pipeline[idx], state.pipeline[idx - 1]] =
                [state.pipeline[idx - 1], state.pipeline[idx]];
                renderPipeline();
            }
        });
    });

    list.querySelectorAll('.move-down').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            if (idx < state.pipeline.length - 1) {
                [state.pipeline[idx], state.pipeline[idx + 1]] =
                [state.pipeline[idx + 1], state.pipeline[idx]];
                renderPipeline();
            }
        });
    });
}

// ============================================
// Step 6: Export
// ============================================
function buildRunPlan() {
    return {
        schema_version: 'run_plan@1.0',
        created_at: new Date().toISOString(),
        field: state.field,
        project: {
            project_name: state.project.project_name,
            author: state.project.author,
            note: state.project.note
        },
        preset_set: state.preset_set,
        presets: state.presets,
        pipeline: state.pipeline.map(item => {
            const obj = {
                module: item.module,
                enabled: item.enabled
            };
            // Add preset reference for certain modules
            if (item.module === 'lecture_shorts' || item.module === 'auto_shorts' || item.module === 'clip_shorts') {
                if (state.presets.shorts_v1) obj.preset = 'shorts_v1';
                if (state.presets.reel_v1) obj.preset = 'reel_v1';
            }
            if (item.module === 'image_pack') {
                if (state.presets.thumb_v1) obj.preset = 'thumb_v1';
                if (state.presets.square_v1) obj.preset = 'square_v1';
            }
            if (item.module === 'audio_loop' || item.module === 'audio_cut') {
                if (state.presets.audio_v1) obj.preset = 'audio_v1';
            }
            return obj;
        }),
        notes: state.project.note
    };
}

function renderJsonPreview() {
    const preview = document.getElementById('jsonPreview');
    const runPlan = buildRunPlan();
    preview.innerHTML = `<pre>${JSON.stringify(runPlan, null, 2)}</pre>`;
}

function exportRunPlan() {
    const runPlan = buildRunPlan();
    const json = JSON.stringify(runPlan, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'run_plan.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('OK. PC에서 Batch Runner로 실행하세요.', 'success');
}

// ============================================
// Utilities
// ============================================
function startOver() {
    state = {
        field: 'youtube',
        project: {
            project_name: '',
            author: 'PARKSY',
            note: ''
        },
        preset_set: 'youtube_v1',
        presets: JSON.parse(JSON.stringify(PRESET_SETS.youtube_v1.presets)),
        pipeline: []
    };

    document.getElementById('projectName').value = '';
    document.getElementById('author').value = 'PARKSY';
    document.getElementById('note').value = '';
    document.getElementById('toStep3').disabled = true;

    document.querySelectorAll('.field-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.field-btn[data-field="youtube"]').classList.add('selected');

    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector('.preset-btn[data-preset="youtube_v1"]').classList.add('selected');

    initPipeline();
    goToStep(1);
}

function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = 'toast' + (type ? ` ${type}` : '');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// Service Worker Registration
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}
