# NerdSync Alpha-0.16.1 - Node & Cloudflare Build Pipeline

Alpha-0.16.1 applies the production build and Wrangler deployment approach used by Wormhole while keeping NerdSync's browser-only Twitch architecture intact.

## Changes
- Added a Node/npm production workflow with an explicit Node 20+ requirement.
- Added Wrangler 4.125.0 and esbuild 0.25.9 as development dependencies.
- Added `npm run build`, `npm run check`, `npm run preview`, and `npm run deploy` commands.
- Added `wrangler.jsonc` using Cloudflare Workers Static Assets and the generated `dist/` directory.
- Added a production build that preserves NerdSync's current classic-script dependency order, then minifies it into one content-hashed JavaScript asset.
- Minifies both CSS files and writes content-hashed production filenames.
- Keeps `config.js` separate and unbundled so the public Twitch Client ID remains easy to configure without rebuilding application source.
- Generates `dist/build-manifest.json` for deployed asset inspection.
- Keeps source maps disabled in the public production output.
- Updates Cloudflare immutable caching rules to target the generated `/assets/*` files.
- Adds `.gitignore` rules for dependencies, build output, Wrangler state, and local environment files.

## Deployment
1. Use Node.js 20 or newer.
2. Run `npm install`.
3. Put the public Twitch Client ID in `config.js`.
4. Run `npm run check`.
5. Preview with `npm run preview` or deploy with `npm run deploy`.

For an existing Cloudflare Pages project, use `npm run build` as the build command and `dist` as the output directory instead of deploying the source folder directly.
