/* ===================================================================
   VIDEO EVIDENCE — Play-on-demand video for cached evidence
   analyst.rizrazak.com  |  _shared/video-evidence.js

   Usage in HTML:
   <div class="ev-video-wrap" data-ev-video-src="evidence/video.mp4"
        data-ev-video-poster="evidence/poster.jpg"
        data-ev-video-label="Screen recording · 21 seconds">
   </div>

   The script auto-builds the video element, overlay, and play button.
   Video plays on click, pauses on second click, and restores overlay on end.
   =================================================================== */

(function () {
  'use strict';

  function initVideoEvidence() {
    var wraps = document.querySelectorAll('.ev-video-wrap[data-ev-video-src]');

    wraps.forEach(function (wrap) {
      var src    = wrap.getAttribute('data-ev-video-src');
      var poster = wrap.getAttribute('data-ev-video-poster') || '';
      var label  = wrap.getAttribute('data-ev-video-label') || 'Play video evidence';

      // Build video element (not autoplay, not preloaded heavily)
      var video = document.createElement('video');
      video.src = src;
      video.preload = 'metadata';
      video.playsInline = true;
      video.controls = false;   // Custom overlay instead
      if (poster) video.poster = poster;

      // Build overlay
      var overlay = document.createElement('div');
      overlay.className = 'ev-video-overlay';
      overlay.innerHTML = [
        '<div class="ev-play-btn"></div>',
        '<span class="ev-video-label">' + label + '</span>'
      ].join('');

      wrap.appendChild(video);
      wrap.appendChild(overlay);

      // Click overlay → play
      overlay.addEventListener('click', function () {
        video.controls = true;
        video.play();
        overlay.classList.add('ev-hidden');
      });

      // Click video while playing → pause
      video.addEventListener('click', function () {
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
      });

      // On video end → restore overlay
      video.addEventListener('ended', function () {
        video.controls = false;
        video.currentTime = 0;
        overlay.classList.remove('ev-hidden');
      });

      // On pause → show controls for seeking, but keep overlay hidden
      video.addEventListener('pause', function () {
        if (video.currentTime > 0 && video.currentTime < video.duration) {
          // Paused mid-playback — keep controls visible
          video.controls = true;
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoEvidence);
  } else {
    initVideoEvidence();
  }
})();
