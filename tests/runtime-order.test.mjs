import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const foundation = await readFile(new URL('../js/app-foundation.js', import.meta.url), 'utf8');
const filters = await readFile(new URL('../js/filters.js', import.meta.url), 'utf8');
const controls = await readFile(new URL('../js/app-controls.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');

test('shared debounce helper is defined before filters load', () => {
  assert.match(foundation, /function debounce\(fn, delay\)/);
  assert.doesNotMatch(filters, /function debounce\(fn, delay\)/);
  assert.doesNotMatch(controls, /function debounce\(fn, delay\)/);
  assert.ok(html.indexOf('js/app-foundation.js') < html.indexOf('js/filters.js'));
});

test('every authored button declares an explicit type', () => {
  const buttons = html.match(/<button\b[^>]*>/g) || [];
  assert.ok(buttons.length > 30);
  for (const button of buttons) assert.match(button, /\btype="(?:button|submit|reset)"/);
});

test('closed details disclosures hide authored grid and flex children', () => {
  assert.match(styles, /details:not\(\[open\]\) > :not\(summary\) \{ display:none !important; \}/);
});

test('narrow layouts collapse dense card and diagnostic actions safely', () => {
  assert.match(styles, /@media \(max-width:380px\)[\s\S]*?\.card-actions \{ grid-template-columns:1fr; \}/);
  assert.match(styles, /\.diagnostics-dialog \{[\s\S]*?width:min\(760px,calc\(100vw - 2rem\)\)/);
  assert.match(styles, /\.diagnostics-preview \{[\s\S]*?overflow-wrap:anywhere/);
});
