/**
 * Progress UI - Shared Module
 * 상태 및 진행률 표시 유틸리티
 */

/**
 * 상태 메시지 표시
 */
export function setStatus(element, message, type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.className = `status status-${type}`;
}

/**
 * 진행률 표시 (percentage)
 */
export function setProgress(element, percent) {
    if (!element) return;
    const value = Math.min(100, Math.max(0, percent));
    element.style.width = `${value}%`;
    element.textContent = `${Math.round(value)}%`;
}

/**
 * 로그 추가
 */
export function log(element, message, type = 'info') {
    if (!element) return;
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    element.appendChild(entry);
    element.scrollTop = element.scrollHeight;
}

/**
 * 로그 초기화
 */
export function clearLog(element) {
    if (!element) return;
    element.innerHTML = '';
}

/**
 * Toast 표시
 */
export function showToast(toastElement, message, type = '', duration = 3000) {
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.className = `toast show ${type}`;

    setTimeout(() => {
        toastElement.classList.remove('show');
    }, duration);
}

/**
 * Loading Overlay 표시/숨김
 */
export function showOverlay(overlayElement, message = 'Processing...') {
    if (!overlayElement) return;
    const msgEl = overlayElement.querySelector('.overlay-message') ||
                  overlayElement.querySelector('p');
    if (msgEl) msgEl.textContent = message;
    overlayElement.classList.add('active');
}

export function hideOverlay(overlayElement) {
    if (!overlayElement) return;
    overlayElement.classList.remove('active');
}

/**
 * Button 상태 관리
 */
export function setButtonLoading(button, loading = true, loadingText = 'Processing...') {
    if (!button) return;

    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
        button.classList.add('loading');
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalText || button.textContent;
        button.classList.remove('loading');
    }
}

/**
 * 섹션 표시/숨김
 */
export function showSection(element) {
    if (!element) return;
    element.classList.add('active');
    element.style.display = '';
}

export function hideSection(element) {
    if (!element) return;
    element.classList.remove('active');
    element.style.display = 'none';
}

/**
 * 모달 표시/숨김
 */
export function showModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.add('active');
    document.body.style.overflow = 'hidden';
}

export function hideModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.remove('active');
    document.body.style.overflow = '';
}
