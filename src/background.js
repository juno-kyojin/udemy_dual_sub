// ============================================================================
// Udemy Dual Subtitles - Background Script (v4 - Multi-Engine Translation)
// ============================================================================

// Translation Cache (LRU) - keyed by "text|targetLang"
const CACHE_SIZE = 10000;
const translationCache = new Map();

// Subtitle File Cache (URL -> boolean)
const processedVttFiles = new Set();

// Pre-translation stats
let pretransStats = { total: 0, cached: 0 };

// MyMemory API endpoint (free, no API key required)
const MYMEMORY_API = 'https://api.mymemory.translated.net/get';

/**
 * Creates a cache key combining text and target language.
 */
function getCacheKey(text, targetLang) {
    return `${text}|${targetLang}`;
}

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
 * Translates using MyMemory API (faster than Google for short texts)
 */
async function translateWithMyMemory(texts, targetLang = 'vi') {
    const combinedText = texts.join('\n');
    const langPair = `en|${targetLang}`;
    const url = `${MYMEMORY_API}?q=${encodeURIComponent(combinedText)}&langpair=${langPair}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.responseStatus === 200 && data.responseData) {
            const translatedText = data.responseData.translatedText;
            // MyMemory returns translations separated by newlines
            const translations = translatedText.split('\n');
            
            texts.forEach((originalText, index) => {
                if (translations[index]) {
                    const key = getCacheKey(originalText, targetLang);
                    updateCache(key, translations[index].trim());
                }
            });
            
            return translations.map(t => t.trim());
        } else {
            console.warn('[UDS] MyMemory API error:', data?.responseStatus, data?.responseDetails);
            return null; // Signal to try fallback
        }
    } catch (error) {
        console.error('[UDS] MyMemory translation error:', error);
        return null;
    }
}

/**
 * Translates using Google Translate API (fallback)
 */
async function translateWithGoogle(texts, targetLang = 'vi') {
    const combinedText = texts.join('\n');
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combinedText)}`;

    try {
        const response = await fetch(url);
        const responseText = await response.text();
        const data = JSON.parse(responseText);

        if (data && data[0]) {
            const translations = data[0];
            texts.forEach((originalText, index) => {
                const translatedText = translations[index]?.[0];
                if (originalText && translatedText) {
                    const key = getCacheKey(originalText, targetLang);
                    updateCache(key, translatedText);
                }
            });
            return texts.map((_, i) => translations[i]?.[0] || '');
        }
    } catch (error) {
        console.error('[UDS] Google translation error:', error);
    }
    return null;
}

/**
 * Main translation function - tries MyMemory first, falls back to Google
 */
async function translateBatch(texts, targetLang = 'vi') {
    const textsToTranslate = texts.filter(t => {
        const key = getCacheKey(t, targetLang);
        return t && t.trim() && !translationCache.has(key);
    });

    if (textsToTranslate.length === 0) {
        return texts.map(t => translationCache.get(getCacheKey(t, targetLang)) || '');
    }

    // Try MyMemory first (faster for real-time translation)
    let translations = await translateWithMyMemory(textsToTranslate, targetLang);

    // Fallback to Google if MyMemory fails
    if (translations === null) {
        console.log('[UDS] Falling back to Google Translate');
        translations = await translateWithGoogle(textsToTranslate, targetLang);
    }

    if (translations === null) {
        // Both APIs failed
        console.error('[UDS] All translation APIs failed');
        return texts.map(() => '');
    }

    return texts.map(t => translationCache.get(getCacheKey(t, targetLang)) || '');
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
        if (line.includes('-->') || line.trim() === '' || line.startsWith('WEBVTT') || line.match(/^\d+$/)) {
            continue;
        }
        const cleanText = line.replace(/<[^>]*>/g, '').trim();
        if (cleanText) {
            uniqueTexts.add(cleanText);
        }
    }
    return Array.from(uniqueTexts);
}

/**
 * Fetches a VTT file, parses it, and translates all lines in batches.
 * Returns the number of lines translated.
 */
async function processSubtitleFile(url, targetLang = 'vi') {
    const cacheKey = `${url}|${targetLang}`;
    if (processedVttFiles.has(cacheKey)) {
        return 0;
    }

    console.log(`[UDS] Pre-processing subtitle file: ${url}`);
    processedVttFiles.add(cacheKey);

    try {
        const response = await fetch(url);
        const vttContent = await response.text();
        const uniqueLines = parseVTT(vttContent);

        if (uniqueLines.length === 0) return 0;

        console.log(`[UDS] Found ${uniqueLines.length} unique lines to pre-translate.`);

        // MyMemory works better with smaller batches for pre-processing
        const CHUNK_SIZE = 30;
        for (let i = 0; i < uniqueLines.length; i += CHUNK_SIZE) {
            const chunk = uniqueLines.slice(i, i + CHUNK_SIZE);
            await translateBatch(chunk, targetLang);
        }

        console.log(`[UDS] Finished pre-translating for: ${url}`);
        return uniqueLines.length;

    } catch (e) {
        console.error(`[UDS] Failed to process subtitle file: ${url}`, e);
        processedVttFiles.delete(cacheKey);
        return 0;
    }
}

