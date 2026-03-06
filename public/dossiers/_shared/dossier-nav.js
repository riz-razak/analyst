/**
 * dossier-nav.js
 * Section navigation module for dossier pages
 *
 * Features:
 * - Auto-generates nav links from <section data-nav-label="..."> elements
 * - Highlights active section as user scrolls
 * - Smooth scroll with offset for sticky header
 * - Mobile support: auto-scrolls nav bar to keep active link visible
 * - Hash support: scrolls to section on page load if hash present
 */

(function() {
  'use strict';

  const NAV_CONTAINER_ID = 'sectionNav';
  const ACTIVE_CLASS = 'active';

  let currentActiveSection = null;
  let intersectionObserver = null;

  /**
   * Initialize navigation module on DOM ready
   */
  function init() {
    const navContainer = document.getElementById(NAV_CONTAINER_ID);

    if (!navContainer) {
      console.warn('dossier-nav.js: #sectionNav container not found');
      return;
    }

    // Build nav from sections
    buildNavigation(navContainer);

    // Set up intersection observer for scroll tracking
    setupIntersectionObserver();

    // Handle hash on page load
    handleHashNavigation();

    // Debounced scroll handler for mobile nav alignment
    setupMobileNavScroll();
  }

  /**
   * Build navigation links from section elements
   * @param {HTMLElement} container - Navigation container
   */
  function buildNavigation(container) {
    const sections = document.querySelectorAll('section[data-nav-label]');

    if (sections.length === 0) {
      console.warn('dossier-nav.js: No sections with data-nav-label found');
      return;
    }

    const fragment = document.createDocumentFragment();

    sections.forEach((section, index) => {
      // Ensure section has an ID
      if (!section.id) {
        section.id = `section-${index}`;
      }

      const label = section.getAttribute('data-nav-label');
      const navLink = document.createElement('a');
      navLink.href = `#${section.id}`;
      navLink.textContent = label.toUpperCase();
      navLink.setAttribute('data-section-id', section.id);

      // Add smooth scroll handler
      navLink.addEventListener('click', handleNavClick);

      fragment.appendChild(navLink);
    });

    container.appendChild(fragment);
  }

  /**
   * Handle navigation link click
   * @param {Event} e - Click event
   */
  function handleNavClick(e) {
    e.preventDefault();

    const sectionId = this.getAttribute('data-section-id');
    const section = document.getElementById(sectionId);

    if (!section) return;

    // Calculate scroll offset (header + nav height)
    const headerHeight = getHeaderNavHeight();
    const sectionTop = section.offsetTop - headerHeight;

    // Smooth scroll to section
    window.scrollTo({
      top: sectionTop,
      behavior: 'smooth'
    });
  }

  /**
   * Calculate combined height of header and nav elements
   * @returns {number} Total offset height
   */
  function getHeaderNavHeight() {
    const header = document.querySelector('header');
    const nav = document.getElementById(NAV_CONTAINER_ID);

    let totalHeight = 0;

    if (header) {
      totalHeight += header.offsetHeight;
    }

    if (nav) {
      totalHeight += nav.offsetHeight;
    }

    return totalHeight;
  }

  /**
   * Set up Intersection Observer for scroll tracking
   */
  function setupIntersectionObserver() {
    const sections = document.querySelectorAll('section[data-nav-label]');

    if (sections.length === 0) return;

    const options = {
      root: null,
      rootMargin: `-${getHeaderNavHeight() + 50}px 0px -66% 0px`,
      threshold: 0
    };

    intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveNavLink(entry.target.id);
        }
      });
    }, options);

    sections.forEach((section) => {
      intersectionObserver.observe(section);
    });
  }

  /**
   * Update active nav link styling
   * @param {string} sectionId - Section ID to highlight
   */
  function setActiveNavLink(sectionId) {
    if (currentActiveSection === sectionId) return;

    // Remove active class from all links
    const navContainer = document.getElementById(NAV_CONTAINER_ID);
    if (navContainer) {
      navContainer.querySelectorAll('a').forEach((link) => {
        link.classList.remove(ACTIVE_CLASS);
      });
    }

    // Add active class to matching link
    const activeLink = document.querySelector(`a[data-section-id="${sectionId}"]`);
    if (activeLink) {
      activeLink.classList.add(ACTIVE_CLASS);
      scrollNavToLink(activeLink);
    }

    currentActiveSection = sectionId;
  }

  /**
   * Scroll nav bar to keep active link visible (mobile)
   * @param {HTMLElement} link - Navigation link element
   */
  function scrollNavToLink(link) {
    const navContainer = document.getElementById(NAV_CONTAINER_ID);

    if (!navContainer) return;

    const linkLeft = link.offsetLeft;
    const linkWidth = link.offsetWidth;
    const containerScroll = navContainer.scrollLeft;
    const containerWidth = navContainer.clientWidth;

    // If link is not visible, scroll container
    if (linkLeft < containerScroll) {
      navContainer.scrollLeft = linkLeft - 10;
    } else if (linkLeft + linkWidth > containerScroll + containerWidth) {
      navContainer.scrollLeft = linkLeft + linkWidth - containerWidth + 10;
    }
  }

  /**
   * Handle page load hash navigation
   */
  function handleHashNavigation() {
    const hash = window.location.hash.slice(1);

    if (hash) {
      const section = document.getElementById(hash);

      if (section) {
        // Use small delay to ensure layout is complete
        setTimeout(() => {
          const headerHeight = getHeaderNavHeight();
          const sectionTop = section.offsetTop - headerHeight;

          window.scrollTo({
            top: sectionTop,
            behavior: 'smooth'
          });

          setActiveNavLink(hash);
        }, 100);
      }
    }
  }

  /**
   * Set up mobile nav auto-scroll on window scroll
   */
  function setupMobileNavScroll() {
    let scrollTimeout;

    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);

      scrollTimeout = setTimeout(() => {
        const activeLink = document.querySelector(`#${NAV_CONTAINER_ID} a.${ACTIVE_CLASS}`);
        if (activeLink) {
          scrollNavToLink(activeLink);
        }
      }, 150);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
