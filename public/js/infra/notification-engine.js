/**
 * Notification Engine — analyst.rizrazak.com
 *
 * Renders toast notifications, maintains a notification drawer,
 * and persists notification state to localStorage.
 *
 * Usage:
 *   import { NotificationEngine } from './notification-engine.js';
 *   const notifier = new NotificationEngine({ containerId: 'notif-container' });
 *   notifier.push({ level: 'warning', title: '...', message: '...' });
 *
 * Levels: critical, warning, info, success
 * Toast auto-dismisses (configurable). Drawer persists until acknowledged.
 */

export class NotificationEngine {
  constructor(options = {}) {
    this.toastDuration = options.toastDuration || 6000;
    this.maxToasts = options.maxToasts || 5;
    this.storageKey = options.storageKey || 'analyst-infra-notifications';
    this.notifications = this._load();
    this.listeners = {};

    // Create DOM containers
    this._initDOM(options.containerId);
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Push a new notification.
   * @param {object} opts — { level, title, message, actionUrl?, persistent?, id? }
   * @returns {string} notification ID
   */
  push(opts) {
    const notif = {
      id: opts.id || `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      level: opts.level || 'info',
      title: opts.title || '',
      message: opts.message || '',
      actionUrl: opts.actionUrl || null,
      persistent: opts.persistent !== false,
      read: false,
      timestamp: opts.timestamp || new Date().toISOString(),
    };

    // Deduplicate by ID
    const existing = this.notifications.findIndex(n => n.id === notif.id);
    if (existing >= 0) {
      this.notifications[existing] = { ...this.notifications[existing], ...notif, read: this.notifications[existing].read };
    } else {
      this.notifications.unshift(notif);
    }

    this._save();
    this._showToast(notif);
    this._renderDrawer();
    this.emit('push', notif);
    this.emit('count', this.getUnreadCount());

    return notif.id;
  }

  /**
   * Push multiple notifications from health check / expiry results.
   * @param {Array} alerts — from ExpiryTracker or HealthChecker
   */
  pushAlerts(alerts) {
    alerts.forEach(alert => {
      this.push({
        id: `alert-${alert.id}-${alert.type}`,
        level: alert.level,
        title: alert.name,
        message: alert.message,
        actionUrl: alert.actionUrl,
        timestamp: alert.timestamp,
      });
    });
  }

  /**
   * Push health check status change as notification.
   * @param {object} change — { id, name, from, to, timestamp }
   */
  pushStatusChange(change) {
    const levelMap = { down: 'critical', degraded: 'warning', healthy: 'success' };
    const level = levelMap[change.to] || 'info';

    this.push({
      id: `health-${change.id}`,
      level,
      title: change.name,
      message: `Status changed: ${change.from} → ${change.to}`,
      timestamp: change.timestamp,
    });
  }

  /** Mark a notification as read */
  markRead(id) {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this._save();
      this._renderDrawer();
      this.emit('count', this.getUnreadCount());
    }
  }

  /** Mark all as read */
  markAllRead() {
    this.notifications.forEach(n => { n.read = true; });
    this._save();
    this._renderDrawer();
    this.emit('count', this.getUnreadCount());
  }

  /** Dismiss (remove) a notification */
  dismiss(id) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this._save();
    this._renderDrawer();
    this.emit('count', this.getUnreadCount());
  }

  /** Clear all notifications */
  clearAll() {
    this.notifications = [];
    this._save();
    this._renderDrawer();
    this.emit('count', 0);
  }

  /** Get unread count */
  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  /** Get all notifications */
  getAll() {
    return this.notifications;
  }

  /** Toggle drawer visibility */
  toggleDrawer() {
    this.drawer?.classList.toggle('open');
  }

  // ── Event system ──────────────────────────────────────────

  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ── DOM ───────────────────────────────────────────────────

  _initDOM(containerId) {
    // Inject styles if not already present
    if (!document.getElementById('notif-engine-styles')) {
      const style = document.createElement('style');
      style.id = 'notif-engine-styles';
      style.textContent = this._getStyles();
      document.head.appendChild(style);
    }

    // Toast container (top-right)
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'notif-toast-container';
    document.body.appendChild(this.toastContainer);

    // Notification drawer (slide-in panel)
    this.drawer = document.createElement('div');
    this.drawer.className = 'notif-drawer';
    this.drawer.innerHTML = `
      <div class="notif-drawer-header">
        <span class="notif-drawer-title">Notifications</span>
        <div class="notif-drawer-actions">
          <button class="notif-btn-text" data-action="mark-all-read">Mark all read</button>
          <button class="notif-btn-text" data-action="clear-all">Clear</button>
          <button class="notif-btn-close" data-action="close">&times;</button>
        </div>
      </div>
      <div class="notif-drawer-body"></div>
    `;
    document.body.appendChild(this.drawer);

    // Drawer event listeners
    this.drawer.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'mark-all-read') this.markAllRead();
      else if (action === 'clear-all') this.clearAll();
      else if (action === 'close') this.drawer.classList.remove('open');
      else if (action === 'dismiss') {
        const id = e.target.closest('[data-notif-id]')?.dataset.notifId;
        if (id) this.dismiss(id);
      } else if (action === 'read') {
        const id = e.target.closest('[data-notif-id]')?.dataset.notifId;
        if (id) this.markRead(id);
      }
    });

    // Render existing notifications
    this._renderDrawer();
  }

  _showToast(notif) {
    const toast = document.createElement('div');
    toast.className = `notif-toast notif-toast-${notif.level}`;
    toast.innerHTML = `
      <div class="notif-toast-icon">${this._icon(notif.level)}</div>
      <div class="notif-toast-content">
        <div class="notif-toast-title">${this._esc(notif.title)}</div>
        <div class="notif-toast-msg">${this._esc(notif.message)}</div>
      </div>
      <button class="notif-toast-close">&times;</button>
    `;

    toast.querySelector('.notif-toast-close').addEventListener('click', () => {
      toast.classList.add('notif-toast-exit');
      setTimeout(() => toast.remove(), 300);
    });

    this.toastContainer.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('notif-toast-enter'));

    // Auto-dismiss
    if (!notif.persistent || notif.level !== 'critical') {
      setTimeout(() => {
        toast.classList.add('notif-toast-exit');
        setTimeout(() => toast.remove(), 300);
      }, this.toastDuration);
    }

    // Limit toast count
    const toasts = this.toastContainer.children;
    while (toasts.length > this.maxToasts) {
      toasts[0].remove();
    }
  }

  _renderDrawer() {
    const body = this.drawer?.querySelector('.notif-drawer-body');
    if (!body) return;

    if (this.notifications.length === 0) {
      body.innerHTML = '<div class="notif-drawer-empty">No notifications</div>';
      return;
    }

    body.innerHTML = this.notifications.map(n => `
      <div class="notif-drawer-item ${n.read ? 'read' : 'unread'} notif-level-${n.level}" data-notif-id="${n.id}">
        <div class="notif-drawer-item-icon">${this._icon(n.level)}</div>
        <div class="notif-drawer-item-content">
          <div class="notif-drawer-item-title">${this._esc(n.title)}</div>
          <div class="notif-drawer-item-msg">${this._esc(n.message)}</div>
          <div class="notif-drawer-item-time">${this._timeAgo(n.timestamp)}</div>
        </div>
        <div class="notif-drawer-item-actions">
          ${n.actionUrl ? `<a href="${n.actionUrl}" target="_blank" rel="noopener" class="notif-btn-action">Open</a>` : ''}
          <button class="notif-btn-dismiss" data-action="dismiss" data-notif-id="${n.id}">&times;</button>
        </div>
      </div>
    `).join('');

    // Mark as read on click
    body.querySelectorAll('.notif-drawer-item.unread').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.notifId;
        if (id) this.markRead(id);
      });
    });
  }

  _icon(level) {
    const icons = {
      critical: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="4" x2="8" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.75" fill="currentColor"/></svg>',
      warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L15 14H1L8 1Z" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="12" r="0.6" fill="currentColor"/></svg>',
      info: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="7" x2="8" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="4.5" r="0.75" fill="currentColor"/></svg>',
      success: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="5,8 7,10.5 11,5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    };
    return icons[level] || icons.info;
  }

  _esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  _timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // ── Persistence ───────────────────────────────────────────

  _save() {
    try {
      // Keep only last 100 notifications
      const toSave = this.notifications.slice(0, 100);
      localStorage.setItem(this.storageKey, JSON.stringify(toSave));
    } catch (e) { /* localStorage might be full */ }
  }

  _load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  // ── Styles ────────────────────────────────────────────────

  _getStyles() {
    return `
      .notif-toast-container {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 380px;
        pointer-events: none;
      }

      .notif-toast {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 14px 16px;
        background: #242019;
        border: 1px solid #3a352c;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 13px;
        color: #e8dcc8;
        opacity: 0;
        transform: translateX(20px);
        transition: opacity 0.3s, transform 0.3s;
        pointer-events: auto;
      }

      .notif-toast-enter { opacity: 1; transform: translateX(0); }
      .notif-toast-exit { opacity: 0; transform: translateX(20px); }

      .notif-toast-critical { border-left: 3px solid #c44; }
      .notif-toast-warning { border-left: 3px solid #d4af37; }
      .notif-toast-info { border-left: 3px solid #5d8a9e; }
      .notif-toast-success { border-left: 3px solid #6b7c52; }

      .notif-toast-icon { flex-shrink: 0; margin-top: 1px; }
      .notif-toast-critical .notif-toast-icon { color: #c44; }
      .notif-toast-warning .notif-toast-icon { color: #d4af37; }
      .notif-toast-info .notif-toast-icon { color: #5d8a9e; }
      .notif-toast-success .notif-toast-icon { color: #6b7c52; }

      .notif-toast-content { flex: 1; min-width: 0; }
      .notif-toast-title { font-weight: 600; margin-bottom: 2px; }
      .notif-toast-msg { color: #9a8e7a; font-size: 12px; line-height: 1.4; }

      .notif-toast-close {
        background: none; border: none; color: #6d6356; cursor: pointer;
        font-size: 18px; line-height: 1; padding: 0 4px; flex-shrink: 0;
      }
      .notif-toast-close:hover { color: #e8dcc8; }

      /* ── Drawer ── */
      .notif-drawer {
        position: fixed;
        top: 0; right: -400px;
        width: 380px; height: 100vh;
        background: #1a1612;
        border-left: 1px solid #3a352c;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        transition: right 0.3s ease;
        font-family: 'Inter', -apple-system, sans-serif;
        box-shadow: -8px 0 24px rgba(0,0,0,0.3);
      }

      .notif-drawer.open { right: 0; }

      .notif-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 16px;
        border-bottom: 1px solid #3a352c;
      }

      .notif-drawer-title {
        font-size: 16px;
        font-weight: 600;
        color: #e8dcc8;
      }

      .notif-drawer-actions { display: flex; gap: 8px; align-items: center; }

      .notif-btn-text {
        background: none; border: none; color: #6b7c52; cursor: pointer;
        font-size: 12px; font-family: 'JetBrains Mono', monospace;
        letter-spacing: 0.5px;
      }
      .notif-btn-text:hover { color: #8fa868; }

      .notif-btn-close {
        background: none; border: none; color: #6d6356; cursor: pointer;
        font-size: 22px; line-height: 1; padding: 0 4px;
      }
      .notif-btn-close:hover { color: #e8dcc8; }

      .notif-drawer-body {
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #3a352c #1a1612;
      }

      .notif-drawer-empty {
        text-align: center;
        padding: 48px 16px;
        color: #6d6356;
        font-size: 14px;
      }

      .notif-drawer-item {
        display: flex;
        gap: 10px;
        padding: 14px 16px;
        border-bottom: 1px solid #2a2520;
        cursor: pointer;
        transition: background 0.15s;
      }

      .notif-drawer-item:hover { background: rgba(107,124,82,0.05); }
      .notif-drawer-item.unread { background: rgba(107,124,82,0.08); }
      .notif-drawer-item.read { opacity: 0.6; }

      .notif-drawer-item-icon { flex-shrink: 0; margin-top: 2px; }
      .notif-level-critical .notif-drawer-item-icon { color: #c44; }
      .notif-level-warning .notif-drawer-item-icon { color: #d4af37; }
      .notif-level-info .notif-drawer-item-icon { color: #5d8a9e; }
      .notif-level-success .notif-drawer-item-icon { color: #6b7c52; }

      .notif-drawer-item-content { flex: 1; min-width: 0; }
      .notif-drawer-item-title { font-weight: 600; font-size: 13px; color: #e8dcc8; margin-bottom: 2px; }
      .notif-drawer-item-msg { font-size: 12px; color: #9a8e7a; line-height: 1.4; }
      .notif-drawer-item-time { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #6d6356; margin-top: 4px; }

      .notif-drawer-item-actions { display: flex; gap: 6px; align-items: flex-start; flex-shrink: 0; }
      .notif-btn-action {
        font-size: 11px; color: #6b7c52; text-decoration: none;
        font-family: 'JetBrains Mono', monospace;
        border: 1px solid rgba(107,124,82,0.3);
        padding: 2px 8px; border-radius: 4px;
      }
      .notif-btn-action:hover { background: rgba(107,124,82,0.15); color: #8fa868; }

      .notif-btn-dismiss {
        background: none; border: none; color: #6d6356; cursor: pointer;
        font-size: 16px; line-height: 1; padding: 0;
      }
      .notif-btn-dismiss:hover { color: #c44; }

      @media (max-width: 440px) {
        .notif-drawer { width: 100vw; right: -100vw; }
        .notif-toast-container { max-width: calc(100vw - 32px); right: 16px; }
      }
    `;
  }
}
