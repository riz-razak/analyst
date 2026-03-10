/**
 * Infrastructure Monitor — Orchestrator
 * analyst.rizrazak.com
 *
 * Wires together registry, health checker, expiry tracker, and notifications.
 * Drop-in: import and call init() from any page.
 *
 * Usage:
 *   import { InfraMonitor } from './infra/index.js';
 *   const monitor = InfraMonitor.init({ pollInterval: 300000 });
 *
 *   // Access subsystems:
 *   monitor.registry      // service definitions
 *   monitor.checker       // health check results
 *   monitor.expiry        // expiry alerts
 *   monitor.notifier      // notification engine
 *
 *   // Manual refresh:
 *   monitor.refresh();
 */

import * as registry from './registry.js';
import { HealthChecker } from './health-checker.js';
import { ExpiryTracker } from './expiry-tracker.js';
import { NotificationEngine } from './notification-engine.js';

class InfraMonitor {
  constructor(options = {}) {
    this.options = options;
    this.registry = registry;
    this.checker = new HealthChecker({
      workerUrl: options.workerUrl || '',
    });
    this.expiry = new ExpiryTracker({
      criticalDays: options.criticalDays || 7,
      warningDays: options.warningDays || 30,
      infoDays: options.infoDays || 90,
    });
    this.notifier = new NotificationEngine({
      toastDuration: options.toastDuration || 6000,
    });

    this._wireEvents();
  }

  /** Initialize and start monitoring */
  static init(options = {}) {
    const monitor = new InfraMonitor(options);
    monitor.start();
    return monitor;
  }

  /** Start polling + initial check */
  start() {
    const services = this.registry.getAll();

    // Run expiry evaluation immediately
    const alerts = this.expiry.evaluate(services);
    if (alerts.length > 0) {
      this.notifier.pushAlerts(alerts);
    }

    // Start health check polling
    const interval = this.options.pollInterval || 300000; // 5 min default
    this.checker.startPolling(services, interval);
  }

  /** Stop polling */
  stop() {
    this.checker.stopPolling();
  }

  /** Manual refresh of all checks */
  async refresh() {
    const services = this.registry.getAll();
    this.expiry.evaluate(services);
    await this.checker.checkAll(services);
  }

  /** Get a dashboard-friendly summary */
  getSummary() {
    return {
      services: this.registry.getSummary(),
      health: this.checker.getStatusCounts(),
      alerts: this.expiry.getAlertCounts(),
      notifications: this.notifier.getUnreadCount(),
    };
  }

  /** Wire events between subsystems */
  _wireEvents() {
    // Health check status changes → notifications
    this.checker.on('statusChange', change => {
      this.notifier.pushStatusChange(change);
    });

    // Expiry alerts → notifications
    this.expiry.on('alert', alert => {
      // Only push critical/warning to toasts (info goes to drawer only)
      if (alert.level === 'critical' || alert.level === 'warning') {
        this.notifier.push({
          id: `alert-${alert.id}-${alert.type}`,
          level: alert.level,
          title: alert.name,
          message: alert.message,
          actionUrl: alert.actionUrl,
          timestamp: alert.timestamp,
        });
      }
    });
  }
}

export { InfraMonitor };
export { registry, HealthChecker, ExpiryTracker, NotificationEngine };
