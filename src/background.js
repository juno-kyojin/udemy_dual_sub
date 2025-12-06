// ============================================================================
// Udemy Dual Subtitles - Background Script (v2 - Batching)
// ============================================================================

// Translation Cache (LRU)
const CACHE_SIZE = 10000; // Increased cache size
const translationCache = new Map();

// Subtitle File Cache (URL -> boolean)
const processedVttFiles = new Set();

/**
 * Manages the LRU cache. If the cache is full, it removes the oldest entry.
 */
function updateCache(key, value) {
    if (translationCache.size >= CACHE_SIZE) {
        const oldestKey = translationCache.keys().next().value;
        translationCache.delete(oldestKey);
    }
    translationCache.set(key, value);
}

/**
 * Translates a batch of texts using a single API call.
 * This is much more efficient than sending one request per line.
 */
async function translateBatch(texts, targetLang = 'vi') {
    const textsToTranslate = texts.filter(t => t && !translationCache.has(t));
    if (textsToTranslate.length === 0) {
        return;
    }

    // The API is unofficial and works best with text joined by newlines.
    const combinedText = textsToTranslate.join('\n');
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`;

    try {
        const response = await fetch(url);
        const responseText = await response.text();
        const data = JSON.parse(responseText);

        if (data && data[0]) {
            const translations = data[0];
            translations.forEach((item, index) => {
                const originalText = textsToTranslate[index];
                const translatedText = item[0];
                if (originalText && translatedText) {
                    updateCache(originalText, translatedText);
                }
            });
        } else {
            throw new Error('Invalid translation response format');
        }
    } catch (error) {
        console.error('Batch translation error:', error);
    }
}


// ============================================================================
// VTT Parsing & Batch Processing
// ============================================================================

/**
 * Parse VTT content to extract unique, non-empty text lines.
 */
function parseVTT(vttContent) {
    const lines = vttContent.split(/\r?\n/);
    const uniqueTexts = new Set();

    for (const line of lines) {
        // Ignore timestamps, metadata, and empty lines
        if (line.includes('-->') || line.trim() === '' || line.startsWith('WEBVTT') || line.match(/^\d+$/)) {
            continue;
        }
        // Clean up HTML tags and add to the set
        const cleanText = line.replace(/<[^>]*>/g, '').trim();
        if (cleanText) {
            uniqueTexts.add(cleanText);
        }
    }
    return Array.from(uniqueTexts);
}

/**
 * Fetches a VTT file, parses it, and translates all lines in batches.
 */
async function processSubtitleFile(url) {
    if (processedVttFiles.has(url)) {
        return; // Already processed
    }

    console.log(`[UDS] Pre-processing subtitle file: ${url}`);
    processedVttFiles.add(url); // Mark as processed to avoid re-fetching

    try {
        const response = await fetch(url);
        const vttContent = await response.text();
        const uniqueLines = parseVTT(vttContent);

        if (uniqueLines.length === 0) return;

        console.log(`[UDS] Found ${uniqueLines.length} unique lines to pre-translate.`);

        // Translate in chunks to be safe with API limits
        const CHUNK_SIZE = 50; // A larger, more efficient chunk size
        for (let i = 0; i < uniqueLines.length; i += CHUNK_SIZE) {
            const chunk = uniqueLines.slice(i, i + CHUNK_SIZE);
            await translateBatch(chunk);
            // Optional: add a small delay between chunks if hitting rate limits
            // await new Promise(r => setTimeout(r, 100));
        }

        console.log(`[UDS] Finished pre-translating for: ${url}`);

    } catch (e) {
        console.error(`[UDS] Failed to process subtitle file: ${url}`, e);
        processedVttFiles.delete(url); // Allow retrying if it failed
    }
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'preprocessVtt') {
        if (Array.isArray(request.urls)) {
            request.urls.forEach(url => {
                if (typeof url === 'string' && url) {
                    processSubtitleFile(url);
                }
            });
        }
        // No response needed, this is a fire-and-forget task.
        return;
    }

    if (request.action === 'translate') {
        const text = request.text;
        if (translationCache.has(text)) {
            sendResponse({ success: true, translatedText: translationCache.get(text) });
        } else {
            // If not in cache, it means pre-translation might still be running or failed.
            // We do a quick on-demand translation as a fallback.
            translateBatch([text]).then(() => {
                if (translationCache.has(text)) {
                    sendResponse({ success: true, translatedText: translationCache.get(text) });
                } else {
                    sendResponse({ success: false, error: 'On-demand translation failed.' });
                }
            });
        }
        return true; // Keep channel open for async response
    }
});