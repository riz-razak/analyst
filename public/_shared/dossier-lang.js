/**
 * dossier-lang.js
 * Language toggle module for bilingual dossier pages (EN/Sinhala)
 *
 * Features:
 * - Toggle between English (data-lang="en") and Sinhala (data-lang="si")
 * - Persists language preference to localStorage
 * - Updates button text and document language attribute
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'dossier-lang';
  const DEFAULT_LANG = 'en';

  /**
   * Initialize language module on DOM ready
   */
  function init() {
    const langToggle = document.getElementById('langToggle');

    if (!langToggle) {
      console.warn('dossier-lang.js: #langToggle button not found');
      return;
    }

    // Read saved language preference or use default
    const savedLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;

    // Apply saved language on page load
    applyLanguage(savedLang);

    // Attach click handler
    langToggle.addEventListener('click', toggleLanguage);
  }

  /**
   * Apply language to page
   * @param {string} lang - 'en' or 'si'
   */
  function applyLanguage(lang) {
    const body = document.body;
    const langToggle = document.getElementById('langToggle');

    if (lang === 'si') {
      // Show Sinhala, hide English
      body.classList.add('show-sinhala');
      document.documentElement.lang = 'si';

      // Update button: "EN | සිং" → "EN | <span class="lang-active">සිං</span>"
      if (langToggle) {
        langToggle.innerHTML = 'EN | <span class="lang-active">සිං</span>';
      }
    } else {
      // Show English (default), hide Sinhala
      body.classList.remove('show-sinhala');
      document.documentElement.lang = 'en';

      // Update button: "<span class="lang-active">EN</span> | සිං"
      if (langToggle) {
        langToggle.innerHTML = '<span class="lang-active">EN</span> | සිං';
      }
    }

    // Persist to localStorage
    localStorage.setItem(STORAGE_KEY, lang);
  }

  /**
   * Toggle between English and Sinhala
   */
  function toggleLanguage() {
    const currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    const newLang = currentLang === 'en' ? 'si' : 'en';

    applyLanguage(newLang);

    // Track analytics event
    if (window.gtag && typeof gtag === 'function') {
      gtag('event', 'language_toggle', {
        language: newLang,
        dossier_id: getDossierId()
      });
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

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
