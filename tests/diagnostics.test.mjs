import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/diagnostics.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

function loadDiagnostics({ ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/125.0 private-detail' } = {}) {
  const listeners = new Map();
  const storage = new MemoryStorage();
  const windowRef = {
    innerWidth: 430,
    innerHeight: 800,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener() {},
  };
  const context = {
    APP_VERSION:'Alpha-0.17.3',
    sessionStorage:storage,
    navigator:{ userAgent:ua, onLine:true },
    window:windowRef,
    structuredClone:globalThis.structuredClone,
    Date,
    console,
    Error,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    JSON,
    Map,
    Set,
  };
  vm.runInNewContext(source, context);
  return { context, storage, listeners };
}

test('diagnostics redact OAuth values, URL values, chat content, and creator identities', () => {
  const { context } = loadDiagnostics();
  const sanitized = context.sanitizeNerdSyncDiagnosticValue({
    authorization:'Bearer top-secret',
    channel:'privatecreator',
    chatMessage:'private chat text',
    message:'OAuth abc123 failed at https://example.test/path?access_token=secret&channel=name#state=abc',
  });
  const text = JSON.stringify(sanitized);
  assert.doesNotMatch(text, /top-secret|privatecreator|private chat text|abc123|access_token=secret|channel=name|state=abc/);
  assert.match(text, /REDACTED/);
});

test('diagnostics use session storage, cap entries, and exclude raw user agent', () => {
  const { context, storage } = loadDiagnostics();
  const Log = vm.runInNewContext('NerdSyncDiagnosticsLog', context);
  const log = new Log({ version:'Alpha-0.17.3', storage, navigatorRef:context.navigator, windowRef:context.window, maxEntries:2 });
  log.record({ message:'one' });
  log.record({ message:'two' });
  log.record({ message:'three' });
  assert.deepEqual(Array.from(log.entries(), entry => entry.message), ['two','three']);
  assert.ok(storage.getItem('nerdsync_diagnostics_v1'));
  const report = log.buildReport();
  assert.equal(report.environment.browser, 'Chrome');
  assert.equal(report.environment.os, 'Windows');
  assert.equal(report.environment.viewport, '430x800');
  assert.doesNotMatch(JSON.stringify(report), /private-detail/);
});

test('downloadable text report tells users to post in Nerdspace Labs Discord', () => {
  const { context, storage } = loadDiagnostics();
  const Log = vm.runInNewContext('NerdSyncDiagnosticsLog', context);
  const log = new Log({ version:'Alpha-0.17.3', storage, navigatorRef:context.navigator, windowRef:context.window });
  log.record({ area:'twitch-api', message:'Bearer secret-value failed', details:{ status:500 } });
  const text = log.toText({ activeSection:'discover', filterSummary:{ includedTagCount:1 }, scanSummary:{ failures:1 }, recentRequests:[{ time:'now', status:500, ms:12, target:'/helix/streams?user_id' }] });
  assert.match(text, /NerdSync - Diagnostics \/ Bug Log/);
  assert.match(text, /Version: Alpha-0\.17\.3/);
  assert.match(text, /#bug-reports channel in the Nerdspace Labs Discord/);
  assert.match(text, /Active section: discover/);
  assert.doesNotMatch(text, /secret-value/);
});

test('diagnostics UI is reachable from login, settings, and app footer', () => {
  assert.equal((html.match(/data-open-diagnostics/g) || []).length, 3);
  for (const id of ['diagnostics-dialog','diagnostics-close','diagnostics-preview','diagnostics-download','diagnostics-copy','diagnostics-clear']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Download TXT bug log/);
  assert.match(html, /#bug-reports/);
});

test('diagnostics loads immediately after foundation and is bundled in production', () => {
  const foundationIndex = html.indexOf('js/app-foundation.js?v=0.18.0');
  const diagnosticsIndex = html.indexOf('js/diagnostics.js?v=0.18.0');
  const twitchIndex = html.indexOf('js/twitch-api.js?v=0.18.0');
  assert.ok(foundationIndex >= 0 && diagnosticsIndex > foundationIndex && twitchIndex > diagnosticsIndex);
  assert.match(build, /'js\/diagnostics\.js'/);
  assert.match(build, /\(\?:diagnostics\|ui-state\|filters/);
});
