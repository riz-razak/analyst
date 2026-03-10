/**
 * Comments System v3 - Self-contained IIFE
 * Reads config from window.ANALYST_COMMENTS_CONFIG
 * Creates FAB + slide-out panel with comment management
 */

(function() {
  'use strict';

  // Configuration from window
  const config = window.ANALYST_COMMENTS_CONFIG || {};
  const workerUrl = config.workerUrl || 'https://analyst-collaborative-cms.riz-1cb.workers.dev';
  const dossierId = config.dossierId || 'unknown';

  // Rate limiting: 3 comments per 15 minutes
  const RATE_LIMIT_COUNT = 3;
  const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

  // Color theme
  const colors = {
    forest: '#2d5a27',
    sage: '#7da56d',
    bg: '#f7f5ed',
  };

  // ─────────────────────────────────────────────
  // 1. LOCAL STORAGE HELPERS
  // ─────────────────────────────────────────────

  function getOrCreateUser() {
    let user = JSON.parse(localStorage.getItem('analyst_comment_user') || '{}');
    if (!user.email || !user.displayName) {
      user = {
        email: '',
        displayName: '',
        adminToken: '',
      };
    }
    return user;
  }

  function saveUser(user) {
    localStorage.setItem('analyst_comment_user', JSON.stringify(user));
  }

  function getRateLimitKey() {
    return `analyst_comment_rate_limit_${dossierId}`;
  }

  function checkRateLimit() {
    const key = getRateLimitKey();
    const data = JSON.parse(localStorage.getItem(key) || '{"times":[],"count":0}');
    const now = Date.now();
    data.times = data.times.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

    if (data.times.length >= RATE_LIMIT_COUNT) {
      return false;
    }
    return true;
  }

  function recordCommentTime() {
    const key = getRateLimitKey();
    const data = JSON.parse(localStorage.getItem(key) || '{"times":[],"count":0}');
    data.times.push(Date.now());
    localStorage.setItem(key, JSON.stringify(data));
  }

  // ─────────────────────────────────────────────
  // 2. DOM CREATION
  // ─────────────────────────────────────────────

  function createFAB() {
    const fab = document.createElement('button');
    fab.id = 'comments-fab';
    fab.className = 'comments-fab';
    fab.innerHTML = '💬';
    fab.title = 'Comments';
    fab.addEventListener('click', togglePanel);
    return fab;
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'comments-panel';
    panel.className = 'comments-panel';
    panel.innerHTML = `
      <div class="comments-panel-header">
        <div class="comments-panel-title">Comments</div>
        <button class="comments-panel-close" aria-label="Close comments">✕</button>
      </div>

      <div class="comments-panel-auth">
        <input type="email" id="comment-email" placeholder="Your email" class="comments-auth-input">
        <input type="text" id="comment-name" placeholder="Your name" class="comments-auth-input">
        <button id="comment-auth-save" class="comments-auth-btn">Save Identity</button>
      </div>

      <div class="comments-list-container">
        <div id="comments-list" class="comments-list"></div>
      </div>

      <div class="comments-form-container">
        <textarea id="comment-text" placeholder="Write a comment..." class="comments-textarea" maxlength="5000"></textarea>
        <div class="comments-form-footer">
          <span id="comment-char-count" class="comments-char-count">0/5000</span>
          <button id="comment-submit" class="comments-submit-btn">Post Comment</button>
        </div>
      </div>

      <div id="comments-admin-controls" class="comments-admin-controls" style="display:none;">
        <div class="comments-admin-title">Moderation</div>
        <div id="pending-comments-list" class="comments-pending-list"></div>
      </div>
    `;

    const closeBtn = panel.querySelector('.comments-panel-close');
    closeBtn.addEventListener('click', togglePanel);

    return panel;
  }

  // ─────────────────────────────────────────────
  // 3. PANEL MANAGEMENT
  // ─────────────────────────────────────────────

  function togglePanel() {
    const panel = document.getElementById('comments-panel');
    if (!panel) return;

    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
    } else {
      panel.classList.add('open');
      loadComments();
    }
  }

  // ─────────────────────────────────────────────
  // 4. COMMENT LOADING
  // ─────────────────────────────────────────────

  async function loadComments() {
    const container = document.getElementById('comments-list');
    if (!container) return;

    container.innerHTML = '<div class="comments-loading">Loading comments...</div>';

    try {
      const resp = await fetch(`${workerUrl}/api/comments/list?dossier=${encodeURIComponent(dossierId)}`);
      if (!resp.ok) {
        throw new Error(`API error: ${resp.status}`);
      }

      const data = await resp.json();
      const comments = data.comments || [];

      if (comments.length === 0) {
        container.innerHTML = '<div class="comments-empty">No comments yet. Be the first!</div>';
        return;
      }

      // Group comments by threads (parent_id)
      const rootComments = comments.filter(c => !c.parent_id);
      container.innerHTML = '';

      rootComments.forEach(comment => {
        const replies = comments.filter(c => c.parent_id === comment.id);
        const el = renderCommentThread(comment, replies);
        container.appendChild(el);
      });
    } catch (e) {
      container.innerHTML = `<div class="comments-error">Failed to load comments: ${e.message}</div>`;
      console.error('Comments load error:', e);
    }
  }

  function renderCommentThread(parentComment, replies) {
    const thread = document.createElement('div');
    thread.className = 'comment-thread';

    const parentEl = renderCommentCard(parentComment, 1);
    thread.appendChild(parentEl);

    if (replies.length > 0) {
      const repliesEl = document.createElement('div');
      repliesEl.className = 'comment-replies';
      replies.forEach(reply => {
        const replyEl = renderCommentCard(reply, reply.level || 2);
        repliesEl.appendChild(replyEl);
      });
      thread.appendChild(repliesEl);
    }

    return thread;
  }

  function renderCommentCard(comment, level) {
    const card = document.createElement('div');
    card.className = `comment-card comment-level-${level}`;
    card.style.marginLeft = level > 1 ? `${(level - 1) * 24}px` : '0';

    const initials = (comment.author_name || 'A').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const timestamp = new Date(comment.created_at).toLocaleDateString();

    card.innerHTML = `
      <div class="comment-avatar">${initials}</div>
      <div class="comment-content">
        <div class="comment-meta">
          <span class="comment-author">${comment.author_name || 'Anonymous'}</span>
          <span class="comment-time">${timestamp}</span>
        </div>
        <div class="comment-body">${escapeHtml(comment.body)}</div>
        <div class="comment-actions">
          <button class="comment-reply-btn" data-comment-id="${comment.id}">Reply</button>
          ${comment.likes ? `<span class="comment-likes">👍 ${comment.likes}</span>` : ''}
        </div>
      </div>
    `;

    const replyBtn = card.querySelector('.comment-reply-btn');
    replyBtn.addEventListener('click', () => {
      setReplyTarget(comment.id);
    });

    return card;
  }

  // ─────────────────────────────────────────────
  // 5. COMMENT SUBMISSION
  // ─────────────────────────────────────────────

  let replyToCommentId = null;

  function setReplyTarget(commentId) {
    replyToCommentId = commentId;
    const textarea = document.getElementById('comment-text');
    if (textarea) {
      textarea.focus();
      textarea.setAttribute('data-reply-to', commentId);
    }
  }

  async function submitComment() {
    const textarea = document.getElementById('comment-text');
    const user = getOrCreateUser();

    if (!user.email || !user.displayName) {
      alert('Please enter your email and name first');
      return;
    }

    if (!textarea.value.trim()) {
      alert('Please write a comment');
      return;
    }

    if (!checkRateLimit()) {
      alert('You are commenting too frequently. Please wait a moment.');
      return;
    }

    const btn = document.getElementById('comment-submit');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Posting...';

    try {
      const resp = await fetch(`${workerUrl}/api/comments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossierId,
          parentId: replyToCommentId || null,
          authorEmail: user.email,
          authorName: user.displayName,
          commentText: textarea.value,
          level: replyToCommentId ? 2 : 1,
        }),
      });

      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.error || 'Failed to post comment');
      }

      recordCommentTime();
      textarea.value = '';
      replyToCommentId = null;
      textarea.removeAttribute('data-reply-to');
      updateCharCount();
      loadComments();
    } catch (e) {
      alert(`Error: ${e.message}`);
      console.error('Submit error:', e);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ─────────────────────────────────────────────
  // 6. AUTH & USER MANAGEMENT
  // ─────────────────────────────────────────────

  function restoreUserIdentity() {
    const user = getOrCreateUser();
    const emailInput = document.getElementById('comment-email');
    const nameInput = document.getElementById('comment-name');

    if (emailInput && user.email) {
      emailInput.value = user.email;
    }
    if (nameInput && user.displayName) {
      nameInput.value = user.displayName;
    }

    checkAdminStatus(user);
  }

  function saveUserIdentity() {
    const email = document.getElementById('comment-email').value.trim();
    const name = document.getElementById('comment-name').value.trim();

    if (!email || !name) {
      alert('Please enter both email and name');
      return;
    }

    const user = { email, displayName: name };
    saveUser(user);
    checkAdminStatus(user);
  }

  function checkAdminStatus(user) {
    // Simple admin check: look for adminToken in localStorage
    const adminControls = document.getElementById('comments-admin-controls');
    if (!adminControls) return;

    const adminToken = localStorage.getItem('analyst_admin_token');
    if (adminToken && adminToken.length > 0) {
      adminControls.style.display = 'block';
      loadPendingComments(adminToken);
    } else {
      adminControls.style.display = 'none';
    }
  }

  // ─────────────────────────────────────────────
  // 7. ADMIN MODERATION
  // ─────────────────────────────────────────────

  async function loadPendingComments(adminToken) {
    const container = document.getElementById('pending-comments-list');
    if (!container) return;

    try {
      const resp = await fetch(`${workerUrl}/api/comments/pending?adminToken=${encodeURIComponent(adminToken)}`);
      if (!resp.ok) {
        throw new Error('Failed to fetch pending comments');
      }

      const data = await resp.json();
      const comments = data.comments || [];

      if (comments.length === 0) {
        container.innerHTML = '<div class="comments-pending-empty">No pending comments</div>';
        return;
      }

      container.innerHTML = '';
      comments.forEach(comment => {
        const card = document.createElement('div');
        card.className = 'comments-pending-card';
        card.innerHTML = `
          <div class="comments-pending-meta">
            <strong>${comment.author_name || 'Anonymous'}</strong> in <code>${comment.dossier_id}</code>
          </div>
          <div class="comments-pending-body">${escapeHtml(comment.body)}</div>
          <div class="comments-pending-actions">
            <button class="comments-pending-approve" data-comment-id="${comment.id}">Approve</button>
            <button class="comments-pending-reject" data-comment-id="${comment.id}">Reject</button>
            <button class="comments-pending-flag" data-comment-id="${comment.id}">Flag</button>
          </div>
        `;

        const approveBtn = card.querySelector('.comments-pending-approve');
        const rejectBtn = card.querySelector('.comments-pending-reject');
        const flagBtn = card.querySelector('.comments-pending-flag');

        approveBtn.addEventListener('click', () => moderateComment(comment.id, 'approved', adminToken));
        rejectBtn.addEventListener('click', () => moderateComment(comment.id, 'rejected', adminToken));
        flagBtn.addEventListener('click', () => moderateComment(comment.id, 'flagged', 'Spam/Inappropriate', adminToken));

        container.appendChild(card);
      });
    } catch (e) {
      container.innerHTML = `<div class="comments-error">Failed to load pending: ${e.message}</div>`;
      console.error('Pending load error:', e);
    }
  }

  async function moderateComment(commentId, action, reason, adminToken) {
    try {
      const resp = await fetch(`${workerUrl}/api/comments/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          action,
          reason: reason || '',
          adminToken,
        }),
      });

      if (!resp.ok) {
        throw new Error('Moderation failed');
      }

      loadPendingComments(adminToken);
      loadComments();
    } catch (e) {
      alert(`Moderation error: ${e.message}`);
      console.error('Moderation error:', e);
    }
  }

  // ─────────────────────────────────────────────
  // 8. UTILITIES
  // ─────────────────────────────────────────────

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateCharCount() {
    const textarea = document.getElementById('comment-text');
    const counter = document.getElementById('comment-char-count');
    if (textarea && counter) {
      counter.textContent = `${textarea.value.length}/5000`;
    }
  }

  // ─────────────────────────────────────────────
  // 9. INITIALIZATION
  // ─────────────────────────────────────────────

  function init() {
    // Inject styles
    if (!document.getElementById('comments-v3-styles')) {
      const link = document.createElement('link');
      link.id = 'comments-v3-styles';
      link.rel = 'stylesheet';
      link.href = '/_shared/comments-v3.css';
      document.head.appendChild(link);
    }

    // Create FAB and panel
    const fab = createFAB();
    const panel = createPanel();

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    // Restore user identity
    restoreUserIdentity();

    // Event listeners
    document.getElementById('comment-auth-save').addEventListener('click', saveUserIdentity);
    document.getElementById('comment-email').addEventListener('change', saveUserIdentity);
    document.getElementById('comment-name').addEventListener('change', saveUserIdentity);
    document.getElementById('comment-text').addEventListener('input', updateCharCount);
    document.getElementById('comment-submit').addEventListener('click', submitComment);

    console.log('Comments v3 initialized for dossier:', dossierId);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
