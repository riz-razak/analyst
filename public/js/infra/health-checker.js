/**
 * Health Checker — analyst.rizrazak.com
 *
 * Runs health checks against registered services.
 * Supports HTTP ping, DNS check (via Worker proxy), and script-presence checks.
 * Emits results as events for the notification engine to consume.
 *
 * Usage:
 *   import { HealthChecker } from './health-checker.js';
 *   const checker = new HealthChecker({ workerUrl: '...' });
 *   checker.on('result', (result) => console.log(result));
 *   checker.checkAll(registry);
 *   checker.startPolling(registry, 300000); // every 5 min
 */

export class HealthChecker {
  constructor(options = {}) {
    this.workerUrl = options.workerUrl || '';
    this.listeners = {};
    this.results = new Map();
    this.polling = null;
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

  // ── Health checks ─────────────────────────────────────────

  /**
   * Check a single service. Returns a result object.
   * @param {object} service — from registry
   * @returns {Promise<object>} { id, status, latencyMs, checkedAt, error? }
   */
  async check(service) {
    const start = performance.now();
    const result = {
      id: service.id,
      name: service.name,
      status: 'unknown',
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      error: null,
    };

    try {
      if (!service.healthCheck) {
        // No health check configured — can't determine status
        if (service.status === 'not-configured' || service.status === 'placeholder') {
          result.status = 'not-configured';
        } else {
          result.status = 'no-check';
        }
        this._storeAndEmit(result);
        return result;
      }

      const hc = service.healthCheck;

      switch (hc.type) {
        case 'http':
          await this._checkHttp(hc, result);
          break;
        case 'dns':
          await this._checkDns(hc, result);
          break;
        case 'script-presence':
          this._checkScriptPresence(hc, result);
          break;
        case 'worker-proxy':
          await this._checkWorkerProxy(hc, result);
          break;
        default:
          result.status = 'unsupported';
          result.error = `Unknown check type: ${hc.type}`;
      }
    } catch (err) {
      result.status = 'error';
      result.error = err.message || String(err);
    }

    result.latencyMs = Math.round(performance.now() - start);
    this._storeAndEmit(result);
    return result;
  }

  /**
   * Check all services in a registry array.
   * @param {Array} services
   * @returns {Promise<Map>} Map of id → result
   */
  async checkAll(services) {
    const checks = services.map(s => this.check(s));
    await Promise.allSettled(checks);
    this.emit('checkAll', { results: this.results, timestamp: new Date().toISOString() });
    return this.results;
  }

  /**
   * Start polling all services at an interval.
   * @param {Array} services
   * @param {number} intervalMs — default 5 minutes
   */
  startPolling(services, intervalMs = 300000) {
    this.stopPolling();
    // Run immediately
    this.checkAll(services);
    this.polling = setInterval(() => this.checkAll(services), intervalMs);
  }

  stopPolling() {
    if (this.polling) {
      clearInterval(this.polling);
      this.polling = null;
    }
  }

  /** Get the latest result for a service */
  getResult(id) {
    return this.results.get(id) || null;
  }

  /** Get all results */
  getAllResults() {
    return Object.fromEntries(this.results);
  }

  /** Get count by status */
  getStatusCounts() {
    const counts = { healthy: 0, degraded: 0, down: 0, unknown: 0, 'not-configured': 0, 'no-check': 0 };
    this.results.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }

  // ── Private check methods ─────────────────────────────────

  async _checkHttp(hc, result) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), hc.timeout || 8000);

    try {
      const opts = {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors', // we can't read cross-origin status, but we can detect failure
        cache: 'no-store',
      };

      // If we have headers (like Supabase apikey), use fetch with cors
      if (hc.headers) {
        opts.mode = 'cors';
        opts.headers = hc.headers;
        opts.method = 'GET';
      }

      const resp = await fetch(hc.url, opts);

      if (opts.mode === 'no-cors') {
        // With no-cors, a successful fetch means the server responded (opaque response)
        result.status = 'healthy';
      } else {
        const expected = Array.isArray(hc.expectedStatus) ? hc.expectedStatus : [hc.expectedStatus || 200];
        result.status = expected.includes(resp.status) ? 'healthy' : 'degraded';
        if (result.status === 'degraded') {
          result.error = `HTTP ${resp.status} (expected ${expected.join(' or ')})`;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        result.status = 'down';
        result.error = `Timeout after ${hc.timeout || 8000}ms`;
      } else {
        result.status = 'down';
        result.error = err.message;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async _checkDns(hc, result) {
    // DNS checks need a server-side proxy (our Worker)
    if (!this.workerUrl) {
      result.status = 'no-check';
      result.error = 'DNS checks require workerUrl to be configured';
      return;
    }
    try {
      const resp = await fetch(`${this.workerUrl}/api/infra/dns-check?domain=${hc.domain}&type=${hc.checkType || 'A'}`, {
        cache: 'no-store',
      });
      if (resp.ok) {
        const data = await resp.json();
        result.status = data.verified ? 'healthy' : 'degraded';
        if (!data.verified) result.error = 'DNS record not verified';
      } else {
        result.status = 'degraded';
        result.error = `DNS check returned ${resp.status}`;
      }
    } catch (err) {
      result.status = 'unknown';
      result.error = err.message;
    }
  }

  _checkScriptPresence(hc, result) {
    // Check if a tracking script is present in the current page DOM
    const scripts = document.querySelectorAll('script[src]');
    const found = Array.from(scripts).some(s => s.src.includes(hc.scriptPattern));
    result.status = found ? 'healthy' : 'degraded';
    if (!found) result.error = `Script pattern "${hc.scriptPattern}" not found on this page`;
  }

  async _checkWorkerProxy(hc, result) {
    if (!this.workerUrl) {
      result.status = 'no-check';
      result.error = 'Worker proxy checks require workerUrl';
      return;
    }
    try {
      const resp = await fetch(`${this.workerUrl}/api/infra/proxy-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: hc.url, expectedStatus: hc.expectedStatus }),
        cache: 'no-store',
      });
      const data = await resp.json();
      result.status = data.status;
      result.latencyMs = data.latencyMs;
      if (data.error) result.error = data.error;
    } catch (err) {
      result.status = 'unknown';
      result.error = err.message;
    }
  }

  // ── Internal ──────────────────────────────────────────────

  _storeAndEmit(result) {
    const prev = this.results.get(result.id);
    this.results.set(result.id, result);

    this.emit('result', result);

    // Emit status change events
    if (prev && prev.status !== result.status) {
      this.emit('statusChange', {
        id: result.id,
        name: result.name,
        from: prev.status,
        to: result.status,
        timestamp: result.checkedAt,
      });
    }
  }
}
