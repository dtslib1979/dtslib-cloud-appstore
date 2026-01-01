/**
 * Parksy Image Pack v1.0
 * Platform-specific Image Resizer with Letterboxing
 *
 * Features:
 * - Multi-platform export (YouTube, Instagram, TikTok, Twitter)
 * - Canvas-based resizing with letterbox (background color extension)
 * - Quality control (70/85/95%)
 * - Format selection (JPEG/PNG/WebP)
 * - ZIP download for batch export
 * - Max input: 20MB
 */

// Platform specifications
const PLATFORMS = {
    'youtube-thumb': { name: 'YouTube_Thumbnail', width: 1280, height: 720 },
    'youtube-shorts': { name: 'YouTube_Shorts', width: 1080, height: 1920 },
    'instagram-square': { name: 'Instagram_Square', width: 1080, height: 1080 },
    'instagram-story': { name: 'Instagram_Story', width: 1080, height: 1920 },
    'tiktok': { name: 'TikTok', width: 1080, height: 1920 },
    'twitter': { name: 'Twitter_X', width: 1200, height: 675 }
};

// State
let sourceImage = null;
let selectedPlatforms = new Set();
let bgColor = '#000000';
let quality = 0.85;
let format = 'jpeg';
let generatedImages = [];

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const clearBtn = document.getElementById('clearBtn');
const imageInfo = document.getElementById('imageInfo');
const platformSection = document.getElementById('platformSection');
const optionsSection = document.getElementById('optionsSection');
const generateBtn = document.getElementById('generateBtn');
const outputSection = document.getElementById('outputSection');
const outputGrid = document.getElementById('outputGrid');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const toast = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Upload handlers
    uploadZone.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleFileSelect);
    clearBtn.addEventListener('click', clearImage);

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length) handleFile(files[0]);
    });

    // Platform selection
    document.querySelectorAll('.platform-btn').forEach(btn => {
        btn.addEventListener('click', () => togglePlatform(btn));
    });

    // Color options
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => selectColor(btn));
    });
    document.getElementById('customColor').addEventListener('input', (e) => {
        bgColor = e.target.value;
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    });

    // Quality options
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.addEventListener('click', () => selectQuality(btn));
    });

    // Format options
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', () => selectFormat(btn));
    });

    // Generate button
    generateBtn.addEventListener('click', generateImages);

    // Download all
    downloadAllBtn.addEventListener('click', downloadAllAsZip);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
}

function handleFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('이미지 파일만 지원합니다');
        return;
    }

    // Validate file size (20MB max)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('20MB 이하 파일만 지원합니다');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            sourceImage = img;
            showPreview(img, file);
        };
        img.onerror = () => {
            showToast('이미지를 불러올 수 없습니다');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function showPreview(img, file) {
    previewImage.src = img.src;
    imageInfo.textContent = `${img.width} × ${img.height} · ${formatFileSize(file.size)}`;

    uploadZone.style.display = 'none';
    previewContainer.classList.add('active');
    platformSection.classList.add('active');
    optionsSection.classList.add('active');

    checkReadyState();
}

function clearImage() {
    sourceImage = null;
    selectedPlatforms.clear();
    generatedImages = [];

    previewContainer.classList.remove('active');
    uploadZone.style.display = 'block';
    platformSection.classList.remove('active');
    optionsSection.classList.remove('active');
    outputSection.classList.remove('active');

    imageInput.value = '';
    document.querySelectorAll('.platform-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    checkReadyState();
}

function togglePlatform(btn) {
    const platform = btn.dataset.platform;

    if (selectedPlatforms.has(platform)) {
        selectedPlatforms.delete(platform);
        btn.classList.remove('selected');
    } else {
        selectedPlatforms.add(platform);
        btn.classList.add('selected');
    }

    checkReadyState();
}

function selectColor(btn) {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    bgColor = btn.dataset.color;
}

function selectQuality(btn) {
    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    quality = parseFloat(btn.dataset.quality);
}

function selectFormat(btn) {
    document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    format = btn.dataset.format;
}

function checkReadyState() {
    const ready = sourceImage && selectedPlatforms.size > 0;
    generateBtn.disabled = !ready;
}

async function generateImages() {
    if (!sourceImage || selectedPlatforms.size === 0) return;

    generateBtn.classList.add('loading');
    generateBtn.disabled = true;
    generatedImages = [];
    outputGrid.innerHTML = '';

    try {
        for (const platformId of selectedPlatforms) {
            const spec = PLATFORMS[platformId];
            const result = await resizeImage(sourceImage, spec);
            generatedImages.push(result);
            displayOutputItem(result);
        }

        outputSection.classList.add('active');
        showToast(`${generatedImages.length}개 이미지 생성 완료`);
    } catch (err) {
        console.error(err);
        showToast('이미지 생성 중 오류 발생');
    } finally {
        generateBtn.classList.remove('loading');
        generateBtn.disabled = false;
    }
}

function resizeImage(img, spec) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = spec.width;
        canvas.height = spec.height;

        // Fill background color (letterbox)
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate fit dimensions (contain mode)
        const imgRatio = img.width / img.height;
        const canvasRatio = spec.width / spec.height;

        let drawWidth, drawHeight, drawX, drawY;

        if (imgRatio > canvasRatio) {
            // Image is wider - fit to width
            drawWidth = spec.width;
            drawHeight = spec.width / imgRatio;
            drawX = 0;
            drawY = (spec.height - drawHeight) / 2;
        } else {
            // Image is taller - fit to height
            drawHeight = spec.height;
            drawWidth = spec.height * imgRatio;
            drawX = (spec.width - drawWidth) / 2;
            drawY = 0;
        }

        // Draw image centered
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // Get data URL
        const mimeType = getMimeType(format);
        const dataUrl = canvas.toDataURL(mimeType, quality);

        // Calculate size
        const base64 = dataUrl.split(',')[1];
        const size = Math.ceil((base64.length * 3) / 4);

        resolve({
            name: spec.name,
            width: spec.width,
            height: spec.height,
            dataUrl: dataUrl,
            size: size,
            format: format
        });
    });
}

function getMimeType(format) {
    const types = {
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp'
    };
    return types[format] || 'image/jpeg';
}

function displayOutputItem(result) {
    const item = document.createElement('div');
    item.className = 'output-item';

    const ext = format === 'jpeg' ? 'jpg' : format;
    const filename = `${result.name}.${ext}`;

    item.innerHTML = `
        <img src="${result.dataUrl}" alt="${result.name}">
        <div class="output-item-info">
            <div class="output-item-name">${result.name}</div>
            <div class="output-item-size">${result.width}×${result.height} · ${formatFileSize(result.size)}</div>
        </div>
        <a href="${result.dataUrl}" download="${filename}" class="output-item-download">📥 다운로드</a>
    `;

    outputGrid.appendChild(item);
}

async function downloadAllAsZip() {
    if (generatedImages.length === 0) return;

    showToast('ZIP 생성 중...');

    try {
        const zip = new JSZip();
        const ext = format === 'jpeg' ? 'jpg' : format;

        for (const img of generatedImages) {
            const base64 = img.dataUrl.split(',')[1];
            zip.file(`${img.name}.${ext}`, base64, { base64: true });
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `parksy-imagepack-${timestamp}.zip`;

        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('ZIP 다운로드 완료!');
    } catch (err) {
        console.error(err);
        showToast('ZIP 생성 실패');
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

