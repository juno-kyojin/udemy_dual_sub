// ============================================================================
// Udemy Dual Subtitles - Content Script (v9 - Final Observer)
// ============================================================================

// --- STATE ---
let enabled = true;
let settings = {
    fontSize: 16,
    fontColor: '#FFFFFF',
    fontWeight: 'normal',
    opacity: 100,
    bgColor: 'rgba(0, 0, 0, 0.75)'
};
let lastOriginalText = '';
let overlayElement = null;
let mutationObserver = null;
let mutationDebounceTimer = null;
let videoElement = null;
let seekHandler = null;

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

function applySettings(result) {
    enabled = result.enabled !== undefined ? result.enabled : enabled;
    settings.fontSize = result.fontSize || settings.fontSize;
    settings.fontColor = result.fontColor || settings.fontColor;
    settings.fontWeight = result.fontWeight || settings.fontWeight;
    settings.opacity = result.opacity !== undefined ? result.opacity : settings.opacity;
    settings.bgColor = result.bgColor || settings.bgColor;
    console.log('[UDS] Settings updated');

    if (lastOriginalText) {
        processSubtitle(lastOriginalText, true); // Force re-render
    }
}

function loadSettings() {
    chrome.storage.local.get(Object.keys(settings), (result) => {
        console.log('[UDS] Initial settings loaded');
        applySettings(result);
    });
    chrome.storage.onChanged.addListener((changes) => {
        const newSettings = {};
        for (let key in changes) {
            newSettings[key] = changes[key].newValue;
        }
        applySettings({ ...settings, ...newSettings });
    });
}

// ============================================================================
// TRANSLATION
// ============================================================================

async function translateText(text) {
    if (!text) return '';
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'translate', text }, (response) => {
            if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
            }
            if (response && response.success) {
                resolve(response.translatedText);
            } else {
                reject(new Error(response?.error || 'Translation failed'));
            }
        });
    });
}

// ============================================================================
// DOM & OVERLAY MANAGEMENT
// ============================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getNativeContainer() {
    return document.querySelector('.well--container--afdWD, .captions-display--captions-container--1bCR_, [data-purpose*="captions-container"]');
}

function getNativeCueElement() {
    return document.querySelector('[data-purpose="captions-cue-text"], [class^="well--text--"]');
}

function createOverlay() {
    let overlay = document.getElementById('uds-overlay');
    if (overlay) return overlay;

    const nativeContainer = getNativeContainer();
    if (!nativeContainer) return null;

    overlay = document.createElement('div');
    overlay.id = 'uds-overlay';
    overlay.style.cssText = `
        position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
        width: 100%; z-index: 999; pointer-events: none; text-align: center;
        padding: 8px; box-sizing: border-box; display: flex; flex-direction: column;
        align-items: center; justify-content: flex-end;
    `;
    nativeContainer.style.position = 'relative';
    nativeContainer.appendChild(overlay);
    return overlay;
}

function renderSubtitles(original, translated) {
    if (!overlayElement) return;

    const nativeCue = getNativeCueElement();
    if (nativeCue) {
        nativeCue.style.color = 'transparent';
        nativeCue.style.background = 'none';
    }

    const originalFontSize = nativeCue ? window.getComputedStyle(nativeCue).fontSize : '20px';

    const translationStyles = `
        color: ${settings.fontColor}; font-weight: ${settings.fontWeight};
        font-size: ${settings.fontSize}px; opacity: ${settings.opacity / 100};
        background-color: ${settings.bgColor}; padding: 4px 8px;
        border-radius: 3px; line-height: 1.4; margin-top: 4px;
    `.trim();

    const originalHtml = escapeHtml(original).replace(/\r?\n/g, '<br/>');
    const translatedHtml = translated ? escapeHtml(translated).replace(/\r?\n/g, '<br/>') : '';

    let finalHtml = `<div style="font-size: ${originalFontSize}; color: white; background-color: rgba(0, 0, 0, 0.75); padding: 4px 8px; border-radius: 3px; line-height: 1.4;">${originalHtml}</div>`;
    if (translatedHtml) {
        finalHtml += `<div style="${translationStyles}">${translatedHtml}</div>`;
    }

    overlayElement.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">${finalHtml}</div>`;
}

