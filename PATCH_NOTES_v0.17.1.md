# NerdSync Alpha-0.17.1 — Newer Affiliate Signals

- Renamed the Emerging affiliate lane to **Newer Affiliates** to avoid implying NerdSync knows an exact Affiliate-earned date.
- Eligibility requires current Twitch Affiliate status and a Twitch account under 365 days old.
- Added a bounded **Newer Affiliate signal** that combines account recency with optional TwitchTracker 30-day activity and follower-growth efficiency.
- Newer Affiliate cards now show the signal label, Twitch account age, current Affiliate status, and signal score.
- Historical labels can identify **Active newer Affiliate**, **Growing newer Affiliate**, or **Active + growing newer Affiliate** when the 30-day data supports it.
- Newer Affiliates are prioritized for Historical Discovery enrichment inside the Emerging feed so the limited TwitchTracker request budget is more useful.
- The Newer Affiliate sort now uses the Newer Affiliate signal by default, with Newest accounts still available.
- Details explicitly states that the Affiliate-earned date is unavailable.
- No new Twitch OAuth scope is required.
