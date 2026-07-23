/**
 * dossier-lang.js
 * Language toggle module for dossier pages (EN/Sinhala, optional Tamil)
 *
 * Features:
 * - Toggle between configured language options using data-lang attributes
 * - Persists language preference to localStorage
 * - Updates button text and document language attribute
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'dossier-lang';
  const DEFAULT_LANG = 'en';
  const SUPPORTED_LANGS = ['en', 'si', 'ta'];
  const LANG_LABELS = {
    en: 'EN',
    si: 'සිං',
    ta: 'தமிழ்'
  };
  const LANG_CLASSES = {
    si: 'show-sinhala',
    ta: 'show-tamil'
  };

  /**
   * Initialize language module on DOM ready
   */
  function init() {
    const langToggle = document.getElementById('langToggle');

    if (!langToggle) {
      console.warn('dossier-lang.js: #langToggle button not found');
      return;
    }

    const options = getLanguageOptions(langToggle);
    const savedLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    const initialLang = options.includes(savedLang) ? savedLang : DEFAULT_LANG;

    // Apply saved language on page load
    applyLanguage(initialLang, options);

    // Attach click handler
    langToggle.addEventListener('click', function() {
      toggleLanguage(options);
    });
  }

  /**
   * Read configured page language options. Defaults to EN/Sinhala for legacy pages.
   * @param {HTMLElement} langToggle
   * @returns {string[]}
   */
  function getLanguageOptions(langToggle) {
    const configured = (langToggle.getAttribute('data-lang-options') || 'en,si')
      .split(',')
      .map(function(lang) { return lang.trim(); })
      .filter(function(lang) { return SUPPORTED_LANGS.includes(lang); });

    if (!configured.includes(DEFAULT_LANG)) {
      configured.unshift(DEFAULT_LANG);
    }

    return Array.from(new Set(configured));
  }

  /**
   * Apply language to page
   * @param {string} lang - configured language key
   * @param {string[]} options - available page languages
   */
  function applyLanguage(lang, options) {
    const body = document.body;
    const langToggle = document.getElementById('langToggle');
    const nextLang = options.includes(lang) ? lang : DEFAULT_LANG;

    Object.keys(LANG_CLASSES).forEach(function(key) {
      body.classList.remove(LANG_CLASSES[key]);
    });

    if (LANG_CLASSES[nextLang]) {
      body.classList.add(LANG_CLASSES[nextLang]);
    }

    document.documentElement.lang = nextLang;

    if (langToggle) {
      langToggle.innerHTML = options.map(function(option) {
        const label = LANG_LABELS[option] || option.toUpperCase();
        return option === nextLang ? '<span class="lang-active">' + label + '</span>' : label;
      }).join(' | ');
      langToggle.setAttribute('aria-label', 'Switch language. Current language: ' + nextLang);
    }

    // Persist to localStorage
    localStorage.setItem(STORAGE_KEY, nextLang);
  }

  /**
   * Cycle through configured languages
   * @param {string[]} options - available page languages
   */
  function toggleLanguage(options) {
    const currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    const currentIndex = options.includes(currentLang) ? options.indexOf(currentLang) : 0;
    const newLang = options[(currentIndex + 1) % options.length];

    applyLanguage(newLang, options);

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
