# NerdSync

A single-page Twitch dashboard: log in with your Twitch account and see which
channels you follow are live right now, or browse what's trending.

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
> front-end code — if you build a companion backend later, keep the secret there.

## What changed from the first draft

The original had a working login screen but the "dashboard" it promised was
never actually built. This pass makes it do what the README claimed:

- **Client ID is no longer duplicated.** It previously lived in both
  `config.js` (unused) and hardcoded directly in `index.html` — and the copy in
  `index.html` was a real, checked-in ID rather than the placeholder the README
  described. Now `config.js` is the single source of truth and ships with a
  placeholder.
- **Streams actually load.** The stream grid was empty markup with a comment
  promising future JS. It now calls the Twitch Helix API for two real views:
  *Following* (your live followed channels) and *Discover* (top live streams),
  with a client-side filter by streamer or game.
- **Sessions survive a refresh.** The access token is now kept in
  `sessionStorage` and re-validated against Twitch's `/oauth2/validate`
  endpoint on load, instead of being lost the moment the page reloads.
- **Added a logout button**, loading/empty/error states, and a config guard
  that disables the login button with a clear message if no Client ID has
  been set yet.
- **Fixed inconsistent branding** ("NerdSync" vs. the login screen's
  "StreamVerse") and added alt text and visible focus states for accessibility.

## Notes / next steps

- Implicit Flow tokens expire (Twitch tokens are typically valid for a few
  hours) and this app doesn't refresh them — when one expires, the user is
  simply asked to log in again on their next action. If you outgrow that,
  Twitch recommends server-side Authorization Code flow with PKCE for
  longer-lived sessions.
- "Multi-user" here means every visitor authenticates as themselves — there's
  still no shared backend or database, so nothing is synced *between* users.
  If you want that, you'll need a small server component.
