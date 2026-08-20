# Recommended next improvements

The strongest next step is optional infrastructure, not more client-side guessing:

1. Add an opt-in Cloudflare Worker + D1 pipeline for daily audience snapshots. This enables real 7-day/30-day momentum and repeat-appearance controls across devices.
2. Move login to Authorization Code + PKCE in a Worker if refreshable sessions are needed.
3. Add recent-VOD activity enrichment in a rate-limited queue so abandoned channels can be filtered without slowing the first feed render.
4. Learn category/tag weights from explicit Save, Dismiss, and Watch actions. Keep this on-device unless users opt into sync.
5. Add a small creator preview clip directly on feed cards after testing bandwidth and autoplay accessibility.

These are deliberately not bundled into the current release so it remains deployable as plain files on Cloudflare Pages.
