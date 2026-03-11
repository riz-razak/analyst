/**
 * Narrative Timeline — Scroll-position temporal awareness bar
 * analyst.rizrazak.com
 * Last updated: 2026-03-11
 *
 * MODES:
 * 1. Standalone: fixed full-width bar at top of viewport (no sidenav)
 * 2. Embedded:   compact bar inside .side-nav panel (auto-detected)
 *
 * Reads timeline data from a <script type="application/json" id="narrative-timeline-data">
 * block in the dossier HTML, then renders a bar showing the reader's
 * temporal position within the narrative.
 *
 * Data format:
 * {
 *   "startDate": "Pre-2021",
 *   "endDate": "March 2026",
 *   "events": [
 *     {
 *       "date": "June 28, 2021",
 *       "title": "Emy Vithanage Releases Screenshot",
 *       "significance": "critical|important|context",
 *       "sectionId": "evidence",
 *       "position": 0.35
 *     }
 *   ]
 * }
 *
 * CMS toggle: data-cms-id="narrative-timeline-toggle"
 * User toggle: press 'T' key
 */

(function () {
  'use strict';

  // ===== CONFIG =====
  const NAVBAR_HEIGHT = 56;
  const THROTTLE_MS = 50;

  // ===== LOAD DATA =====
  const dataEl = document.getElementById('narrative-timeline-data');
  if (!dataEl) return;

  let timelineData;
  try {
    timelineData = JSON.parse(dataEl.textContent);
  } catch (e) {
    console.warn('Narrative Timeline: invalid JSON data');
    return;
  }

  if (!timelineData.events || !timelineData.events.length) return;

  // ===== DETECT SIDENAV =====
  const sideNav = document.querySelector('.side-nav');
  const isEmbedded = !!sideNav;

  // ===== BUILD DOM =====
  const bar = document.createElement('div');
  bar.className = 'narrative-timeline' + (isEmbedded ? ' nt-embedded' : '');
  bar.setAttribute('data-cms-id', 'narrative-timeline-toggle');
  bar.setAttribute('role', 'complementary');
  bar.setAttribute('aria-label', 'Narrative timeline showing temporal position');

  // Check localStorage for user preference
  if (localStorage.getItem('nt-hidden') === '1') {
    bar.classList.add('hidden');
  }

  // Date labels
  const dateStart = document.createElement('span');
  dateStart.className = 'nt-date-start';
  dateStart.textContent = timelineData.startDate || '';

  const dateEnd = document.createElement('span');
  dateEnd.className = 'nt-date-end';
  dateEnd.textContent = timelineData.endDate || '';

  // Track
  const track = document.createElement('div');
  track.className = 'nt-track';

  const progress = document.createElement('div');
  progress.className = 'nt-progress';
  track.appendChild(progress);

  const cursor = document.createElement('div');
  cursor.className = 'nt-cursor';
  track.appendChild(cursor);

  // Significance markers
  timelineData.events.forEach(function (evt) {
    const marker = document.createElement('div');
    marker.className = 'nt-marker' + (evt.significance === 'critical' ? ' key' : '');
    marker.style.left = (evt.position * 100) + '%';

    // Hover card
    const card = document.createElement('div');
    card.className = 'nt-hover-card';
    card.innerHTML =
      '<div class="nt-hc-date">' + escHtml(evt.date) + '</div>' +
      '<div class="nt-hc-title">' + escHtml(evt.title) + '</div>' +
      '<span class="nt-hc-significance ' + (evt.significance || 'context') + '">' +
      escHtml(evt.significance || 'context').toUpperCase() + '</span>';

    marker.appendChild(card);

    // Click to scroll to section
    if (evt.sectionId) {
      marker.addEventListener('click', function () {
        const target = document.getElementById(evt.sectionId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    track.appendChild(marker);
  });

  // Toggle button
  const toggle = document.createElement('button');
  toggle.className = 'nt-toggle';
  toggle.textContent = '×';
  toggle.title = 'Hide timeline (press T to toggle)';
  toggle.addEventListener('click', function () {
    bar.classList.toggle('hidden');
    localStorage.setItem('nt-hidden', bar.classList.contains('hidden') ? '1' : '0');
  });

  // ===== ASSEMBLE =====
  if (isEmbedded) {
    // Embedded mode: structured layout inside sidenav
    // [temporal label] → [date-row: start | toggle | end] → [track]
    const temporalLabel = document.createElement('div');
    temporalLabel.className = 'nt-temporal-label';
    temporalLabel.textContent = 'Timeline';

    const dateRow = document.createElement('div');
    dateRow.className = 'nt-date-row';
    dateRow.appendChild(dateStart);
    dateRow.appendChild(toggle);
    dateRow.appendChild(dateEnd);

    bar.appendChild(temporalLabel);
    bar.appendChild(dateRow);
    bar.appendChild(track);

    // Insert at top of sidenav, before the nav label
    const navLabel = sideNav.querySelector('.side-nav-label');
    if (navLabel) {
      sideNav.insertBefore(bar, navLabel);
    } else {
      sideNav.insertBefore(bar, sideNav.firstChild);
    }
  } else {
    // Standalone mode: flat horizontal bar
    bar.appendChild(dateStart);
    bar.appendChild(track);
    bar.appendChild(dateEnd);
    bar.appendChild(toggle);

    // Insert at top of body
    const navbar = document.querySelector('.navbar');
    if (navbar && navbar.nextSibling) {
      navbar.parentNode.insertBefore(bar, navbar.nextSibling);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  // ===== SCROLL TRACKING =====
  const sectionPositions = [];
  timelineData.events.forEach(function (evt) {
    if (evt.sectionId) {
      sectionPositions.push({
        id: evt.sectionId,
        timelinePos: evt.position
      });
    }
  });

  // Sort by DOM position
  sectionPositions.sort(function (a, b) {
    const elA = document.getElementById(a.id);
    const elB = document.getElementById(b.id);
    if (!elA || !elB) return 0;
    return elA.offsetTop - elB.offsetTop;
  });

  let ticking = false;

  function updateTimeline() {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const viewportHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // Find which section the reader is closest to
    let currentPos = 0;
    let prevTop = 0;
    let prevPos = 0;

    for (let i = 0; i < sectionPositions.length; i++) {
      const el = document.getElementById(sectionPositions[i].id);
      if (!el) continue;

      const elTop = el.offsetTop - NAVBAR_HEIGHT - 100;

      if (scrollY >= elTop) {
        prevTop = elTop;
        prevPos = sectionPositions[i].timelinePos;

        if (i < sectionPositions.length - 1) {
          const nextEl = document.getElementById(sectionPositions[i + 1].id);
          if (nextEl) {
            const nextTop = nextEl.offsetTop - NAVBAR_HEIGHT - 100;
            const nextPos = sectionPositions[i + 1].timelinePos;
            const sectionProgress = Math.min(1, Math.max(0,
              (scrollY - elTop) / (nextTop - elTop)
            ));
            currentPos = prevPos + (nextPos - prevPos) * sectionProgress;
          } else {
            currentPos = prevPos;
          }
        } else {
          const remaining = docHeight - elTop - viewportHeight;
          const sectionProgress = remaining > 0
            ? Math.min(1, (scrollY - elTop) / remaining)
            : 1;
          currentPos = prevPos + (1 - prevPos) * sectionProgress;
        }
      }
    }

    currentPos = Math.min(1, Math.max(0, currentPos));

    progress.style.width = (currentPos * 100) + '%';
    cursor.style.left = (currentPos * 100) + '%';

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateTimeline);
    }
  }, { passive: true });

  // Keyboard toggle
  document.addEventListener('keydown', function (e) {
    if (e.key === 't' || e.key === 'T') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      bar.classList.toggle('hidden');
      localStorage.setItem('nt-hidden', bar.classList.contains('hidden') ? '1' : '0');
    }
  });

  // Initial position
  updateTimeline();

  // ===== HELPERS =====
  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
