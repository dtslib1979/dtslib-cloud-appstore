/**
 * Slim Lens - Horizontal Photo Slimmer
 * Performance-optimized for mid-range Android
 */

(function() {
    'use strict';

    // Constants
    const PROXY_MAX_WIDTH = 800;
    const DEFAULT_SCALE_X = 0.92;
    const DEFAULT_STRENGTH = 0.18;
    const DEFAULT_CURVE = 2.2;

    // State
    let originalImage = null;
    let proxyImage = null;
    let proxyCanvas = null;
    let proxyCtx = null;
    let currentMode = 'basic';
    let isRendering = false;
    let renderPending = false;

    // Parameters
    let scaleX = DEFAULT_SCALE_X;
    let strength = DEFAULT_STRENGTH;
    let curve = DEFAULT_CURVE;
    let centerXRatio = 0.5; // Ratio relative to width

    // Precomputed LUT for warp
    let warpLUT = null;
    let lutWidth = 0;

    // DOM Elements
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const canvasContainer = document.getElementById('canvasContainer');
    const previewCanvas = document.getElementById('previewCanvas');
    const centerLine = document.getElementById('centerLine');
    const modeSelector = document.getElementById('modeSelector');
    const controls = document.getElementById('controls');
    const basicControls = document.getElementById('basicControls');
    const naturalControls = document.getElementById('naturalControls');
    const actionButtons = document.getElementById('actionButtons');

    // Sliders
    const scaleXSlider = document.getElementById('scaleXSlider');
    const scaleXValue = document.getElementById('scaleXValue');
    const strengthSlider = document.getElementById('strengthSlider');
    const strengthValue = document.getElementById('strengthValue');
    const curveSlider = document.getElementById('curveSlider');
    const curveValue = document.getElementById('curveValue');

    // Buttons
    const modeBtns = document.querySelectorAll('.mode-btn');
    const resetBtn = document.getElementById('resetBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    const ctx = previewCanvas.getContext('2d', { willReadFrequently: true });

    // Initialize
    function init() {
        setupEventListeners();
    }

    function setupEventListeners() {
        // File upload
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);

        // Mode buttons
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => setMode(btn.dataset.mode));
        });

        // Sliders - use input event for live updates
        scaleXSlider.addEventListener('input', handleScaleXChange);
        strengthSlider.addEventListener('input', handleStrengthChange);
        curveSlider.addEventListener('input', handleCurveChange);

        // Canvas tap for centerX
        canvasContainer.addEventListener('click', handleCanvasTap);

        // Action buttons
        resetBtn.addEventListener('click', resetParameters);
        downloadBtn.addEventListener('click', handleDownload);
    }

    // File handling
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.match(/^image\/(jpeg|png)$/)) {
            alert('Please select a JPEG or PNG image.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                originalImage = img;
                createProxyImage(img);
                showControls();
                resetParameters();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function createProxyImage(img) {
        // Create proxy canvas
        proxyCanvas = document.createElement('canvas');
        proxyCtx = proxyCanvas.getContext('2d');

        let w = img.width;
        let h = img.height;

        // Scale down if wider than PROXY_MAX_WIDTH
        if (w > PROXY_MAX_WIDTH) {
            const ratio = PROXY_MAX_WIDTH / w;
            w = PROXY_MAX_WIDTH;
            h = Math.round(img.height * ratio);
        }

        proxyCanvas.width = w;
        proxyCanvas.height = h;
        proxyCtx.drawImage(img, 0, 0, w, h);

        // Store proxy image data
        proxyImage = proxyCtx.getImageData(0, 0, w, h);

        // Set preview canvas size
        previewCanvas.width = w;
        previewCanvas.height = h;
    }

    function showControls() {
        uploadArea.style.display = 'none';
        canvasContainer.style.display = 'block';
        modeSelector.style.display = 'flex';
        controls.style.display = 'block';
        actionButtons.style.display = 'flex';
    }

    // Mode handling
    function setMode(mode) {
        currentMode = mode;

        modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        if (mode === 'basic') {
            basicControls.style.display = 'flex';
            naturalControls.style.display = 'none';
            centerLine.style.display = 'none';
        } else {
            basicControls.style.display = 'none';
            naturalControls.style.display = 'flex';
            updateCenterLine();
            centerLine.style.display = 'block';
        }

        scheduleRender();
    }

    // Slider handlers
    function handleScaleXChange(e) {
        scaleX = parseFloat(e.target.value);
        scaleXValue.textContent = scaleX.toFixed(2);
        scheduleRender();
    }

    function handleStrengthChange(e) {
        strength = parseFloat(e.target.value);
        strengthValue.textContent = strength.toFixed(2);
        invalidateLUT();
        scheduleRender();
    }

    function handleCurveChange(e) {
        curve = parseFloat(e.target.value);
        curveValue.textContent = curve.toFixed(1);
        invalidateLUT();
        scheduleRender();
    }

    // Canvas tap for centerX
    function handleCanvasTap(e) {
        if (currentMode !== 'natural') return;

        const rect = canvasContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const containerWidth = rect.width;

        centerXRatio = clickX / containerWidth;
        centerXRatio = Math.max(0.1, Math.min(0.9, centerXRatio));

        updateCenterLine();
        invalidateLUT();
        scheduleRender();
    }

    function updateCenterLine() {
        centerLine.style.left = (centerXRatio * 100) + '%';
    }

    // Rendering
    function scheduleRender() {
        if (isRendering) {
            renderPending = true;
            return;
        }
        requestAnimationFrame(render);
    }

    function render() {
        if (!proxyImage) return;

        isRendering = true;

        if (currentMode === 'basic') {
            renderBasic();
        } else {
            renderNatural();
        }

        isRendering = false;

        if (renderPending) {
            renderPending = false;
            requestAnimationFrame(render);
        }
    }

    // Basic mode: uniform X-scale using canvas transform
    function renderBasic() {
        const w = proxyCanvas.width;
        const h = proxyCanvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, w, h);

        // Scale the image horizontally
        const scaledWidth = w * scaleX;
        const offsetX = (w - scaledWidth) / 2;

        ctx.drawImage(proxyCanvas, offsetX, 0, scaledWidth, h);
    }

    // Natural mode: non-linear warp with precomputed LUT
    function renderNatural() {
        const w = proxyCanvas.width;
        const h = proxyCanvas.height;

        // Rebuild LUT if needed
        if (!warpLUT || lutWidth !== w) {
            buildWarpLUT(w);
        }

        const srcData = proxyImage.data;
        const output = ctx.createImageData(w, h);
        const dstData = output.data;

        // Apply warp using LUT
        for (let y = 0; y < h; y++) {
            const rowOffset = y * w * 4;

            for (let x = 0; x < w; x++) {
                const srcX = warpLUT[x];
                const dstIdx = rowOffset + x * 4;

                // Bilinear interpolation
                const x0 = Math.floor(srcX);
                const x1 = Math.min(x0 + 1, w - 1);
                const fx = srcX - x0;

                const srcIdx0 = rowOffset + x0 * 4;
                const srcIdx1 = rowOffset + x1 * 4;

                dstData[dstIdx] = srcData[srcIdx0] * (1 - fx) + srcData[srcIdx1] * fx;
                dstData[dstIdx + 1] = srcData[srcIdx0 + 1] * (1 - fx) + srcData[srcIdx1 + 1] * fx;
                dstData[dstIdx + 2] = srcData[srcIdx0 + 2] * (1 - fx) + srcData[srcIdx1 + 2] * fx;
                dstData[dstIdx + 3] = 255;
            }
        }

        ctx.putImageData(output, 0, 0);
    }

    function invalidateLUT() {
        warpLUT = null;
    }

    // Build 1D warp LUT
    // Maps destination X to source X
    // Center preserved, edges compressed more
    function buildWarpLUT(width) {
        warpLUT = new Float32Array(width);
        lutWidth = width;

        const centerX = width * centerXRatio;
        const k = strength;
        const p = curve;

        // Precompute curve values to avoid pow() in loop
        // Using polynomial approximation for common p values
        const useFastPow = (p >= 1.9 && p <= 2.3);

        for (let x = 0; x < width; x++) {
            // Normalized distance from center (-1 to 1)
            let dx;
            let maxDist;

            if (x < centerX) {
                dx = (centerX - x) / centerX;
                maxDist = centerX;
            } else {
                dx = (x - centerX) / (width - centerX);
                maxDist = width - centerX;
            }

            // Apply warp: compress edges more than center
            // warp = dx + k * dx^p (scaled back to pixel coords)
            let warpedDx;
            if (useFastPow) {
                // Fast approximation for p ~= 2
                warpedDx = dx + k * dx * dx;
            } else {
                warpedDx = dx + k * Math.pow(dx, p);
            }

            // Map back to pixel coordinates
            let srcX;
            if (x < centerX) {
                srcX = centerX - warpedDx * centerX;
            } else {
                srcX = centerX + warpedDx * (width - centerX);
            }

            // Clamp to valid range
            warpLUT[x] = Math.max(0, Math.min(width - 1, srcX));
        }
    }

    // Reset parameters
    function resetParameters() {
        scaleX = DEFAULT_SCALE_X;
        strength = DEFAULT_STRENGTH;
        curve = DEFAULT_CURVE;
        centerXRatio = 0.5;

        scaleXSlider.value = scaleX;
        scaleXValue.textContent = scaleX.toFixed(2);
        strengthSlider.value = strength;
        strengthValue.textContent = strength.toFixed(2);
        curveSlider.value = curve;
        curveValue.textContent = curve.toFixed(1);

        updateCenterLine();
        invalidateLUT();
        scheduleRender();
    }

    // Download - apply to full resolution
    function handleDownload() {
        if (!originalImage) return;

        downloadBtn.textContent = 'Processing...';
        downloadBtn.disabled = true;

        // Use setTimeout to let UI update
        setTimeout(() => {
            try {
                const fullCanvas = document.createElement('canvas');
                const fullCtx = fullCanvas.getContext('2d');
                const w = originalImage.width;
                const h = originalImage.height;

                fullCanvas.width = w;
                fullCanvas.height = h;

                if (currentMode === 'basic') {
                    // Basic mode: uniform scale
                    const scaledWidth = w * scaleX;
                    const offsetX = (w - scaledWidth) / 2;
                    fullCtx.drawImage(originalImage, offsetX, 0, scaledWidth, h);
                } else {
                    // Natural mode: apply warp at full resolution
                    applyFullResWarp(fullCanvas, fullCtx, w, h);
                }

                // Export
                const dataUrl = fullCanvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = generateFilename();
                link.href = dataUrl;
                link.click();

            } catch (e) {
                console.error('Export error:', e);
                alert('Export failed. Please try again.');
            }

            downloadBtn.textContent = 'Download';
            downloadBtn.disabled = false;
        }, 50);
    }

    function applyFullResWarp(canvas, ctx, w, h) {
        // Draw original to temp canvas first
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = w;
        tempCanvas.height = h;
        tempCtx.drawImage(originalImage, 0, 0);
        const srcData = tempCtx.getImageData(0, 0, w, h).data;

        // Build full-res LUT
        const fullLUT = new Float32Array(w);
        const centerX = w * centerXRatio;
        const k = strength;
        const p = curve;

        for (let x = 0; x < w; x++) {
            let dx;
            if (x < centerX) {
                dx = (centerX - x) / centerX;
            } else {
                dx = (x - centerX) / (w - centerX);
            }

            const warpedDx = dx + k * Math.pow(dx, p);

            let srcX;
            if (x < centerX) {
                srcX = centerX - warpedDx * centerX;
            } else {
                srcX = centerX + warpedDx * (w - centerX);
            }

            fullLUT[x] = Math.max(0, Math.min(w - 1, srcX));
        }

        // Apply warp
        const output = ctx.createImageData(w, h);
        const dstData = output.data;

        for (let y = 0; y < h; y++) {
            const rowOffset = y * w * 4;

            for (let x = 0; x < w; x++) {
                const srcX = fullLUT[x];
                const dstIdx = rowOffset + x * 4;

                const x0 = Math.floor(srcX);
                const x1 = Math.min(x0 + 1, w - 1);
                const fx = srcX - x0;

                const srcIdx0 = rowOffset + x0 * 4;
                const srcIdx1 = rowOffset + x1 * 4;

                dstData[dstIdx] = srcData[srcIdx0] * (1 - fx) + srcData[srcIdx1] * fx;
                dstData[dstIdx + 1] = srcData[srcIdx0 + 1] * (1 - fx) + srcData[srcIdx1 + 1] * fx;
                dstData[dstIdx + 2] = srcData[srcIdx0 + 2] * (1 - fx) + srcData[srcIdx1 + 2] * fx;
                dstData[dstIdx + 3] = 255;
            }
        }

        ctx.putImageData(output, 0, 0);
    }

    function generateFilename() {
        const date = new Date();
        const ts = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const suffix = currentMode === 'basic' ? `scale${scaleX.toFixed(2)}` : `warp${strength.toFixed(2)}`;
        return `slimlens_${ts}_${suffix}.png`;
    }

    // Start app
    init();
})();
