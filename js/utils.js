// Utility Functions

// Escape HTML to prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

// Generate avatar URL
function getAvatarUrl(username, customUrl) {
    if (customUrl && customUrl.trim() !== "") return customUrl;
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
}

// Format date/time
function formatTime(timestamp) {
    if (!timestamp) return '';
    const dateObj = new Date(timestamp);
    return dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const dateObj = new Date(timestamp);
    return dateObj.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format duration (for voice messages)
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Generate unique ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Play notification sound
function playBeep(freq = 587.33) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
        console.error('Error playing beep:', e);
    }
}

// Show notification
function showNotification(title, options = {}) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, options);
    }
}

// Request notification permission
function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        return Notification.requestPermission();
    }
    return Promise.resolve(Notification.permission);
}

// Parse markdown-like formatting
function parseMarkdown(str) {
    if (!str) return '';
    const tokens = [];
    const makeToken = (index) => `\uE000TOKEN${index}\uE001`;

    let workingStr = str
        // Code blocks
        .replace(/```(\w+)?\n?([\s\S]*?)```/g, (m, lang, code) => {
            const rawCode = code.replace(/\n$/, '');
            const langLabel = (lang || '').toLowerCase();
            const looksLikeHtml = langLabel === 'html' || /^\s*<!DOCTYPE|^\s*<html/i.test(rawCode);
            const blockId = 'codeblock_' + generateId();
            window.codeBlocksMap = window.codeBlocksMap || new Map();
            window.codeBlocksMap.set(blockId, rawCode);

            const runBtnHTML = looksLikeHtml
                ? `<button type="button" class="run-code-btn" data-target="${blockId}">▶ Çalıştır</button>`
                : '';

            const escapedCode = escapeHTML(rawCode);
            const blockHTML = `<div class="code-block-container" id="${blockId}">
                <div class="code-block-header">
                    <span>${escapeHTML(langLabel || 'kod')}</span>
                    <div class="code-block-actions">
                        ${runBtnHTML}
                        <button type="button" class="code-block-copy-btn" data-target="${blockId}">Kopyala</button>
                    </div>
                </div>
                <pre><code>${escapedCode}</code></pre>
            </div>`;
            tokens.push(blockHTML);
            return makeToken(tokens.length - 1);
        })
        // Inline code
        .replace(/`(.*?)`/g, (m, p1) => {
            const codeHTML = `<span class="code-container"><code>${escapeHTML(p1)}</code><button type="button" class="code-copy-btn" data-code="${p1.replace(/"/g, '&quot;')}">Kopyala</button></span>`;
            tokens.push(codeHTML);
            return makeToken(tokens.length - 1);
        })
        // Links
        .replace(/(https?:\/\/[^\s<]+)/g, (url) => {
            const linkHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link">${url}</a>`;
            tokens.push(linkHTML);
            return makeToken(tokens.length - 1);
        });

    let html = escapeHTML(workingStr);
    
    // Mentions
    html = html.replace(/@([a-zA-Z0-9_\u011f\u00fc\u015f\u0131\u00f6\u00e7\u011e\u00dc\u015e\u0130\u00d6\u00c7]+)/g, '<span class="mention-tag">@$1</span>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Strikethrough
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Replace tokens
    for (let i = 0; i < tokens.length; i++) {
        html = html.split(makeToken(i)).join(tokens[i]);
    }

    return html;
}

// Render media previews
function renderMediaPreviews(container) {
    if (!container) return;
    const links = container.querySelectorAll('.chat-link');
    
    links.forEach(link => {
        const url = link.href;

        // GIF
        const isGifUrl = /\.(gif)(\?.*)?$/i.test(url);
        if (isGifUrl) {
            if (container.querySelector(`[data-media-url="${url}"]`)) return;
            const mediaBox = document.createElement('div');
            mediaBox.className = 'media-container';
            mediaBox.dataset.mediaUrl = url;
            mediaBox.innerHTML = `<img src="${url}" class="media-preview" alt="GIF" loading="lazy">`;
            container.appendChild(mediaBox);
            return;
        }

        // YouTube
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
        if (ytMatch && ytMatch[1]) {
            if (container.querySelector(`[data-media-url="${url}"]`)) return;
            const mediaBox = document.createElement('div');
            mediaBox.className = 'media-container';
            mediaBox.dataset.mediaUrl = url;
            mediaBox.innerHTML = `
                <iframe src="https://www.youtube.com/embed/${ytMatch[1]}"
                    style="width:100%; height:220px; border-radius:6px; border:1px solid var(--border-color);"
                    allowfullscreen loading="lazy"></iframe>`;
            container.appendChild(mediaBox);
            return;
        }

        // Images
        const img = new Image();
        img.src = url;
        img.onload = () => {
            if (container.querySelector(`[data-media-url="${url}"]`)) return;
            const mediaBox = document.createElement('div');
            mediaBox.className = 'media-container';
            mediaBox.dataset.mediaUrl = url;
            mediaBox.innerHTML = `<img src="${url}" class="media-preview" alt="Görsel Önizleme" loading="lazy">`;
            container.appendChild(mediaBox);
        };
        
        img.onerror = () => {
            // Try as video
            const video = document.createElement('video');
            video.src = url;
            video.onloadedmetadata = () => {
                if (container.querySelector(`[data-media-url="${url}"]`)) return;
                const mediaBox = document.createElement('div');
                mediaBox.className = 'media-container';
                mediaBox.dataset.mediaUrl = url;
                mediaBox.innerHTML = `<video src="${url}" class="media-preview" controls preload="metadata"></video>`;
                container.appendChild(mediaBox);
            };
        };
    });
}

// Check if user is admin
function isAdmin() {
    return window.AppConfig && 
           window.AppConfig.AppState && 
           window.AppConfig.ADMIN_EMAILS &&
           window.AppConfig.ADMIN_EMAILS.includes(window.AppConfig.AppState.currentUserEmail);
}

// Check if user is blocked
function isUserBlocked(username) {
    return window.AppConfig && 
           window.AppConfig.AppState && 
           window.AppConfig.AppState.blockedUsers &&
           window.AppConfig.AppState.blockedUsers.includes(username);
}

// Export utilities
window.ChatUtils = {
    escapeHTML,
    getAvatarUrl,
    formatTime,
    formatDate,
    formatFileSize,
    formatDuration,
    generateId,
    debounce,
    playBeep,
    showNotification,
    requestNotificationPermission,
    parseMarkdown,
    renderMediaPreviews,
    isAdmin,
    isUserBlocked
};
