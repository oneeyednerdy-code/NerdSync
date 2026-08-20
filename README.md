# NerdSync

Current release: **Alpha-0.0.4**

Version labels use `Alpha-MAJOR.MINOR.PATCH` while the app is in alpha. Increment PATCH for fixes, MINOR for backward-compatible features, and MAJOR for substantial or breaking changes. Keep the login-page badge and this README value synchronized for every release.

NerdSync is a static, Cloudflare Pages-ready Twitch discovery app focused on smaller live creators. It has no build step, server, database, client secret, or third-party dependency.

## Deploy on Cloudflare Pages

1. Register an app in the [Twitch Developer Console](https://dev.twitch.tv/console).
2. Add the exact production URL as an OAuth redirect, such as `https://nerdsync.pages.dev/`.
3. Put the public Twitch Client ID in `config.js`. Never put a Client Secret in this project.
4. Upload this folder to Cloudflare Pages. Use no build command and set the output directory to `/` (or the folder containing `index.html`).

OAuth uses Twitch's browser-based implicit flow with a cryptographically random `state` check. The only requested scope is `user:read:follows`. Tokens stay in session storage and local discovery preferences stay in that browser.

## Discovery feeds

- **For You** (default) prioritizes selected categories, then categories played by live followed channels, then top Twitch categories. It follows Twitch cursors and scans up to eight directory pages per category until it finds enough channels with 0–75 live viewers. Followed channels and the logged-in creator are excluded.
- **Hidden Gems** scans up to five pages in eight relevant categories for channels with 1–75 viewers, excluding every fetched followed channel.
- **Emerging Live** scans selected and top categories for channels with 3–500 current viewers, then ranks account recency, audience fit, and broadcaster status. It is an explainable discovery score, not measured growth.
- **Following** shows followed channels currently live.
- **Following Clips** shows recent clips from up to 20 followed channels.

## Controls

- Sort view counts low-to-high or high-to-low on every panel.
- Exclude Twitch Partners on every panel.
- Balance each result page across categories.
- Hide creators seen in the last seven days, show saved creators only, save a creator, or dismiss one for 30 days. This history is stored locally and partitioned by Twitch user.
- Include tags, exclude tags, select stream language, use audience presets or custom min/max values, include/exclude categories, and use Wormhole's eight genre groups.
- Open **Scan details** to see categories, pages, candidates, eligible results, partial failures, API request count, and Twitch rate-limit headroom.

Card explanations show why a creator appeared. Clicking a live card opens a preview with recent VODs, clips, schedule, and a link to Twitch.

## Important follower-count limitation

Twitch does not let a static third-party app obtain follower totals for arbitrary channels. `Get Channel Followers` requires `moderator:read:followers`, and the logged-in user must own or moderate the requested channel. NerdSync therefore cannot truthfully enforce “0–1,000 followers” on Cloudflare Pages alone and does not mislabel viewer counts as followers.

A true follower-growth feed would require an authorized backend or licensed data source. This release stays fully static and labels the proxy feed **Emerging Live**.

## Reliability notes

- Pagination stops only when Twitch omits the cursor; a short page is not treated as the end.
- Independent category requests use partial-result handling, so one failed directory does not blank the whole feed.
- A 429 response is retried once after a short rate-limit-aware wait.
- A 401 produces a clear expired-session message.
- Tab results are cached for three minutes; the refresh button clears the current tab and followed-channel caches.
