// ============================================================================
// Udemy Dual Subtitles - Content Script (v13 - Show Both Together)
// ============================================================================

// --- STATE ---
let enabled = true;
let targetLanguage = 'vi';
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

// Translation queue for batching
let translationQueue = [];
let translationDebounceTimer = null;
let isTranslating = false;
const DEBOUNCE_MS = 30;
const MUTATION_DEBOUNCE_MS = 30;

// Timeouts
const MESSAGE_TIMEOUT_MS = 3000;
const API_TIMEOUT_MS = 5000;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Wraps a promise with a timeout
 */
function withTimeout(promise, ms, errorMessage) {
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), ms)
    );
    return Promise.race([promise, timeout]);
}

/**
 * Safely sends a message to background script with timeout and error handling
 */
async function safeSendMessage(message, timeoutMs = MESSAGE_TIMEOUT_MS) {
    try {
        if (!chrome.runtime?.id) {
            throw new Error('Extension context invalidated');
        }
        return await withTimeout(
            chrome.runtime.sendMessage(message),
            timeoutMs,
            'Message timeout'
        );
    } catch (error) {
        if (error.message.includes('Extension context invalidated') || 
            error.message.includes('Could not establish connection')) {
            console.warn('[UDS] Extension reloaded, reinitializing...');
            reset();
            return null;
        }
        console.error('[UDS] Message failed:', error.message);
        return null;
    }
}

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

function applySettings(result) {
    enabled = result.enabled !== undefined ? result.enabled : enabled;
    targetLanguage = result.targetLanguage || targetLanguage;
    settings.fontSize = result.fontSize || settings.fontSize;
    settings.fontColor = result.fontColor || settings.fontColor;
    settings.fontWeight = result.fontWeight || settings.fontWeight;
    settings.opacity = result.opacity !== undefined ? result.opacity : settings.opacity;
    settings.bgColor = result.bgColor || settings.bgColor;
    console.log('[UDS] Settings updated, targetLanguage:', targetLanguage);

    if (lastOriginalText) {
        processSubtitle(lastOriginalText, true);
    }
}

