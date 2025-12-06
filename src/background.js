// ============================================================================
// Udemy Dual Subtitles - Background Script
// ============================================================================

// Translation Cache (LRU)
const CACHE_SIZE = 5000;
const translationCache = new Map();

// Pending translation promises to de-duplicate concurrent requests
const pendingTranslations = new Map();

// Subtitle File Cache (URL -> Map<Original, Translated>)
const subtitleCache = new Map();

/**
 * Translate a single text using Google Translate API
 * - Uses in-flight de-duplication via pendingTranslations
 * - Updates LRU cache on success
 */
async function translateText(text, targetLang = 'vi') {
  // 1) Cache hit: return immediately
  if (translationCache.has(text)) {
    return translationCache.get(text);
  }

  // 2) In-flight request exists: reuse it
  if (pendingTranslations.has(text)) {
    return pendingTranslations.get(text);
  }

  // 3) Create a new in-flight request
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  const promise = (async () => {
    try {
      const response = await fetch(url);
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Translation error: Failed to parse JSON. Google might be blocking the request.');
        return null; // Treat as a failed translation
      }
      if (data && data[0]) {
        const translatedText = data[0].map(item => item[0]).join('');

        // LRU: evict oldest if needed, then set
        if (translationCache.size >= CACHE_SIZE) {
          const firstKey = translationCache.keys().next().value;
          translationCache.delete(firstKey);
        }
        translationCache.set(text, translatedText);
        return translatedText;
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      // Remove from in-flight map regardless of success/failure
      pendingTranslations.delete(text);
    }
    return null;
  })();

  pendingTranslations.set(text, promise);
  return promise;
}

// ============================================================================
// VTT Parsing & Batch Processing
// ============================================================================

/**
 * Parse VTT content to extract unique text lines
 */
function parseVTT(vttContent) {
  const lines = vttContent.split(/\r?\n/);
  const uniqueTexts = new Set();

  let isText = false;
  for (const line of lines) {
    if (line.includes('-->')) {
      isText = true;
      continue;
    }
    if (line.trim() === '' || line.startsWith('WEBVTT') || line.match(/^\d+$/)) {
      isText = false;
      continue;
    }
    if (isText) {
      // Remove HTML tags if any
      const cleanText = line.replace(/<[^>]*>/g, '').trim();
      if (cleanText) uniqueTexts.add(cleanText);
    }
  }
  return Array.from(uniqueTexts);
}

/**
 * Process subtitle file: Parse -> Translate All -> Cache
 */
async function processSubtitleFile(url) {
  if (subtitleCache.has(url)) return; // Already processing/processed

  console.log('[Udemy Dual Subs] Intercepted subtitle file:', url);
  subtitleCache.set(url, true); // Mark as processing

  try {
    const response = await fetch(url);
    const text = await response.text();
    const uniqueLines = parseVTT(text);

    console.log(`[Udemy Dual Subs] Found ${uniqueLines.length} unique lines to translate.`);

    // Translate in chunks to avoid rate limits
    // We use a moderate concurrency to balance speed and safety
    const CHUNK_SIZE = 6;
    for (let i = 0; i < uniqueLines.length; i += CHUNK_SIZE) {
      const chunk = uniqueLines.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (line) => {
        // translateText handles caching internally
        await translateText(line);
      }));

      // Small delay to be nice to the API
      await new Promise(r => setTimeout(r, 50));
    }

    console.log('[Udemy Dual Subs] Full translation completed for:', url);

  } catch (e) {
    console.error('[Udemy Dual Subs] Failed to process subtitle file:', e);
    subtitleCache.delete(url);
  }
}

// ============================================================================
// Network Interception (Removed)
// ============================================================================
// NOTE: webRequest listener removed to comply with least privilege principle.
// Subtitle pre-translation now triggered via chrome.runtime.sendMessage from content.js
// when track URLs are detected via HTMLTrackElement.textTracks API.

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'preprocessVtt') {
    const urls = Array.isArray(request.urls) ? request.urls : [];
    urls.forEach((u) => {
      try {
        if (typeof u === 'string' && u) {
          processSubtitleFile(u);
        }
      } catch (e) {
        console.warn('[Udemy Dual Subs] Failed to preprocess URL:', u, e);
      }
    });
    sendResponse({ success: true, processed: urls.length });
    return; // sync response
  }

  if (request.action === 'translate') {
    const text = request.text;

    // 1. Check global cache first (fastest)
    if (translationCache.has(text)) {
      sendResponse({ success: true, translatedText: translationCache.get(text) });
      return true;
    }

    // 2. Fallback to on-demand translation (deduplicated)
    translateText(text).then(translatedText => {
      if (translatedText) {
        sendResponse({ success: true, translatedText });
      } else {
        sendResponse({ success: false, error: 'Translation failed' });
      }
    });

    return true; // Keep channel open for async response
  }
});