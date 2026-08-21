'use strict';

const NERDSYNC_DIAGNOSTICS_STORAGE_KEY = 'nerdsync_diagnostics_v1';
const NERDSYNC_DIAGNOSTICS_MAX_ENTRIES = 150;

function getNerdSyncDiagnosticsSessionStorage() {
  try { return globalThis.sessionStorage; }
  catch { return null; }
}

const NERDSYNC_DIAGNOSTIC_SENSITIVE_KEY = /(access.?token|refresh.?token|authorization|client.?secret|code.?verifier|oauth.?state|chat.?message|message.?text|user.?id|user.?login|user.?name|broadcaster|channel|creator|display.?name|login)/i;
const NERDSYNC_DIAGNOSTIC_SECRET_VALUE = /(Bearer\s+|OAuth\s+)[A-Za-z0-9._~+\/-]+/gi;
const NERDSYNC_DIAGNOSTIC_SECRET_PARAM = /([?&](?:access_token|refresh_token|token|code|state|code_verifier|client_secret)=)[^&#\s]*/gi;

function sanitizeNerdSyncDiagnosticText(value) {
  return String(value ?? '')
    .replace(NERDSYNC_DIAGNOSTIC_SECRET_VALUE, '$1[REDACTED]')
    .replace(NERDSYNC_DIAGNOSTIC_SECRET_PARAM, '$1[REDACTED]')
    .replace(/([#?]).*$/u, '$1[REDACTED]')
    .slice(0, 600);
}

function sanitizeNerdSyncDiagnosticValue(value, depth = 0) {
  if (depth > 3) return '[TRUNCATED]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return sanitizeNerdSyncDiagnosticText(value);
  if (value instanceof Error) {
    return {
      name: sanitizeNerdSyncDiagnosticText(value.name),
      message: sanitizeNerdSyncDiagnosticText(value.message),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 30).map(item => sanitizeNerdSyncDiagnosticValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, item]) => [
      key,
      NERDSYNC_DIAGNOSTIC_SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeNerdSyncDiagnosticValue(item, depth + 1),
    ]));
  }
  return sanitizeNerdSyncDiagnosticText(value);
}

function getNerdSyncCoarseEnvironment(navigatorRef = globalThis.navigator, windowRef = globalThis.window) {
  const ua = String(navigatorRef?.userAgent ?? '');
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Firefox\//.test(ua) ? 'Firefox'
      : /Chrome\//.test(ua) ? 'Chrome'
        : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const os = /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS/iPadOS'
      : /Windows/.test(ua) ? 'Windows'
        : /Mac OS/.test(ua) ? 'macOS'
          : /Linux/.test(ua) ? 'Linux' : 'Other';
  const width = Number(windowRef?.innerWidth);
  const height = Number(windowRef?.innerHeight);
  return {
    browser,
    os,
    online: navigatorRef?.onLine !== false,
    viewport: Number.isFinite(width) && Number.isFinite(height) ? `${Math.round(width)}x${Math.round(height)}` : 'unknown',
  };
}

class NerdSyncDiagnosticsLog {
  constructor({
    version = 'unknown',
    storage = null,
    navigatorRef = globalThis.navigator,
    windowRef = globalThis.window,
    maxEntries = NERDSYNC_DIAGNOSTICS_MAX_ENTRIES,
    now = () => new Date().toISOString(),
  } = {}) {
    this.version = version;
    this.storage = storage ?? getNerdSyncDiagnosticsSessionStorage();
    this.navigatorRef = navigatorRef;
    this.windowRef = windowRef;
    this.maxEntries = maxEntries;
    this.now = now;
    this.contextProvider = () => ({});
    this.items = this._read();
  }

  _read() {
    try {
      const saved = JSON.parse(this.storage?.getItem(NERDSYNC_DIAGNOSTICS_STORAGE_KEY) ?? '[]');
      return Array.isArray(saved) ? saved.slice(-this.maxEntries) : [];
    } catch {
      return [];
    }
  }

  _persist() {
    try { this.storage?.setItem(NERDSYNC_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(this.items)); }
    catch { /* Diagnostics must never interfere with NerdSync. */ }
  }

  setContextProvider(provider) {
    this.contextProvider = typeof provider === 'function' ? provider : () => ({});
  }

  record({ level = 'error', area = 'runtime', message = 'Unknown error', details = {} } = {}) {
    const entry = sanitizeNerdSyncDiagnosticValue({
      timestamp: this.now(),
      level,
      area,
      message,
      details,
      context: this.contextProvider(),
    });
    this.items.push(entry);
    this.items = this.items.slice(-this.maxEntries);
    this._persist();
    return entry;
  }

  entries() {
    return typeof globalThis.structuredClone === 'function'
      ? globalThis.structuredClone(this.items)
      : JSON.parse(JSON.stringify(this.items));
  }

  clear() {
    this.items = [];
    try { this.storage?.removeItem(NERDSYNC_DIAGNOSTICS_STORAGE_KEY); }
    catch { /* ignore */ }
  }

  buildReport(extra = {}) {
    return sanitizeNerdSyncDiagnosticValue({
      app: 'NerdSync',
      version: this.version,
      generatedAt: this.now(),
      environment: getNerdSyncCoarseEnvironment(this.navigatorRef, this.windowRef),
      privacy: 'OAuth tokens, URL parameter values, chat content, and creator/channel identities are excluded. The report is not uploaded automatically.',
      ...extra,
      entries: this.entries(),
    });
  }

  toText(extra = {}) {
    const report = this.buildReport(extra);
    const lines = [
      'NerdSync - Diagnostics / Bug Log',
      `Version: ${report.version}`,
      `Generated: ${report.generatedAt}`,
      `Environment: ${report.environment.browser} on ${report.environment.os}; ${report.environment.online ? 'online' : 'offline'}; viewport ${report.environment.viewport}`,
      '',
      'Privacy: OAuth tokens, URL parameter values, chat content, and creator/channel identities are excluded. This file is never uploaded automatically.',
      'Support: Post this file in the #bug-reports channel in the Nerdspace Labs Discord and include a short description of what you clicked before the issue.',
      '',
    ];
    if (report.activeSection) lines.push(`Active section: ${report.activeSection}`);
    if (report.filterSummary) lines.push(`Filter summary: ${JSON.stringify(report.filterSummary)}`);
    if (report.scanSummary) lines.push(`Scan summary: ${JSON.stringify(report.scanSummary)}`);
    lines.push('', `Recorded errors/events: ${report.entries.length}`);
    for (const entry of report.entries) {
      lines.push(
        '',
        `[${entry.timestamp}] ${String(entry.level).toUpperCase()} - ${entry.area}`,
        `Message: ${entry.message}`,
        `Context: ${JSON.stringify(entry.context)}`,
        `Details: ${JSON.stringify(entry.details)}`
      );
    }
    const requests = Array.isArray(report.recentRequests) ? report.recentRequests : [];
    lines.push('', `Recent sanitized requests: ${requests.length}`);
    for (const event of requests) {
      lines.push(`${event.time || ''} ${event.status ?? ''} ${event.ms ?? ''}ms ${event.target || ''}`.trim());
    }
    return lines.join('\n');
  }

  installGlobalHandlers(windowRef = this.windowRef) {
    const onError = event => this.record({
      area: 'browser',
      message: event?.message || event?.error?.message || 'Unhandled browser error',
      details: { error: event?.error, filename: event?.filename, line: event?.lineno, column: event?.colno },
    });
    const onRejection = event => this.record({
      area: 'promise',
      message: event?.reason?.message || 'Unhandled promise rejection',
      details: { reason: event?.reason },
    });
    windowRef?.addEventListener?.('error', onError);
    windowRef?.addEventListener?.('unhandledrejection', onRejection);
    return () => {
      windowRef?.removeEventListener?.('error', onError);
      windowRef?.removeEventListener?.('unhandledrejection', onRejection);
    };
  }
}

const nerdSyncDiagnosticsLog = new NerdSyncDiagnosticsLog({ version: APP_VERSION, storage:getNerdSyncDiagnosticsSessionStorage() });
nerdSyncDiagnosticsLog.installGlobalHandlers(window);

function recordNerdSyncDiagnostic(entry) {
  try { return nerdSyncDiagnosticsLog.record(entry); }
  catch { return null; }
}
