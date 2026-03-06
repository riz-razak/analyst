/**
 * dossier-theme.js
 * Dark mode toggle module for dossier pages
 *
 * Features:
 * - Toggle between light and dark themes
 * - Persists preference to localStorage
 * - Respects system preference (prefers-color-scheme) as fallback
 * - Shows moon/sun icons in toggle button
 * - Smooth transitions on theme change
 * - Communicates theme to parent frame via postMessage
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'dossier-theme';
  const HTML_ATTR = 'data-theme';

  const ICONS = {
    light: '☀',  // Sun icon for light mode (click to switch to dark)
    dark: '☾'    // Moon icon for dark mode (click to switch to light)
  };

  /**
   * Initialize theme module on DOM ready
   */
  function init() {
    const themeToggle = document.getElementById('themeToggle');

    if (!themeToggle) {
      console.warn('dossier-theme.js: #themeToggle button not found');
      return;
    }

    // Determine initial theme
    const initialTheme = getInitialTheme();

    // Apply theme
    applyTheme(initialTheme);

    // Attach click handler
    themeToggle.addEventListener('click', toggleTheme);
  }

  /**
   * Determine initial theme from localStorage or system preference
   * @returns {string} 'light' or 'dark'
   */
  function getInitialTheme() {
    // Check localStorage first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }

    // Fall back to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  /**
   * Apply theme to page
   * @param {string} theme - 'light' or 'dark'
   */
  function applyTheme(theme) {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');

    // Add transition class for smooth animation
    html.classList.add('theme-transition');

    // Set theme attribute
    html.setAttribute(HTML_ATTR, theme);

    // Update button icon
    if (themeToggle) {
      themeToggle.textContent = theme === 'light' ? ICONS.light : ICONS.dark;
      themeToggle.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
    }

    // Persist to localStorage
    localStorage.setItem(STORAGE_KEY, theme);

    // Remove transition class after animation
    setTimeout(() => {
      html.classList.remove('theme-transition');
    }, 300);

    // Notify parent frame
    notifyParentFrame(theme);
  }

  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute(HTML_ATTR) || 'light';
    const newTheme = current === 'light' ? 'dark' : 'light';

    applyTheme(newTheme);

    // Track analytics event
    if (window.gtag && typeof gtag === 'function') {
      gtag('event', 'theme_toggle', {
        theme: newTheme,
        dossier_id: getDossierId()
      });
    }
  }

  /**
   * Send theme update to parent frame (for React shell awareness)
   * @param {string} theme - Current theme
   */
  function notifyParentFrame(theme) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'dossier:theme-changed',
            theme: theme,
            timestamp: Date.now()
          },
          '*'
        );
      }
    } catch (error) {
      // Silently fail in iframe context restrictions
    }
  }

  /**
   * Get dossier ID from meta tag
   * @returns {string} Dossier ID or empty string
   */
  function getDossierId() {
    const meta = document.querySelector('meta[name="dossier-id"]');
    return meta ? meta.getAttribute('content') : '';
  }

  /**
   * Listen for theme changes from parent frame (optional, for sync)
   */
  function setupParentSync() {
    window.addEventListener('message', (event) => {
      // Only trust messages from parent
      if (event.source !== window.parent) return;

      if (event.data && event.data.type === 'parent:set-theme') {
        const theme = event.data.theme;
        if (theme === 'light' || theme === 'dark') {
          applyTheme(theme);
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Set up parent frame sync listener
  setupParentSync();

})();
