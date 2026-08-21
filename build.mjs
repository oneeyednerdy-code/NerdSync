import { transform } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const outAssets = path.join(dist, 'assets');
const version = '0.16.4';

const jsSources = [
  'js/app-foundation.js',
  'js/ui-state.js',
  'js/filters.js',
  'js/twitch-api.js',
  'js/discovery.js',
  'js/recommendations.js',
  'js/creator-tools.js',
  'js/feed-rendering.js',
  'js/twitchtracker-summary.js',
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

// NerdSync's source files are intentionally classic deferred scripts that share
// one global scope. Concatenate them in the exact HTML dependency order before
// minifying so production behavior stays identical without converting the app
// to ES modules yet.
const concatenatedJs = (await Promise.all(
  jsSources.map(async file => `\n/* ${file} */\n${await readFile(path.join(root, file), 'utf8')}`)
)).join('\n;\n');

const jsResult = await transform(concatenatedJs, {
  loader: 'js',
  minify: true,
  target: 'es2020',
  format: 'iife',
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
  .replace(/<script src="js\/app-foundation\.js\?v=[^"]+" defer><\/script>/, `<script src="/assets/${jsFile}" defer></script>`)
  .replace(/\s*<script src="js\/(?:ui-state|filters|twitch-api|discovery|recommendations|creator-tools|feed-rendering|twitchtracker-summary|stream-details|app-controls|secret-game|session)\.js\?v=[^"]+" defer><\/script>/g, '');
await writeFile(path.join(dist, 'index.html'), html);

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
