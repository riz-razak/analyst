/**
 * Expiry & Limits Tracker — analyst.rizrazak.com
 *
 * Monitors service expiry dates, certificate renewals, token rotations,
 * and usage limits. Generates alerts at configurable thresholds.
 *
 * Usage:
 *   import { ExpiryTracker } from './expiry-tracker.js';
 *   const tracker = new ExpiryTracker();
 *   tracker.on('alert', (alert) => console.log(alert));
 *   tracker.evaluate(registry);
 */

export class ExpiryTracker {
  constructor(options = {}) {
    this.thresholds = {
      critical: options.criticalDays || 7,     // red alert
      warning: options.warningDays || 30,      // amber alert
      info: options.infoDays || 90,            // informational
    };
    this.listeners = {};
    this.alerts = [];

    // Additional tracked items beyond the registry (manually maintained)
    this.trackedItems = [
      {
        id: 'github-pat',
        name: 'GitHub Fine-Grained PAT',
        description: 'Personal access token for CMS publish-to-GitHub. Scopes: Contents R/W on riz-razak/analyst.',
        expiryDate: null,  // TODO: Set when PAT is created
        renewUrl: 'https://github.com/settings/tokens',
        category: 'secret',
      },
      {
        id: 'resend-api-key',
        name: 'Resend API Key ("Supabase SMTP")',
        description: 'Sending-access key for transactional emails. Configured in Supabase SMTP settings.',
        expiryDate: null,  // Resend keys don't expire, but track for rotation policy
        renewUrl: 'https://resend.com/api-keys',
        category: 'secret',
      },
      {
        id: 'cloudflare-api-token',
        name: 'Cloudflare API Token',
        description: 'Used in GitHub Actions for Worker deployment.',
        expiryDate: null,  // Check Cloudflare dashboard for expiry
        renewUrl: 'https://dash.cloudflare.com/profile/api-tokens',
        category: 'secret',
      },
      {
        id: 'supabase-anon-key',
        name: 'Supabase Anon Key',
        description: 'Public key for client-side Supabase access. Protected by RLS.',
        expiryDate: '2036-02-04',  // JWT exp claim from the key
        renewUrl: 'https://supabase.com/dashboard/project/ogunznqyfmxkmmwizpfy/settings/api',
        category: 'key',
      },
      {
        id: 'ssl-cert',
        name: 'SSL Certificate (Cloudflare)',
        description: 'Auto-renewed by Cloudflare. Universal SSL for *.rizrazak.com.',
        expiryDate: null,  // Auto-renewed
        renewUrl: 'https://dash.cloudflare.com/',
        category: 'certificate',
        autoRenew: true,
      },
      {
        id: 'domain-registration',
        name: 'Domain: rizrazak.com',
        description: 'Domain registration via Cloudflare Registrar.',
        expiryDate: null,  // TODO: Set from registrar
        renewUrl: 'https://dash.cloudflare.com/',
        category: 'domain',
      },
    ];
  }

  // ── Event system ──────────────────────────────────────────

  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== fn);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }

  // ── Evaluation ────────────────────────────────────────────

  /**
   * Evaluate all registry services + tracked items for expiry alerts.
   * @param {Array} services — from registry
   * @returns {Array} alerts
   */
  evaluate(services = []) {
    this.alerts = [];
    const now = Date.now();

    // Check registry services
    services.forEach(service => {
      if (service.expiryDate) {
        this._checkExpiry(service.id, service.name, service.expiryDate, now, service.dashboard);
      }

      // Check for unconfigured services
      if (service.status === 'not-configured') {
        this.alerts.push({
          id: service.id,
          name: service.name,
          level: 'info',
          type: 'not-configured',
          message: `${service.name} is not yet configured`,
          actionUrl: service.dashboard,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Check tracked items
    this.trackedItems.forEach(item => {
      if (item.expiryDate) {
        this._checkExpiry(item.id, item.name, item.expiryDate, now, item.renewUrl);
      }

      // Warn about items with unknown expiry that should be tracked
      if (!item.expiryDate && !item.autoRenew && item.category === 'secret') {
        this.alerts.push({
          id: item.id,
          name: item.name,
          level: 'info',
          type: 'unknown-expiry',
          message: `${item.name}: expiry date unknown — verify and set manually`,
          actionUrl: item.renewUrl,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Emit all alerts
    this.alerts.forEach(alert => this.emit('alert', alert));
    this.emit('evaluation', { alerts: this.alerts, timestamp: new Date().toISOString() });

    return this.alerts;
  }

  /** Get all current alerts */
  getAlerts() {
    return this.alerts;
  }

  /** Get alerts by severity level */
  getAlertsByLevel(level) {
    return this.alerts.filter(a => a.level === level);
  }

  /** Get count of alerts by level */
  getAlertCounts() {
    return {
      critical: this.alerts.filter(a => a.level === 'critical').length,
      warning: this.alerts.filter(a => a.level === 'warning').length,
      info: this.alerts.filter(a => a.level === 'info').length,
      total: this.alerts.length,
    };
  }

  /** Add a tracked item at runtime */
  addTrackedItem(item) {
    const existing = this.trackedItems.findIndex(t => t.id === item.id);
    if (existing >= 0) {
      this.trackedItems[existing] = { ...this.trackedItems[existing], ...item };
    } else {
      this.trackedItems.push(item);
    }
  }

  /** Update expiry date for a tracked item */
  updateExpiry(id, expiryDate) {
    const item = this.trackedItems.find(t => t.id === id);
    if (item) item.expiryDate = expiryDate;
  }

  /** Get all tracked items */
  getTrackedItems() {
    return this.trackedItems;
  }

  // ── Private ───────────────────────────────────────────────

  _checkExpiry(id, name, expiryDate, now, actionUrl) {
    const expiry = new Date(expiryDate).getTime();
    const daysUntil = Math.ceil((expiry - now) / 86400000);

    if (daysUntil < 0) {
      this.alerts.push({
        id, name,
        level: 'critical',
        type: 'expired',
        message: `${name} expired ${Math.abs(daysUntil)} days ago`,
        expiryDate,
        daysUntil,
        actionUrl,
        timestamp: new Date().toISOString(),
      });
    } else if (daysUntil <= this.thresholds.critical) {
      this.alerts.push({
        id, name,
        level: 'critical',
        type: 'expiring-soon',
        message: `${name} expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
        expiryDate,
        daysUntil,
        actionUrl,
        timestamp: new Date().toISOString(),
      });
    } else if (daysUntil <= this.thresholds.warning) {
      this.alerts.push({
        id, name,
        level: 'warning',
        type: 'expiring-soon',
        message: `${name} expires in ${daysUntil} days`,
        expiryDate,
        daysUntil,
        actionUrl,
        timestamp: new Date().toISOString(),
      });
    } else if (daysUntil <= this.thresholds.info) {
      this.alerts.push({
        id, name,
        level: 'info',
        type: 'expiring',
        message: `${name} expires in ${daysUntil} days`,
        expiryDate,
        daysUntil,
        actionUrl,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
