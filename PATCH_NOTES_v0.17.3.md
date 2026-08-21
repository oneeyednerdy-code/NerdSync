# NerdSync Alpha-0.17.3 — Stability + Diagnostics

## Filter reliability

- Moves the shared `debounce()` helper into the foundation script so filters cannot initialize before it exists.
- Rechecks all native quick-choice controls: tag presets, audience presets, language, uptime, recent activity, Twitch classifications, game genres, category include/exclude mode, restricted-chat filtering, Creator Match source/range, Following Twitch-team priority, and Emerging sorts.
- Preserves default-on restricted-chat exclusion after Clear All.

## Diagnostics / Bug Log

- Adds a privacy-safe diagnostics dialog accessible from the login footer, Settings, and the signed-in footer.
- Captures sanitized runtime errors, unhandled promise failures, Twitch API failures, TwitchTracker failures, scan totals, filter counts, and endpoint parameter names.
- Keeps up to 150 diagnostic events in the current browser session and falls back to memory when session storage is unavailable.
- Provides Preview, Copy log, Clear log, and **Download TXT bug log** controls.
- The text report tells users to post the file in `#bug-reports` in the Nerdspace Labs Discord with a short reproduction description.
- OAuth tokens, URL parameter values, chat content, raw user-agent strings, and creator/channel identities are redacted or excluded.

## Layout audit

- Tightens 320px card-action wrapping and diagnostics controls.
- Validated main app, filter sheet, diagnostics, and Field Guide at 1440, 1024, 768, 720, 430, 375, and 320 CSS pixels with no page-wide horizontal overflow or controls escaping the viewport.
