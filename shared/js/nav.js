/**
 * DTSLIB Tools — Shared Navigation
 * Mobile-first hamburger + drawer
 * Reads tool list from apps.json (single source of truth)
 */
(function() {
    'use strict';

    var path = location.pathname;
    var isRoot = path === '/' || path.endsWith('/dtslib-cloud-appstore/') || path.endsWith('/index.html');
    // Also check: if we're NOT in a tool subdirectory
    var segments = path.replace(/\/+$/, '').split('/');
    var lastSeg = segments[segments.length - 1];
    // If last segment is '' or 'index.html' or the repo name, we're at root
    if (lastSeg === 'index.html') {
        lastSeg = segments[segments.length - 2] || '';
    }

    var base = isRoot ? './' : '../';
    var currentId = '';

    // Category grouping
    var CAT_LABELS = { video: '영상', audio: '오디오', image: '이미지', util: '유틸' };
    var CAT_ORDER = ['video', 'audio', 'image', 'util'];

    // Inject CSS immediately (no flash)
    var style = document.createElement('style');
    style.textContent =
        '.dtsnav{position:fixed;top:0;left:0;right:0;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
        '.dtsnav-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.1);padding-top:calc(8px + env(safe-area-inset-top))}' +
        '.dtsnav-logo{color:#fff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.5px}' +
        '.dtsnav-toggle{background:none;border:none;padding:6px;cursor:pointer;display:flex;flex-direction:column;gap:4px;width:28px}' +
        '.dtsnav-toggle span{display:block;height:2px;background:#fff;border-radius:1px;transition:transform 0.3s,opacity 0.3s}' +
        '.dtsnav-toggle.open span:nth-child(1){transform:translateY(6px) rotate(45deg)}' +
        '.dtsnav-toggle.open span:nth-child(2){opacity:0}' +
        '.dtsnav-toggle.open span:nth-child(3){transform:translateY(-6px) rotate(-45deg)}' +
        '.dtsnav-drawer{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transform:translateX(100%);transition:transform 0.3s ease;padding-top:calc(52px + env(safe-area-inset-top));overflow-y:auto;-webkit-overflow-scrolling:touch}' +
        '.dtsnav-drawer.open{transform:translateX(0)}' +
        '.dtsnav-drawer-inner{padding:16px 20px 40px}' +
        '.dtsnav-group{margin-bottom:20px}' +
        '.dtsnav-group-title{font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-left:4px}' +
        '.dtsnav-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;text-decoration:none;color:rgba(255,255,255,0.85);font-size:15px;transition:background 0.2s}' +
        '.dtsnav-item:hover,.dtsnav-item:active{background:rgba(255,255,255,0.08)}' +
        '.dtsnav-active{background:rgba(0,122,255,0.15);color:#0A84FF}' +
        '.dtsnav-icon{font-size:20px;width:28px;text-align:center}' +
        '.dtsnav-name{font-weight:500}' +
        'body{padding-top:calc(52px + env(safe-area-inset-top)) !important}';
    document.head.appendChild(style);

    // Insert placeholder nav bar immediately
    var placeholder = document.createElement('nav');
    placeholder.id = 'dtsnav';
    placeholder.className = 'dtsnav';
    placeholder.innerHTML = '<div class="dtsnav-bar">' +
        '<a href="' + base + '" class="dtsnav-logo">DTSLIB Tools</a>' +
        '<button class="dtsnav-toggle" id="dtsnavToggle" aria-label="메뉴">' +
        '<span></span><span></span><span></span></button></div>' +
        '<div class="dtsnav-drawer" id="dtsnavDrawer"><div class="dtsnav-drawer-inner" id="dtsnavContent"></div></div>';
    document.body.insertBefore(placeholder, document.body.firstChild);

    // Load tools from apps.json
    fetch(base + 'apps.json')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var tools = data.apps || [];

            // Detect current tool
            tools.forEach(function(t) {
                if (path.indexOf('/' + t.id) !== -1) currentId = t.id;
            });

            // Build groups
            var groups = {};
            tools.forEach(function(t) {
                var cat = t.category || 'util';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(t);
            });

            var html = '';
            CAT_ORDER.forEach(function(cat) {
                if (!groups[cat]) return;
                html += '<div class="dtsnav-group">';
                html += '<div class="dtsnav-group-title">' + (CAT_LABELS[cat] || cat) + '</div>';
                groups[cat].forEach(function(t) {
                    var href = base + t.id + '/';
                    var active = t.id === currentId ? ' dtsnav-active' : '';
                    html += '<a href="' + href + '" class="dtsnav-item' + active + '">' +
                        '<span class="dtsnav-icon">' + t.icon + '</span>' +
                        '<span class="dtsnav-name">' + t.name + '</span></a>';
                });
                html += '</div>';
            });

            document.getElementById('dtsnavContent').innerHTML = html;
        })
        .catch(function() {});

    // Toggle drawer
    document.addEventListener('click', function(e) {
        var toggle = e.target.closest('#dtsnavToggle');
        if (toggle) {
            toggle.classList.toggle('open');
            document.getElementById('dtsnavDrawer').classList.toggle('open');
            document.body.style.overflow = document.getElementById('dtsnavDrawer').classList.contains('open') ? 'hidden' : '';
            return;
        }
        var item = e.target.closest('.dtsnav-item');
        if (item) {
            document.getElementById('dtsnavDrawer').classList.remove('open');
            document.getElementById('dtsnavToggle').classList.remove('open');
            document.body.style.overflow = '';
        }
    });
})();