// Async wrapper for processSubtitleFile
async function processSubtitleFileAsync(url, targetLang) {
    return processSubtitleFile(url, targetLang);
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'preprocessVtt') {
        if (Array.isArray(request.urls)) {
            const targetLang = request.targetLang || 'vi';
            let processed = 0;
            const total = request.urls.length;
            
            request.urls.forEach(url => {
                if (typeof url === 'string' && url) {
                    const cacheKey = `${url}|${targetLang}`;
                    if (!processedVttFiles.has(cacheKey)) {
                        processedVttFiles.add(cacheKey);
                        processSubtitleFileAsync(url, targetLang).then(count => {
                            processed++;
                            pretransStats.cached += count;
                            if (processed === total) {
                                console.log(`[UDS] Pre-translation complete: ${pretransStats.cached} lines cached`);
                            }
                        });
                    }
                }
            });
            
            sendResponse({ success: true, total: total });
        }
        return;
    }
    
    if (request.action === 'preprocessTexts') {
        if (Array.isArray(request.texts)) {
            const targetLang = request.targetLang || 'vi';
            const textsToTranslate = request.texts.filter(t => {
                const key = getCacheKey(t, targetLang);
                return t && t.trim() && !translationCache.has(key);
            });
            
            if (textsToTranslate.length === 0) {
                console.log(`[UDS] All ${request.texts.length} texts already cached`);
                sendResponse({ success: true, cached: request.texts.length, translated: 0 });
                return;
            }
            
            console.log(`[UDS] Pre-translating ${textsToTranslate.length} texts...`);
            
            // Translate in chunks
            const CHUNK_SIZE = 30;
            const allTranslations = [];
            
            (async () => {
                for (let i = 0; i < textsToTranslate.length; i += CHUNK_SIZE) {
                    const chunk = textsToTranslate.slice(i, i + CHUNK_SIZE);
                    await translateBatch(chunk, targetLang);
                }
                
                const cached = request.texts.filter(t => {
                    const key = getCacheKey(t, targetLang);
                    return translationCache.has(key);
                }).length;
                
                console.log(`[UDS] Pre-translation complete: ${cached}/${request.texts.length} cached`);
                sendResponse({ success: true, cached, translated: textsToTranslate.length });
            })();
        }
        return true;
    }

    if (request.action === 'translateBatch') {
        const { texts, targetLang } = request;
        if (Array.isArray(texts)) {
            // Check cache first - return immediately if all found
            const cached = texts.map(t => {
                const key = getCacheKey(t, targetLang || 'vi');
                return translationCache.has(key) ? translationCache.get(key) : null;
            });

            const needsTranslation = texts.filter((t, i) => cached[i] === null);

            if (needsTranslation.length === 0) {
                sendResponse({ success: true, translations: cached });
            } else {
                // Translate ALL texts that need translation (not just first 10)
                translateBatch(needsTranslation, targetLang || 'vi').then(translations => {
                    // Merge cached and new translations
                    let translationIndex = 0;
                    const result = texts.map((t, i) => {
                        const key = getCacheKey(t, targetLang || 'vi');
                        if (cached[i] !== null) {
                            return cached[i];
                        }
                        return translations[translationIndex++] || '';
                    });
                    sendResponse({ success: true, translations: result });
                });
            }
        } else {
            sendResponse({ success: false, error: 'Invalid texts array' });
        }
        return true;
    }

    if (request.action === 'translate') {
        const text = request.text;
        const targetLang = request.targetLang || 'vi';
        const key = getCacheKey(text, targetLang);

        if (translationCache.has(key)) {
            sendResponse({ success: true, translatedText: translationCache.get(key) });
        } else {
            translateBatch([text], targetLang).then(translations => {
                sendResponse({ success: true, translatedText: translations[0] || '' });
            });
        }
        return true;
    }

    if (request.action === 'checkCache') {
        const { texts, targetLang } = request;
        if (Array.isArray(texts)) {
            const results = texts.map(t => {
                const key = getCacheKey(t, targetLang || 'vi');
                return translationCache.has(key) ? translationCache.get(key) : null;
            });
            const allCached = results.every(r => r !== null);
            sendResponse({ success: true, translations: results, allCached });
        } else {
            sendResponse({ success: false });
        }
        return true;
    }

    if (request.action === 'getCacheStats') {
        sendResponse({
            success: true,
            cacheSize: translationCache.size,
            processedVttFiles: processedVttFiles.size
        });
        return true;
    }
});