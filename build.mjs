import { transform } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const outAssets = path.join(dist, 'assets');
const appMetaSource = await readFile(path.join(root, 'js/app-meta.js'), 'utf8');
const versionMatch = appMetaSource.match(/version:\s*'([^']+)'/);
if (!versionMatch) throw new Error('Could not read NerdSync version from js/app-meta.js');
const version = versionMatch[1];

const jsSources = [
  'js/app-meta.js',
  'js/app-foundation.js',
  'js/diagnostics.js',
  'js/request-manager.js',
  'js/ui-state.js',
  'js/filters.js',
  'js/twitch-api.js',
  'js/discovery.js',
  'js/collaboration-fit.js',
  'js/creator-match.js',
  'js/recommendations.js',
  'js/discovery-tools.js',
  'js/creator-tools.js',
  'js/discovery-context.js',
  'js/feed-rendering.js',
  'js/twitchtracker-summary.js',
  'js/local-workflows.js',
  'js/data-portability.js',
  'js/stream-details.js',
  'js/app-controls.js',
  'js/secret-game.js',
  'js/session.js'
];

const cssSources = [
  ['styles', 'css/styles.css'],
  ['secret-game', 'css/secret-game.css']
];

function hashedName(base, extension, contents) {
  const hash = createHash('sha256').update(contents).digest('hex').slice(0, 8);
  return `${base}-${hash}.${extension}`;
}

await rm(dist, { recursive: true, force: true });
await mkdir(outAssets, { recursive: true });

// Source stays split for maintainability. Production concatenates the tested dependency
// order into one native ES-module runtime, avoiding a forest of global script tags while
// preserving the shared-scope architecture until the deeper 3.0 state refactor.
const concatenatedJs = (await Promise.all(
  jsSources.map(async file => `\n/* ${file} */\n${await readFile(path.join(root, file), 'utf8')}`)
)).join('\n;\n');

const jsResult = await transform(concatenatedJs, {
  loader: 'js',
  minify: true,
  target: 'es2020',
  format: 'esm',
  legalComments: 'none',
  sourcemap: false
});
const jsFile = hashedName('nerdsync-app', 'js', jsResult.code);
await writeFile(path.join(outAssets, jsFile), jsResult.code);

const cssFiles = {};
for (const [key, source] of cssSources) {
  const cssText = await readFile(path.join(root, source), 'utf8');
  const cssResult = await transform(cssText, {
    loader: 'css',
    minify: true,
    legalComments: 'none',
    sourcemap: false
  });
  const file = hashedName(key, 'css', cssResult.code);
  cssFiles[key] = file;
  await writeFile(path.join(outAssets, file), cssResult.code);
}

await cp(path.join(root, 'assets'), outAssets, { recursive: true });
for (const file of ['config.js', '_headers']) {
  await cp(path.join(root, file), path.join(dist, file));
}

let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html
  .replace(/href="css\/styles\.css\?v=[^"]+"/, `href="/assets/${cssFiles.styles}"`)
  .replace(/href="css\/secret-game\.css\?v=[^"]+"/, `href="/assets/${cssFiles['secret-game']}"`)
  .replace(/<script src="js\/app-meta\.js\?v=[^"]+" defer><\/script>/, `<script type="module" src="/assets/${jsFile}"></script>`)
  .replace(/\s*<script src="js\/(?:app-foundation|diagnostics|request-manager|ui-state|filters|twitch-api|discovery|collaboration-fit|creator-match|recommendations|discovery-tools|creator-tools|discovery-context|feed-rendering|twitchtracker-summary|local-workflows|data-portability|stream-details|app-controls|secret-game|session)\.js\?v=[^"]+" defer><\/script>/g, '');
await writeFile(path.join(dist, 'index.html'), html);

let guideHtml = await readFile(path.join(root, 'guide.html'), 'utf8');
guideHtml = guideHtml.replace(/href="css\/styles\.css\?v=[^"]+"/, `href="/assets/${cssFiles.styles}"`);
await writeFile(path.join(dist, 'guide.html'), guideHtml);

const manifest = {
  version,
  generatedAt: new Date().toISOString(),
  assets: {
    app: `/assets/${jsFile}`,
    styles: `/assets/${cssFiles.styles}`,
    secretGameStyles: `/assets/${cssFiles['secret-game']}`
  },
  sourceOrder: jsSources
};
await writeFile(path.join(dist, 'build-manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Built NerdSync Alpha-${version} into dist/`);
