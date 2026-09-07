// Theme Management Module

(function() {
    'use strict';

    // Available themes
    const THEMES = ['dark', 'light', 'blue', 'green', 'purple'];
    let currentThemeIndex = 0;

    // Get current theme from localStorage
    function getCurrentTheme() {
        return localStorage.getItem('app_theme') || 'dark';
    }

    // Set theme
    function setTheme(theme) {
        if (!THEMES.includes(theme)) {
            console.warn(`Theme '${theme}' not found, using 'dark'`);
            theme = 'dark';
        }
        
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('app_theme', theme);
        
        // Update emoji picker theme
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker) {
            emojiPicker.className = theme === 'light' ? '' : 'dark';
        }
        
        // Update AppState
        if (AppConfig && AppConfig.AppState) {
            AppConfig.AppState.theme = theme;
        }
    }

    // Cycle through themes
    function cycleTheme() {
        const currentTheme = getCurrentTheme();
        const currentIndex = THEMES.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        setTheme(THEMES[nextIndex]);
    }

    // Initialize theme
    function initTheme() {
        const savedTheme = getCurrentTheme();
        setTheme(savedTheme);
    }

    // Wait for DOM to be ready
    function domReady() {
        return new Promise((resolve) => {
            if (document.readyState !== 'loading') {
                resolve();
            } else {
                document.addEventListener('DOMContentLoaded', resolve);
            }
        });
    }

    // Initialize when DOM is ready
    domReady().then(() => {
        initTheme();
        
        // Add event listener for theme toggle button
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                cycleTheme();
            });
        }
    });

    // Export functions
    window.ThemeManager = {
        setTheme,
        getCurrentTheme,
        cycleTheme,
        initTheme,
        THEMES
    };
})();