function loadSettings() {
    chrome.storage.local.get(['enabled', 'targetLanguage', ...Object.keys(settings)], (result) => {
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
// TRANSLATION (Queue-based batching)
// ============================================================================

async function translateQueue() {
    if (isTranslating || translationQueue.length === 0) return;
    
    isTranslating = true;
    const currentQueue = [...translationQueue];
    translationQueue = [];
    
    const textsToTranslate = currentQueue
        .map(item => item.text)
        .filter(t => t && t.trim());
    
    if (textsToTranslate.length === 0) {
        isTranslating = false;
        return;
    }

    try {
        const response = await safeSendMessage({
            action: 'translateBatch',
            texts: textsToTranslate,
            targetLang: targetLanguage
        });

        if (response && response.success && response.translations) {
            currentQueue.forEach((item, index) => {
                if (response.translations[index]) {
                    item.resolve(response.translations[index]);
                } else {
                    item.resolve('');
                }
            });
        } else {
            currentQueue.forEach(item => item.resolve(''));
        }
    } catch (error) {
        console.error('[UDS] Batch translation error:', error);
        currentQueue.forEach(item => item.resolve(''));
    }

    isTranslating = false;
    
    if (translationQueue.length > 0) {
        translationDebounceTimer = setTimeout(translateQueue, 50);
    }
}

function queueTranslation(text) {
    return new Promise((resolve) => {
        translationQueue.push({ text, resolve });
        
        if (!isTranslating) {
            clearTimeout(translationDebounceTimer);
            if (translationQueue.length === 1) {
                translateQueue();
            } else {
                translationDebounceTimer = setTimeout(translateQueue, DEBOUNCE_MS);
            }
        }
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
    const container = document.querySelector('.well--container--afdWD, .captions-display--captions-container--1bCR_, [data-purpose*="captions-container"]');
    return container;
}

function getNativeCueElement() {
    const cue = document.querySelector('[data-purpose="captions-cue-text"], [class^="well--text--"]');
    return cue;
}

function createOverlay() {
    let overlay = document.getElementById('uds-overlay');
    if (overlay) return overlay;

    const nativeContainer = getNativeContainer();
    if (!nativeContainer) {
        return null;
    }

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

function renderSubtitles(original, translated, isLoading = false) {
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
    const translatedHtml = (translated && !isLoading) 
        ? `<div style="${translationStyles}">${escapeHtml(translated).replace(/\r?\n/g, '<br/>')}</div>` 
        : '';

    const finalHtml = `<div style="font-size: ${originalFontSize}; color: white; background-color: rgba(0, 0, 0, 0.75); padding: 4px 8px; border-radius: 3px; line-height: 1.4;">${originalHtml}</div>${translatedHtml}`;

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
    
    const startTime = performance.now();
    lastOriginalText = trimmedText;

    if (!enabled) {
        renderSubtitles(trimmedText, '');
        return;
    }

    const lines = trimmedText.split(/\r?\n+/).map(t => t.trim()).filter(Boolean);

    try {
        // Check cache first with timeout
        const cacheResponse = await safeSendMessage({
            action: 'checkCache',
            texts: lines,
            targetLang: targetLanguage
        }, MESSAGE_TIMEOUT_MS);

        // If extension was reloaded/reset, abort
        if (!overlayElement) return;

        if (cacheResponse && cacheResponse.success && cacheResponse.allCached) {
            // All cached - show immediately!
            const translatedCombined = cacheResponse.translations.join('\n');
            renderSubtitles(trimmedText, translatedCombined);
            console.log(`[UDS] Cached - instant display`);
            return;
        }

        // Not all cached - translate and show both together
        const translatedLines = await Promise.all(lines.map(line => queueTranslation(line)));
        
        // Check if still valid after async operations
        if (!overlayElement || lastOriginalText !== trimmedText) return;
        
        const translatedCombined = translatedLines.join('\n');
        
        // Show both original + translation together
        renderSubtitles(trimmedText, translatedCombined);
        const translationTime = performance.now() - startTime;
        console.log(`[UDS] Translation complete in ${translationTime.toFixed(0)}ms - showing both`);
    } catch (error) {
        console.error('[UDS] Translation failed:', error);
        // Fallback: show original only (in case of timeout or error)
        if (overlayElement && lastOriginalText === trimmedText) {
            renderSubtitles(trimmedText, '');
        }
    }
}

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
    lastOriginalText = '';
    translationQueue = [];
    handleSubtitleChange();
}

// ============================================================================
// INITIALIZATION & PAGE NAVIGATION
// ============================================================================

function setupListeners() {
    const nativeContainer = getNativeContainer();
    videoElement = document.querySelector('video');

    if (!nativeContainer || !videoElement) {
        setTimeout(setupListeners, 1000);
        return;
    }

    mutationObserver = new MutationObserver(() => {
        clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = setTimeout(handleSubtitleChange, MUTATION_DEBOUNCE_MS);
    });
    mutationObserver.observe(nativeContainer, {
        childList: true,
        subtree: true,
        characterData: true
    });

    seekHandler = onVideoSeeked;
    videoElement.addEventListener('seeked', seekHandler);
}

function initialize() {
    overlayElement = createOverlay();
    if (!overlayElement) {
        setTimeout(initialize, 1000);
        return;
    }
    setupListeners();
    // Try to extract transcript texts for pre-translation
    setTimeout(preprocessTranscript, 2000);
}

function reset() {
    console.log('[UDS] Resetting state...');
    
    // Clear all timers
    if (mutationDebounceTimer) {
        clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = null;
    }
    if (translationDebounceTimer) {
        clearTimeout(translationDebounceTimer);
        translationDebounceTimer = null;
    }
    
    // Disconnect observer
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
    
    // Remove event listeners
    if (videoElement && seekHandler) {
        videoElement.removeEventListener('seeked', seekHandler);
    }
    
    // Clear pending translations
    translationQueue = [];
    isTranslating = false;
    
    // Clear UI
    clearOverlay();
    
    // Reset state
    overlayElement = null;
    videoElement = null;
    seekHandler = null;
    lastOriginalText = '';
    
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

// ============================================================================
// TRANSCRIPT PRE-TRANSLATION
// ============================================================================

async function preprocessTranscript() {
    console.log('[UDS] Looking for transcript panel...');
    
    // Check if transcript panel is open or can be opened
    const transcriptTexts = extractTranscriptTexts();
    
    if (transcriptTexts.length === 0) {
        console.log('[UDS] No transcript texts found. Open transcript panel to pre-translate all subtitles.');
        return;
    }
    
    console.log(`[UDS] Found ${transcriptTexts.length} transcript texts to pre-translate`);
    
    // Send to background for pre-translation
    try {
        const response = await safeSendMessage({
            action: 'preprocessTexts',
            texts: transcriptTexts,
            targetLang: targetLanguage
        }, MESSAGE_TIMEOUT_MS * 2); // Longer timeout for batch processing
        
        if (response && response.success) {
            console.log(`[UDS] Pre-translation complete: ${response.cached}/${transcriptTexts.length} texts cached`);
        }
    } catch (error) {
        console.warn('[UDS] Pre-translation failed:', error.message);
        // Non-critical, continue without pre-translation
    }
}

function extractTranscriptTexts() {
    const texts = [];
    
    // Try various selectors for transcript cues
    const selectors = [
        '[data-purpose="transcript-cue-text"]',
        '[class*="transcript-cue"]',
        '[class*="cue-text"]',
        '.transcript--text',
        // Transcript panel is usually in sidebar
        '[data-purpose="sidebar-content"] [class*="cue"]',
        '[class*="transcript-panel"] [class*="cue"]',
    ];
    
    selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 2 && text.length < 500 && !texts.includes(text)) {
                texts.push(text);
            }
        });
    });
    
    // Also look for elements with timestamp + text pattern
    document.querySelectorAll('div, span, p').forEach(el => {
        const text = el.textContent?.trim() || '';
        // Match patterns like "0:00 Text here" or "00:00 Text here"
        if (/^\d{1,2}:\d{2}/.test(text)) {
            const cleanText = text.replace(/^\d{1,2}:\d{2}\s*/, '').trim();
            if (cleanText && cleanText.length > 2 && cleanText.length < 300 && !texts.includes(cleanText)) {
                texts.push(cleanText);
            }
        }
    });
    
    return texts;
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
