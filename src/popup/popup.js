// ============================================================================
// Udemy Dual Subtitles - Popup Script
// ============================================================================
// Purpose: Handle settings UI interactions
// ============================================================================

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {

    // ============================================================================
    // Helper Functions (Define first for hoisting)
    // ============================================================================

    /**
     * Set active state on button group
     */
    function setActiveButton(buttons, value) {
        buttons.forEach(btn => {
            if (btn.getAttribute('data-value') === value) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // DOM Elements - FIXED: Match actual HTML IDs
    const enabledToggle = document.getElementById('toggleExtension');
    const fontColorInput = document.getElementById('fontColor');
    const fontSizeSlider = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const opacitySlider = document.getElementById('opacity');
    const opacityValue = document.getElementById('opacityValue');
    const bgColorInput = document.getElementById('bgColor');
    const fontWeightButtons = document.querySelectorAll('#fontWeightGroup button[data-value]');

    // Tab switching
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active from all tabs
            tabLinks.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active to clicked tab
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // ============================================================================
    // Load Settings
    // ============================================================================

    chrome.storage.local.get(
        ['enabled', 'fontSize', 'fontColor', 'fontWeight', 'opacity', 'bgColor', 'targetLanguage'],
        (result) => {
            // Enable toggle
            if (enabledToggle) {
                enabledToggle.checked = result.enabled !== false;
            }

            // Font color
            if (fontColorInput) {
                fontColorInput.value = result.fontColor || '#FFEB3B';
            }

            // Font size
            const fontSize = result.fontSize || 20;
            if (fontSizeSlider) {
                fontSizeSlider.value = fontSize;
            }
            if (fontSizeValue) {
                fontSizeValue.textContent = fontSize;
            }

            // Font weight - FIXED: Use string values from HTML
            const fontWeight = result.fontWeight || '700';
            setActiveButton(fontWeightButtons, fontWeight);

            // Opacity
            const opacity = result.opacity !== undefined ? result.opacity : 100;
            if (opacitySlider) {
                opacitySlider.value = opacity;
            }
            if (opacityValue) {
                opacityValue.textContent = opacity;
            }

            // Background color
            if (bgColorInput) {
                bgColorInput.value = result.bgColor || '#000000';
            }

            // Target language
            const targetLanguageSelect = document.getElementById('targetLanguage');
            if (targetLanguageSelect) {
                targetLanguageSelect.value = result.targetLanguage || 'vi';
            }
        }
    );

    // ============================================================================
    // Event Listeners
    // ============================================================================

    // Enable/Disable toggle
    if (enabledToggle) {
        enabledToggle.addEventListener('change', () => {
            chrome.storage.local.set({ enabled: enabledToggle.checked });
        });
    }

    // Font color
    if (fontColorInput) {
        fontColorInput.addEventListener('input', () => {
            chrome.storage.local.set({ fontColor: fontColorInput.value });
        });
    }

    // Font size
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', () => {
            const value = parseInt(fontSizeSlider.value);
            if (fontSizeValue) {
                fontSizeValue.textContent = value;
            }
            chrome.storage.local.set({ fontSize: value });
        });
    }

    // Font weight buttons
    fontWeightButtons.forEach(button => {
        button.addEventListener('click', () => {
            const weight = button.getAttribute('data-value');
            setActiveButton(fontWeightButtons, weight);
            chrome.storage.local.set({ fontWeight: weight });
        });
    });

    // Opacity
    if (opacitySlider) {
        opacitySlider.addEventListener('input', () => {
            const value = parseInt(opacitySlider.value);
            if (opacityValue) {
                opacityValue.textContent = value;
            }
            chrome.storage.local.set({ opacity: value });
        });
    }

    // Background color
    if (bgColorInput) {
        bgColorInput.addEventListener('input', () => {
            chrome.storage.local.set({ bgColor: bgColorInput.value });
        });
    }

    // Target language
    const targetLanguageSelect = document.getElementById('targetLanguage');
    if (targetLanguageSelect) {
        targetLanguageSelect.addEventListener('change', () => {
            chrome.storage.local.set({ targetLanguage: targetLanguageSelect.value });
        });
    }

    console.log('[Udemy Dual Subs] Popup initialized');
});