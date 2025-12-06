// ============================================================================
// Udemy Dual Subtitles - Content Script (v3 - CueChange Primary)
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
let videoElement = null;
let activeTrack = null;
let mutationObserver = null; // Fallback observer

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

    // Force re-render with new styles if a subtitle is visible
    if (lastOriginalText) {
        processSubtitle(lastOriginalText, true); // Use force flag
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
// CORE LOGIC
// ============================================================================

async function processSubtitle(originalText, force = false) {
    const trimmedText = originalText ? originalText.trim() : '';
    // Guard against re-processing the same text, unless forced (e.g., by settings change)
    if (!trimmedText || (!force && trimmedText === lastOriginalText)) {
        return;
    }
    console.log(`[UDS] Processing cue: "${trimmedText.substring(0, 30)}..."`);
    lastOriginalText = trimmedText;

    if (!enabled) {
        renderSubtitles(trimmedText, null);
        return;
    }

    renderSubtitles(trimmedText, '...'); // Render original immediately

    try {
        const lines = trimmedText.split(/\r?\n+/).map(t => t.trim()).filter(Boolean);
        const translatedLines = await Promise.all(lines.map(translateText));
        const translatedCombined = translatedLines.join('\n');

        if (lastOriginalText === trimmedText) {
            console.log(`[UDS] Render dual for: "${trimmedText.substring(0, 30)}..."`);
            renderSubtitles(trimmedText, translatedCombined);
        }
    } catch (error) {
        console.error('[UDS] Translation failed:', error);
        renderSubtitles(trimmedText, null);
    }
}

// Main event handler for subtitle changes
function onCueChange() {
    // The most reliable source is the active cue from the text track.
    if (activeTrack && activeTrack.activeCues && activeTrack.activeCues.length > 0) {
        const originalText = activeTrack.activeCues[0].text;
        processSubtitle(originalText);
    } else {
        // Fallback for players that don't fire cuechange reliably.
        const nativeCue = getNativeCueElement();
        const originalText = nativeCue ? (nativeCue.textContent || nativeCue.innerText) : '';
        if (originalText) {
            processSubtitle(originalText);
        } else {
            clearOverlay();
        }
    }
}

// Handler for video seek events
function onVideoSeeked() {
    console.log('[UDS] Video seeked - clearing cached subtitle state');
    lastOriginalText = ''; // Clear cache to force re-translation
    onCueChange(); // Immediately process current subtitle
}

// ============================================================================
// INITIALIZATION & PAGE NAVIGATION
// ============================================================================

function setupListeners() {
    console.log('[UDS] Setting up listeners...');
    videoElement = document.querySelector('video');
    const nativeContainer = getNativeContainer();

    if (!videoElement || !nativeContainer) {
        setTimeout(setupListeners, 1000);
        return;
    }

    // --- Video Event: Handle seeking ---
    videoElement.addEventListener('seeked', onVideoSeeked);
    console.log('[UDS] Video seek listener attached.');

    // --- Primary Method: TextTrack `cuechange` event ---
    const tracks = videoElement.textTracks;
    const onTrackChange = () => {
        console.log('[UDS] Track changed.');
        if (activeTrack) activeTrack.removeEventListener('cuechange', onCueChange);
        activeTrack = Array.from(tracks).find(t => t.mode === 'showing');
        if (activeTrack) {
            console.log('[UDS] Attached to active text track.');
            activeTrack.addEventListener('cuechange', onCueChange);
            onCueChange(); // Initial trigger
        }
    };
    tracks.addEventListener('change', onTrackChange);
    onTrackChange(); // Initial setup

    // --- Fallback Method: MutationObserver ---
    if (mutationObserver) mutationObserver.disconnect();
    mutationObserver = new MutationObserver(onCueChange);
    mutationObserver.observe(nativeContainer, { childList: true, subtree: true });
    console.log('[UDS] Fallback observer attached.');
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
    if (activeTrack) activeTrack.removeEventListener('cuechange', onCueChange);
    if (videoElement) videoElement.removeEventListener('seeked', onVideoSeeked);
    clearOverlay();
    videoElement = null;
    activeTrack = null;
    overlayElement = null;
    mutationObserver = null;
    setTimeout(initialize, 1500);
}

function patchHistoryAPI() {
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        reset();
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
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