function clearOverlay() {
    if (overlayElement) overlayElement.innerHTML = '';
    const nativeCue = getNativeCueElement();
    if (nativeCue) {
        nativeCue.style.color = '';
        nativeCue.style.background = '';
    }
    lastOriginalText = '';
}

// ============================================================================
// CORE LOGIC & EVENT HANDLERS
// ============================================================================

async function processSubtitle(originalText, force = false) {
    const trimmedText = originalText ? originalText.trim() : '';
    if (!trimmedText || (!force && trimmedText === lastOriginalText)) {
        return;
    }
    console.log(`[UDS] Processing cue: "${trimmedText.substring(0, 30)}..."`);
    lastOriginalText = trimmedText;

    if (!enabled) {
        renderSubtitles(trimmedText, null);
        return;
    }

    renderSubtitles(trimmedText, '...');

    try {
        const lines = trimmedText.split(/\r?\n+/).map(t => t.trim()).filter(Boolean);
        const translatedLines = await Promise.all(lines.map(translateText));
        const translatedCombined = translatedLines.join('\n');

        if (lastOriginalText === trimmedText) {
            renderSubtitles(trimmedText, translatedCombined);
        }
    } catch (error) {
        console.error('[UDS] Translation failed:', error);
        renderSubtitles(trimmedText, null);
    }
}

// This is the single handler for all subtitle changes.
function handleSubtitleChange() {
    const nativeCue = getNativeCueElement();
    const originalText = nativeCue ? (nativeCue.textContent || nativeCue.innerText) : '';

    if (originalText) {
        processSubtitle(originalText);
    } else {
        clearOverlay();
    }
}

function onVideoSeeked() {
    console.log('[UDS] Video seeked. Clearing last text.');
    lastOriginalText = '';
    handleSubtitleChange();
}

// ============================================================================
// INITIALIZATION & PAGE NAVIGATION
// ============================================================================

function setupListeners() {
    console.log('[UDS] Setting up listeners...');
    const nativeContainer = getNativeContainer();
    videoElement = document.querySelector('video');

    if (!nativeContainer || !videoElement) {
        setTimeout(setupListeners, 1000);
        return;
    }

    // --- Main Method: MutationObserver ---
    // We observe the container for any changes to its children or their text content.
    mutationObserver = new MutationObserver(() => {
        clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = setTimeout(handleSubtitleChange, 50);
    });
    mutationObserver.observe(nativeContainer, {
        childList: true,
        subtree: true,
        characterData: true // This is the key to detecting text changes
    });
    console.log('[UDS] Observer attached.');

    // --- Video seek event ---
    seekHandler = onVideoSeeked;
    videoElement.addEventListener('seeked', seekHandler);
    console.log('[UDS] Seek listener attached.');
}

function initialize() {
    console.log('[UDS] Initializing...');
    overlayElement = createOverlay();
    if (!overlayElement) {
        setTimeout(initialize, 1000);
        return;
    }
    setupListeners();
    preprocessSubtitleTracks();
}

function reset() {
    console.log('[UDS] Resetting for new page...');
    if (mutationObserver) mutationObserver.disconnect();
    if (videoElement && seekHandler) {
        videoElement.removeEventListener('seeked', seekHandler);
    }
    clearOverlay();
    overlayElement = null;
    mutationObserver = null;
    videoElement = null;
    seekHandler = null;
    setTimeout(initialize, 1500);
}

function patchHistoryAPI() {
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        reset();
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        reset();
    };
    window.addEventListener('popstate', reset);
}

function preprocessSubtitleTracks() {
    const urls = Array.from(document.querySelectorAll('track[src]'))
        .map(t => new URL(t.src, location.href).href)
        .filter(u => u.includes('.vtt') || u.includes('caption'));
    if (urls.length > 0) {
        chrome.runtime.sendMessage({ action: 'preprocessVtt', urls });
    }
}

// --- SCRIPT START ---
loadSettings();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
patchHistoryAPI();
console.log('[UDS] Content script initialized.');