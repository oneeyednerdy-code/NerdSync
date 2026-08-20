# NerdSync

A single-page Twitch dashboard: log in with your Twitch account, browse six
different discovery views, filter and paginate them, and click into any
streamer for a detail preview before deciding whether to open their channel.

## Setup

1. Register an app at the [Twitch Developer Console](https://dev.twitch.tv/console).
2. Add this page's exact URL (including protocol and path) as an **OAuth Redirect URL**
   on that app — e.g. `http://localhost:3000/` or `https://yoursite.pages.dev/`.
3. Open `config.js` and replace `"YOUR_TWITCH_CLIENT_ID_HERE"` with your app's
   **Client ID**.
4. Serve `index.html` (Cloudflare Pages, GitHub Pages, or any static host — it
   needs no backend and no build step).
5. Visitors log in with their own Twitch account via OAuth Implicit Flow; no
   credentials ever touch your server.

> **Security note:** Implicit Flow only ever needs the public **Client ID** in
> the browser. Never put a Client **Secret** in `config.js` or anywhere in
> front-end code.

## Tabs

- **Following** — channels you follow that are live right now.
- **Teammates** — Twitch doesn't let apps see who another streamer follows
  (that's private to the account owner), so this uses the closest real
  substitute: live members of official Twitch Teams that your followed
  streamers belong to.
- **Hidden Gems** — small channels (under 75 viewers) playing the same games
  your followed streamers are currently live in.
- **Rising Stars** — channels playing today's top categories whose Twitch
  *account* was created in the last 30 days. **Important caveat:** Twitch's
  API has no "first stream" field — account-creation date is the closest
  available proxy for "new channel," so this will both miss genuinely new
  streamers (who made their account years before they started) and include
  brand-new accounts that aren't new to streaming elsewhere. Treat it as a
  rough cut. A status filter (All / Non-affiliate / Affiliate / Partner, from
  Twitch's own `broadcaster_type` field) and a sort toggle (most viewers /
  longest uptime) sit above the grid.
- **Clips** — the last 30 days of clips from up to 20 of your followed
  channels (live or not), sortable by most-viewed or newest.
- **Discover** — small channels (under 75 viewers) across today's top Twitch
  categories generally, not just categories your follows happen to be in.

## Filters

Following, Teammates, Hidden Gems, Rising Stars, and Discover all share one
filter panel (hidden by default — click **Filters** to open it, and it closes
independently on every tab):

- **Tag** — free-text match against each stream's live Twitch tags.
- **Genre** — Horror / MMO / RPG / Shooter / Creative pills. This is a
  **curated keyword match against Twitch's own category names**, not a real
  IGDB genre lookup — IGDB's API requires a Client Secret to authenticate,
  and a secret can never safely live in front-end code (anyone viewing the
  page source could take it). If you later add a small backend, swapping in
  real IGDB genre data would be a clean upgrade.
- **Min / Max viewers** — type in a range.
- **Followed for at least (days)** — Following tab only, computed from
  Twitch's `followed_at` timestamp for each channel.

Clips has its own sort control (most-viewed / newest) instead of this panel,
since clips don't have viewer counts, tags, or a follow-age concept.

## Pagination

All grids show 12 results per page with Prev/Next controls beneath. Changing
tabs, filters, search, or sort resets you to page 1.

## Streamer detail view

Clicking a stream card (not a clip card) opens a modal instead of navigating
away, showing the title, category, live status, tags, and:

- **Recent Broadcasts** — the streamer's last 3 archived VODs (Twitch has no
  separate "past streams" endpoint, so this uses `Get Videos` filtered to
  `type=archive`, which is the real equivalent).
- **Recent Clips** — their top 3 clips by views from the last 30 days.
- **Upcoming Schedule** — up to 3 segments from Twitch's Stream Schedule
  feature, when the streamer has one published. Many streamers don't use
  this feature, in which case it'll say so rather than showing nothing
  silently.

A **Watch on Twitch** button opens the channel in a new tab. Ctrl/Cmd/Shift/
middle-click on a card still opens Twitch directly, bypassing the modal, for
anyone who wants the old one-click behavior.

## Branding

No Twitch glyph/icon anywhere — just a text wordmark, "Nerd" in the accent
purple and "Sync" in white, on both the login screen and the in-app header.

## Caching & refresh

Teammates, Hidden Gems, Rising Stars, and Clips can each fire a dozen-plus
Helix API calls per load. Each tab's result is cached in memory for 3
minutes; the refresh icon next to the search box forces a fresh pull for the
current tab and clears the underlying followed-streams/followed-channels
caches too. The stream detail modal caches its per-streamer data (videos,
clips, schedule) for 5 minutes so reopening the same streamer is instant.
None of this is persisted to disk — it's all in-memory JS state, so it resets
on reload or logout.

## Performance & modern JS notes

- All filter/search text inputs are debounced (300ms) so typing doesn't
  re-render on every keystroke.
- Card clicks use a single delegated listener on the grid container rather
  than one listener per card, so re-rendering a page of cards never leaks or
  re-attaches handlers.
- API calls that can partially fail (fetching teams for 8 streamers, clips
  for 20 channels, etc.) use `Promise.allSettled` so one failed request
  doesn't blank out the whole tab.
- Images use `loading="lazy"` and `decoding="async"`.
- This ships as a single unbuilt HTML file by design — no bundler, no
  dependencies to audit or update. Cloudflare Pages serves it with Brotli
  compression automatically, so there's no separate "minify" step needed for
  transfer size. If the file grows much further, splitting the script into a
  separate `app.js` (cacheable independently of `index.html`) and adding a
  minimal build step (e.g. esbuild) would be the next reasonable step — not
  needed yet at this size.

## Known limitations, stated plainly

- No literal "streamers your streamers follow" feature — Twitch's API
  doesn't expose another account's follow list to third-party apps.
- Rising Stars' 30-day window is against account age, not first-stream date,
  for the reasons above.
- Implicit Flow tokens expire in a few hours and aren't refreshed — the app
  asks the user to log back in when that happens, rather than silently
  failing.
- "Multi-user" means every visitor authenticates as themselves; there's
  still no shared backend, so nothing syncs *between* users.
