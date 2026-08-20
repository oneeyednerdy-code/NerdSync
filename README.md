# NerdSync

Current release: **Alpha-0.10.0**

NerdSync is a static, personalized Twitch discovery app for finding relevant live creators at every audience stage. It runs as plain HTML, CSS, and JavaScript on Cloudflare Pages with no server, database, client secret, package installation, or build command.

## Deploy on Cloudflare Pages

1. Register an application in the [Twitch Developer Console](https://dev.twitch.tv/console).
2. Add the exact production address as an OAuth redirect, such as `https://nerdsync.pages.dev/`.
3. Put the public Twitch Client ID in `config.js`. Never add a Client Secret to this project.
4. Upload the folder to Cloudflare Pages. Use no build command and use the folder containing `index.html` as the output directory.

OAuth uses Twitch's browser implicit flow with a cryptographically random state check. The app requests only `user:read:follows`. Tokens remain in session storage.

## Alpha-0.10.0 simplified navigation

- Seven peer-level feed tabs are replaced by four primary destinations: **Discover**, **Following**, **Match**, and **Saved**.
- For You, Hidden Gems, Emerging, and Established are now feed modes inside Discover instead of separate primary destinations.
- Following Live and Following Clips are combined under one Following destination.
- Creator Match now contains both audience matching and Find & Compare tools.
- Saved creators and the private discovery profile now have a dedicated destination instead of a temporary panel.
- Creator stage, Partner exclusion, category diversity, personalization, seen-history behavior, accessibility, diagnostics, privacy information, and logout are consolidated under Settings.
- Search, sorting, filters, and Try Someone New appear only where they are useful, reducing the controls shown before results.
- URL hash routes support browser Back/Forward behavior and direct links to destinations and feed modes.
- Mobile uses a fixed four-item bottom navigation with visible icons and text; primary destinations no longer depend on a horizontally scrolling tab strip.

## Alpha-0.9.0 NerdSync Discovery Graph

- **For You** now builds an explainable interest profile from categories and tags used by followed channels, explicit NerdSync category follows, and choices made inside NerdSync.
- Creator cards add **More like this**, **Less like this**, and **Follow category** feedback alongside Save, Hide, and Never Show.
- Opening details is a light positive signal; choosing **Watch on Twitch**, saving, or selecting More Like This is a stronger signal. Negative feedback reduces related category and tag weights.
- The default recommendation order blends strong matches, fresh discovery picks, and a limited number of exploration picks so the feed can learn without becoming a filter bubble.
- A private discovery profile shows the strongest locally learned categories and tags and can be reset at any time.
- Personalization can be disabled. Twitch follows and explicit filters still guide discovery, but NerdSync stops learning from user choices and ignores previously learned weights.
- Learned category interests now seed future directory scans, allowing useful interests to remain represented even when followed channels are offline.
- All recommendation history remains partitioned by Twitch account and stored only in the current browser. Twitch does not give NerdSync watch history or time watched.

See `DISCOVERY_ALGORITHM.md` for signals, weights, privacy boundaries, and future Worker migration guidance.

## Alpha-0.8.0 mobile discovery

- Phone-first discovery layout optimized around narrow 360–430 CSS-pixel screens, including devices such as the OnePlus Nord series.
- Horizontally scrollable, snap-aligned feed tabs keep all seven discovery panels available without wrapping them into cramped rows.
- Creator cards use a single readable column, 16:9 previews, larger text, and two-column touch actions.
- Discovery options collapse behind a dedicated mobile control while filters open as a full-height sheet with a dimmed backdrop.
- The mobile filter sheet supports focus containment, Escape dismissal, backdrop dismissal, focus return, safe-area insets, and scroll containment.
- Tool buttons scroll horizontally, comparison and settings layouts collapse cleanly, modals expand for small screens, and desktop behavior is unchanged.
- Fixed background effects are disabled on phones to reduce mobile scrolling and rendering overhead.

## Alpha-0.7.5 asset and JavaScript architecture

- The former single-file application has been split into cacheable CSS and ordered JavaScript assets.
- JavaScript is organized into core state/navigation, filters, Twitch API access, discovery logic, and rendering/session modules.
- Deferred scripts download in parallel and execute in dependency order after the HTML is parsed.
- Cloudflare Pages response headers cache versioned CSS and JavaScript assets while keeping `index.html` and `config.js` revalidated.
- The static app still requires no build command, framework, package installation, server, or database.

The script order in `index.html` is intentional: `app-core.js`, `filters.js`, `twitch-api.js`, `discovery.js`, then `ui-session.js`. Keep that order when adding future releases unless the shared state is migrated to native ES modules.

## Alpha-0.7.4 content labels and adult-oriented tags

- Live creator and Creator Match cards now display Twitch Content Classification Labels separately from creator-entered tags.
- NerdSync enriches live stream results from Twitch's channel-information endpoint in batches of up to 100 broadcasters, matching Wormhole's label handling.
- Filters can include streams matching any selected official label: politics and sensitive issues, drugs/intoxication, gambling, mature-rated games, profanity, sexual themes, or graphic violence.
- Suggested adult-oriented tag buttons add exact creator-entered tags for `MDNI`, `18Plus`, `AdultOnly`, `AdultsOnly`, and `MatureAudience`.
- Adult-oriented tags are discovery signals only. They do not prove a creator's age and do not function as an age gate.

## Alpha-0.7.3 privacy notice

- A privacy and necessary-storage notice now appears before Twitch login on first use.
- It explains that NerdSync never sells user data, does not share Twitch data with advertisers or data brokers, and gathers data only to build the user's own discovery experience.
- NerdSync does not use advertising or tracking cookies. It uses session storage for the Twitch token and local browser storage for settings, saved creators, discovery history, and recommendations.
- The acknowledgement is remembered locally, and the login screen provides a control to review the data promise again.
- The notice uses the same Wormhole-aligned login card, typography, spacing, violet glow, and control styling as the rest of the ecosystem.

## Alpha-0.7.2 visual alignment

- NerdSync now shares Wormhole's black-and-violet visual system: layered radial glows, deep panel surfaces, violet borders, restrained shadows, and raised controls.
- Space Grotesk is used for display and action text, Inter for body copy, and IBM Plex Mono for versions, filter labels, badges, and data-oriented details.
- Login, navigation, tabs, filters, creator cards, dialogs, buttons, and scrollbars now use the same spacing, radii, and interaction language.
- NerdSync retains its own wordmark and orbital discovery symbol rather than copying Wormhole's product identity.
- Primary actions retain the darker violet needed for readable white text, and Light, Dark, System, High Contrast, reduced-motion, keyboard, and touch-target behavior remain intact.

## Alpha-0.7.1 features

### Emerging Live hub

- **Emerging Live** now contains two stacked discovery sections with separate sort controls and shared NerdSync filters.
- **Standard Emerging Live** appears first and shows channels with 3–500 current viewers and accounts under two years old.
- **New Affiliates** appears underneath and shows currently live channels whose Twitch `broadcaster_type` is Affiliate and whose account was created less than 365 days ago.
- New Affiliates has no built-in viewer ceiling; global viewer controls remain available when the user wants one.
- Followed channels and the logged-in creator are excluded so the section remains discovery-oriented.
- Selected categories are prioritized, top Twitch categories fill remaining scan slots, and category diversity is retained.
- Sort by Discovery Fit, newest account, or the global low-to-high/high-to-low viewer controls.
- Creators eligible for New Affiliates are shown only in that section, preventing duplicate cards across both sections.
- Twitch does not expose the date a channel earned Affiliate. This section verifies Affiliate status and account age, but never claims the creator became an Affiliate within the last year.

## Alpha-0.6.0 accessibility and appearance

### Accessibility and appearance

- Light, Dark, and System appearance choices. System follows the device color-scheme preference; a manual choice remains selected until reset.
- Normal, Large, and Extra Large interface sizes, plus optional larger stream cards.
- Higher-contrast mode works in both light and dark themes.
- User-controlled reduced motion plus automatic support for the device `prefers-reduced-motion` setting.
- Skip-to-content navigation, a main landmark, clearer dialog descriptions, live loading/result announcements, and descriptive creator-card actions.
- Arrow-key navigation between feed tabs, with Home and End shortcuts.
- Stream-detail dialogs trap focus while open, close with Escape, make the background inert, and return focus to the control that opened them.
- Controls use larger touch targets, layouts reflow earlier for zoom and narrow screens, and Windows forced-colors mode receives explicit structural borders.
- Existing Alpha-0.5.0 accessibility preferences are migrated where possible; the old Larger Text setting becomes Large interface size.

Accessibility preferences remain browser-local and partitioned by the logged-in Twitch account.

## Alpha-0.5.0 discovery features

### Personalized discovery

- **For You** blends live creators across five transparent audience stages instead of enforcing a small-stream ceiling.
- Creator stages are New & Niche (0–20), Growing (21–100), Breakout (101–500), Established (501–5,000), and Headliner (5,001+ current viewers).
- The Balanced Mix default reserves repeated positions for every stage so larger channels cannot consume the entire feed and smaller creators retain meaningful visibility.
- Users can select any creator stage, show all creators, or sort the resulting feed from low-to-high or high-to-low current viewers.
- **Spotlight** provides a dedicated discovery panel for Established and Headliner creators while excluding channels already followed.
- **Creator Match** finds live networking peers within ±50%, ±75%, or ±100% of the logged-in creator's current audience or a manually entered past peak.
- A past VOD can be selected as context alongside an entered peak; the VOD play count is never misrepresented as a live peak.
- Selected categories are prioritized, followed-channel interests are used as seeds, and top Twitch categories fill remaining gaps.
- Followed channels and the logged-in creator are excluded from discovery feeds.
- Discovery Fit scores combine selected categories and tags, learned interests, preferred audience size, language, novelty, recent activity, and broadcaster status.
- Every scored card explains why it appeared.
- **Try Someone New** selects the strongest eligible creator who has not already been opened or tried.

Learning is stored locally for each Twitch account. Save and Open actions increase related category/tag preferences. Less Like This, Hide, and Never Show actions reduce them. Users can reset recommendations at any time.

### Feed and filter controls

- Spotlight, Hidden Gems, Emerging Live, Following, and Following Clips panels.
- Low-to-high and high-to-low view sorting.
- Partner exclusion across all panels.
- Category diversity balancing.
- Included and excluded Twitch tags, popular tag buttons, language, viewer range presets, genres, and included/excluded Twitch categories.
- Maximum current stream uptime.
- Optional recent archived-VOD activity check.
- Optional Open Chat Only check that excludes follower-only, subscriber-only, and emote-only channels among the strongest 40 candidates.

Detailed chat and activity checks are capped, concurrency-limited, and cached for 30 minutes. Channels with VODs disabled cannot satisfy the archived-VOD filter even when they stream regularly.

### Creator tools

- Match from the logged-in channel's live audience and category when currently live.
- Match from a manually entered historical peak, optionally associated with one of the creator's recent archived broadcasts.
- Refine networking matches with the existing category, genre, included/excluded tag, language, open-chat, uptime, audience, and Partner controls.
- Search Twitch directly by channel name, including offline channels.
- Save search results or add them to a two-channel comparison.
- Compare live status, viewers, category, broadcaster status, chat openness, recent broadcasts, recent clips, last archived broadcast, account date, tags, and Discovery Fit.
- Add discovery cards or previewed creators to the comparison.

### Saved and repeat controls

- Save and unsave creators.
- Show saved creators only.
- Hide creators already seen during the last seven days.
- Hide a creator for 30 days, permanently hide them, or request fewer similar recommendations.
- Clear seen history, restore hidden creators, and reset learned recommendations.

Saved state, recommendation history, and accessibility settings are partitioned by the logged-in Twitch user and remain only in that browser.

### Accessibility

- Normal, Large, and Extra Large interface sizing.
- Larger stream cards.
- Light, Dark, and System themes.
- Higher contrast in both light and dark modes.
- Reduced motion, including automatic device-preference support.
- Keyboard-operable cards, tabs, controls and dialogs; visible focus states; descriptive labels; live result announcements; and text indicators that do not depend on color alone.

### Diagnostics

Scan Details reports categories, directory pages, candidates, eligible streams, detailed checks, partial failures, request totals, and Twitch rate-limit headroom. The downloadable text report includes app version, active panel, non-identifying filter counts, browser information, response codes, timings, and endpoint parameter names. Tokens and parameter values are deliberately omitted.

## Important limitations

- Twitch does not expose follower totals for arbitrary channels to this static app. NerdSync cannot truthfully enforce a 0–1,000-follower rule and never substitutes viewer counts for followers.
- Creator-stage labels describe only the channel's current live audience. They are not follower counts, historical averages, or judgments about creator quality.
- Twitch reports a VOD's total recorded-video plays but does not expose that broadcast's peak concurrent viewers. Creator Match therefore requires a manually entered past peak unless the logged-in channel is currently live.
- Emerging Live is an explainable proxy based on account age, live audience, and broadcaster status—not measured follower or viewer growth.
- Emerging Live currently samples 3–500 live viewers and accounts up to two years old. Its score favors newer accounts, an audience near 75 viewers, and non-Partner status.
- New Affiliates uses account creation date, not Affiliate-earned date, because Twitch does not expose Affiliate history through Helix.
- Activity checking relies on archived VODs. A channel that disables VODs may appear inactive.
- Detailed checks cover the strongest 40 candidates per load to protect responsiveness and API limits.
- Browser-local preferences do not synchronize across devices.

True historical momentum and cross-device synchronization would require an optional Cloudflare Worker and database in a future Beta release.

## Version convention

Versions use `Alpha-MAJOR.MINOR.PATCH` during alpha development. Increment PATCH for fixes, MINOR for backward-compatible feature releases, and MAJOR for substantial or breaking changes. Keep this README and the login badge synchronized.
