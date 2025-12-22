/**
 * Parksy Meta Kit v1.0
 * Template + Variable Driven Metadata Generator
 *
 * Rules (v1.2 spec):
 * - Tags: 4 fixed ["parksy", "{tool}", "{type}", "{duration}min"]
 * - Project ID: parksy-{tool}-{YYYYMMDD}-{NN}
 * - Title: [{tool}] {duration}min {type} | Parksy
 * - Description: 3 lines fixed
 * - Chapters: Template only
 * - Creativity is a bug.
 */

// State
let selectedTool = null;
let selectedDuration = null;
let selectedType = null;
let sequence = 1;

// DOM Elements
const toolGroup = document.getElementById('toolGroup');
const durationGroup = document.getElementById('durationGroup');
const typeGroup = document.getElementById('typeGroup');
const projectIdInput = document.getElementById('projectId');
const seqNum = document.getElementById('seqNum');
const seqUp = document.getElementById('seqUp');
const seqDown = document.getElementById('seqDown');
const generateBtn = document.getElementById('generateBtn');
const outputSection = document.getElementById('outputSection');
const outputJson = document.getElementById('outputJson');
const copyBtn = document.getElementById('copyBtn');
const toast = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Tool buttons
    toolGroup.querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => selectOption(toolGroup, btn, 'tool'));
    });

    // Duration buttons
    durationGroup.querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => selectOption(durationGroup, btn, 'duration'));
    });

    // Type buttons
    typeGroup.querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => selectOption(typeGroup, btn, 'type'));
    });

    // Sequence controls
    seqUp.addEventListener('click', () => adjustSequence(1));
    seqDown.addEventListener('click', () => adjustSequence(-1));

    // Generate button
    generateBtn.addEventListener('click', generateMetadata);

    // Copy button
    copyBtn.addEventListener('click', copyToClipboard);

    // Initialize project ID
    updateProjectId();
}

function selectOption(group, btn, type) {
    // Remove selected from all buttons in group
    group.querySelectorAll('.select-btn').forEach(b => b.classList.remove('selected'));

    // Add selected to clicked button
    btn.classList.add('selected');

    // Update state
    const value = btn.dataset.value;
    if (type === 'tool') {
        selectedTool = value;
    } else if (type === 'duration') {
        selectedDuration = parseInt(value);
    } else if (type === 'type') {
        selectedType = value;
    }

    updateProjectId();
    checkReadyState();
}

function adjustSequence(delta) {
    sequence = Math.max(1, Math.min(99, sequence + delta));
    seqNum.textContent = sequence.toString().padStart(2, '0');
    updateProjectId();
}

function updateProjectId() {
    if (!selectedTool) {
        projectIdInput.value = 'parksy-{tool}-YYYYMMDD-NN';
        return;
    }

    const today = new Date();
    const dateStr = today.getFullYear().toString() +
        (today.getMonth() + 1).toString().padStart(2, '0') +
        today.getDate().toString().padStart(2, '0');

    const seqStr = sequence.toString().padStart(2, '0');
    projectIdInput.value = `parksy-${selectedTool}-${dateStr}-${seqStr}`;
}

function checkReadyState() {
    const ready = selectedTool && selectedDuration && selectedType;
    generateBtn.disabled = !ready;
}

function generateMetadata() {
    if (!selectedTool || !selectedDuration || !selectedType) {
        showToast('모든 옵션을 선택하세요');
        return;
    }

    const projectId = projectIdInput.value;
    const toolDisplay = formatToolName(selectedTool);
    const typeDisplay = capitalize(selectedType);
    const durationStr = selectedDuration.toString();

    // Generate metadata object (v1.2 spec)
    const metadata = {
        project_id: projectId,
        title: `[${toolDisplay}] ${durationStr}min ${typeDisplay} | Parksy`,
        description: [
            `This content was generated using ${toolDisplay}.`,
            `Duration: ${durationStr} minutes`,
            `Type: ${typeDisplay}`
        ].join('\n'),
        chapters: generateChapters(selectedDuration, selectedType),
        tags: [
            'parksy',
            selectedTool.toLowerCase(),
            selectedType.toLowerCase(),
            `${durationStr}min`
        ],
        pinned_comment: 'Made with Parksy Content Factory.'
    };

    // Display output
    outputJson.textContent = JSON.stringify(metadata, null, 2);
    outputSection.classList.add('active');

    // Auto increment sequence for next generation
    adjustSequence(1);

    showToast('Generated!');
}

function generateChapters(duration, type) {
    const isLoop = type.toLowerCase() === 'loop';
    const labelStart = isLoop ? 'Loop Start' : 'Start';
    const labelEnd = isLoop ? 'Loop End' : 'End';

    const endTime = formatChapterTime(duration);

    return [
        `00:00 ${labelStart}`,
        `${endTime} ${labelEnd}`
    ];
}

function formatChapterTime(minutes) {
    if (minutes < 10) {
        return `0${minutes}:00`;
    }
    return `${minutes}:00`;
}

function formatToolName(tool) {
    const names = {
        'audiocut': 'AudioCut',
        'audioloop': 'AudioLoop',
        'clipshorts': 'ClipShorts',
        'lectureshorts': 'LectureShorts',
        'lecturelong': 'LectureLong',
        'autoshorts': 'AutoShorts'
    };
    return names[tool] || tool;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function copyToClipboard() {
    const text = outputJson.textContent;

    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied!');
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied!');
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}
