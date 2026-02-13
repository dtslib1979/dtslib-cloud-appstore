/**
 * DTSLIB Tools — Shared Navigation
 * Mobile-first hamburger + drawer
 */
(function() {
    'use strict';

    var TOOLS = [
        { id: 'lecture-shorts', name: 'Lecture Shorts', icon: '🎓', group: '영상' },
        { id: 'lecture-long',   name: 'Lecture Long',   icon: '📹', group: '영상' },
        { id: 'auto-shorts',   name: 'Auto Shorts',    icon: '🎬', group: '영상' },
        { id: 'clip-shorts',   name: 'Clip Shorts',    icon: '🎞️', group: '영상' },
        { id: 'audio-studio',  name: 'Audio Studio',   icon: '🎵', group: '오디오' },
        { id: 'slim-lens',     name: 'Slim Lens',      icon: '📷', group: '이미지' },
        { id: 'image-pack',    name: 'Image Pack',     icon: '📦', group: '이미지' },
        { id: 'bilingual-aligner', name: 'Bilingual Aligner', icon: '📘', group: '유틸' },
        { id: 'project-manager',   name: 'Project Manager',   icon: '📋', group: '유틸' }
    ];

    // Detect current page from URL
    var path = location.pathname;
    var currentId = '';
    TOOLS.forEach(function(t) {
        if (path.indexOf('/' + t.id) !== -1) currentId = t.id;
    });

    // Determine base path (are we in root or a tool dir?)
    var isRoot = !currentId;
    var base = isRoot ? './' : '../';

    // Build nav HTML
    var navHTML = '<nav id="dtsnav" class="dtsnav">' +
        '<div class="dtsnav-bar">' +
            '<a href="' + base + '" class="dtsnav-logo">DTSLIB Tools</a>' +
            '<button class="dtsnav-toggle" id="dtsnavToggle" aria-label="메뉴">' +
                '<span></span><span></span><span></span>' +
            '</button>' +
        '</div>' +
        '<div class="dtsnav-drawer" id="dtsnavDrawer">' +
            '<div class="dtsnav-drawer-inner">' +
                buildGroups() +
            '</div>' +
        '</div>' +
    '</nav>';

    function buildGroups() {
        var groups = {};
        var order = ['영상', '오디오', '이미지', '유틸'];
        TOOLS.forEach(function(t) {
            if (!groups[t.group]) groups[t.group] = [];
            groups[t.group].push(t);
        });
        var html = '';
        order.forEach(function(g) {
            html += '<div class="dtsnav-group">';
            html += '<div class="dtsnav-group-title">' + g + '</div>';
            groups[g].forEach(function(t) {
                var href = base + t.id + '/';
                var active = t.id === currentId ? ' dtsnav-active' : '';
                html += '<a href="' + href + '" class="dtsnav-item' + active + '">' +
                    '<span class="dtsnav-icon">' + t.icon + '</span>' +
                    '<span class="dtsnav-name">' + t.name + '</span>' +
                '</a>';
            });
            html += '</div>';
        });
        return html;
    }

    // Inject CSS
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

    // Inject nav into body
    var div = document.createElement('div');
    div.innerHTML = navHTML;
    document.body.insertBefore(div.firstChild, document.body.firstChild);

    // Toggle drawer
    var toggle = document.getElementById('dtsnavToggle');
    var drawer = document.getElementById('dtsnavDrawer');
    toggle.addEventListener('click', function() {
        toggle.classList.toggle('open');
        drawer.classList.toggle('open');
        document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : '';
    });

    // Close drawer on link click
    drawer.addEventListener('click', function(e) {
        if (e.target.closest('.dtsnav-item')) {
            drawer.classList.remove('open');
            toggle.classList.remove('open');
            document.body.style.overflow = '';
        }
    });
})();
