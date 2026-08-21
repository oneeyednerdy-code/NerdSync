# NerdSync

Current release: **Alpha-0.18.0**


## Alpha-0.18.0 Creator Match 2.0 + No-D1 Discovery Toolkit

- Rebuilds Creator Match around five editable audience sources: **Live now**, **30D typical**, **Last stream**, **Past broadcast**, and **Custom**.
- Loads recent Twitch archived VOD metadata for context, but never treats VOD `view_count` as concurrent live audience. Last/Past Broadcast use the TwitchTracker 30-day typical audience only as an editable suggestion until NerdSync 3.0 can support opt-in persisted stream history.
- Adds candidate audience comparison by **Live** or **30D typical**, with bounded TwitchTracker lookups only when Typical mode is requested.
- Adds separate **Required**, **Preferred**, and **Excluded** Creator Match tags plus plain-language match reasons and exclusion counts.
- Adds progressive match expansion from ±50% to ±75% to ±100%, followed by a broader category search when the initial pool is thin.
- Adds local Creator Match history, local shortlist, up-to-four creator comparison, Maybe/Watch later/Possible raid marks, and TXT/CSV/JSON exports.
- Adds local named Discovery filter presets and shareable filter URLs containing filter choices only—never the Twitch token or Twitch identity.
- Adds Discovery preferred tags, selectable **Live vs 30D typical** audience filtering, 30-day streamed-hour filters, and recent-growth filters.
- Adds category opportunity/stability context, filter-exclusion explanations, staged loading, partial Twitch results before historical enrichment when safe, per-card/global 30-day retries, and a visible TwitchTracker availability indicator.
- Adds keyboard shortcuts: `/` focuses search, `F` opens filters, `S` saves the focused creator card, and `B` cycles local bookmark labels.
- Keeps Alpha-0.18.0 deliberately **database-free**. No D1 binding, persistent cloud profile, cross-device sync, or background stream tracking is introduced. Those capabilities are reserved for the 3.0 architecture.
- Re-prompts the one-time privacy acknowledgement for this release because Creator Match 2.0 can request the signed-in channel's public 30-day TwitchTracker summary and Typical candidate mode can request limited candidate summaries.

## Alpha-0.17.3 Stability + Diagnostics

- Fixes a startup-order bug where `filters.js` could call `debounce()` before the helper existed, leaving filter controls visible but unwired in affected loads.
- Audits every quick-choice filter control and keeps the real filter state synchronized with its visible/`aria-pressed` state.
- Adds a Wormhole-style **Diagnostics / Bug Log** tool available from login, Settings, and the app footer.
- Records a capped, privacy-safe browser-session log of runtime errors plus sanitized Twitch/TwitchTracker request failures; diagnostics fall back to memory if session storage is unavailable.
- Downloads a plain-text NerdSync bug log and tells users to post it in `#bug-reports` in the Nerdspace Labs Discord with a short description of what they clicked before the problem.
- Excludes OAuth tokens, URL parameter values, chat content, raw user-agent strings, and creator/channel identities from the report.
- Tightens narrow-screen card actions and diagnostics layout so controls do not overlap or clip at 320px-wide mobile layouts.
- Browser layout/interaction audit passes at 1440, 1024, 768, 720, 430, 375, and 320 CSS pixels with no page-wide horizontal overflow.

## Alpha-0.17.2 Creator Match TwitchTracker link

- Adds a **TwitchTracker stats** action directly to Creator Match cards.
- Opens the creator's public TwitchTracker profile in a new tab for deeper historical statistics.
- Keeps NerdSync Details available for the summarized 30-day context already loaded through NerdSync's proxy.
- The direct profile link never includes a Twitch OAuth token or private NerdSync data.

## Alpha-0.17.1 Newer Affiliate signals

- Emerging now labels the current-Affiliate/newer-account lane as **Newer Affiliates** instead of implying NerdSync knows an Affiliate-earned date.
- Eligibility still requires current Twitch Affiliate status and a Twitch account under 365 days old.
- Historical Discovery can strengthen the Newer Affiliate signal using 30-day streamed hours and follower-growth efficiency from TwitchTracker.
- Cards show the account-age context, current Affiliate status, and a bounded 0–100 Newer Affiliate signal.
- The signal never claims an exact Affiliate date; Twitch does not expose that date through the data NerdSync uses.


## Alpha-0.17.0 Historical Discovery

- Adds an optional **Historical Discovery context** setting, enabled by default and stored with the user's local NerdSync preferences.
- After Twitch builds and filters a Discovery candidate pool, NerdSync enriches at most **20 strong creator candidates** with TwitchTracker 30-day channel summaries and at most **6 category IDs** with TwitchTracker category summaries.
- Shows **Live now**, **30d avg**, **30d growth**, and **30d active** directly on enriched Discovery cards while keeping Twitch's live viewer count visually and logically separate from historical data.
- Adds context labels such as **Hot right now**, **Quiet right now**, **Near typical**, **Rising gem**, and **Steady gem** when the underlying numbers support them.
- Uses the 30-day average as the preferred audience-size reference when calculating personalized audience fit, reducing the effect of a single unusually high or low live moment.
- Adds bounded historical activity/growth bonuses to Discovery Fit and Emerging scores without directly rewarding high TwitchTracker rank or simply having a larger average audience.
- Adds category context using TwitchTracker's documented 30-day category endpoint when available, including average category viewers and average live channels.
- Expands Details so Discovery cards can show full 30-day channel/category context; Creator Match continues to load TwitchTracker on demand.
- Extends the Cloudflare Worker/Pages Functions boundary with `/api/twitchtracker-category-summary`. Twitch OAuth is never forwarded to either TwitchTracker endpoint.
- Increases browser and Cloudflare edge caching for public TwitchTracker summaries to **six hours**, with a one-hour negative cache for unavailable lookups, to reduce repeated third-party requests.
- Bumps the privacy acknowledgement version because automatic limited TwitchTracker enrichment is a material network-behavior change.


## Alpha-0.16.6 Creator Match + Cloudflare runtime

- Shows each Creator Match channel's Twitch tags directly on the match card.
- Highlights selected discovery tags with a check mark using case-insensitive exact matching, and orders matching tags before the creator's other tags.

- Adds Wormhole-style on-demand TwitchTracker 30-day summaries to Creator Match Details.
- Shows available average viewers, peak viewers, streamed hours, hours watched, follower gain, and TwitchTracker rank without using those third-party values to alter NerdSync's matching algorithm.
- Sends only the public Twitch channel login through NerdSync's same-origin Cloudflare endpoint; Twitch OAuth tokens are never forwarded to TwitchTracker.
- Keeps TwitchTracker supplemental: errors do not block Twitch API details, Creator Match results, clips, VODs, or schedules.
- Adds the same Node/npm production workflow and Wrangler 4 deployment pattern now used by Wormhole.
- Requires Node.js 20 or newer and pins Wrangler 4.125.0 plus esbuild 0.25.9 as development dependencies.
- Keeps the readable modular source files, then builds a production `dist/` directory with minified, content-hashed JavaScript and CSS.
- Preserves NerdSync's classic deferred-script dependency order by concatenating the source in that same order before production minification.
- Keeps `config.js` outside the application bundle so the public Twitch Client ID remains easy to configure.
- Supports `npm run build`, `npm run check`, `npm run preview`, and `npm run deploy`.
- Cloudflare Pages can still host NerdSync by using `npm run build` and `dist`; Wrangler can also deploy the same `dist/` output as Workers Static Assets.

## Alpha-0.16.0 modular JavaScript architecture

- Replaces the two broad application scripts with focused modules for foundation state, controls, local UI state, recommendations, creator tools, feed rendering, stream details, and session startup.
- Keeps every JavaScript file below 25 KB and 425 lines in the unminified source release.
- Preserves deferred dependency ordering in source. Alpha-0.16.3 now turns that ordered source into a minified production bundle during `npm run build`.
- Uses versioned asset URLs so Cloudflare and browsers can cache unchanged modules independently between releases.

## Alpha-0.15.0 discovery quality and performance

- Hidden Gems now rotates candidates across 1–5, 6–20, and 21–75 current-viewer lanes instead of centering its score near 25 viewers.
- Discovery panels begin with a fast two-page category scan. **Scan Deeper** expands the active panel to its full directory-page limit only when requested.
- Moving to another panel cancels the abandoned scan instead of allowing stale Twitch requests to keep running.
- The earlier New Affiliates label was clarified because Twitch exposes current Affiliate status and account creation date, not the date Affiliate was earned. Alpha-0.17.1 now calls this lane **Newer Affiliates** and can add optional historical activity/growth context.
- Opening Details no longer teaches the recommendation profile. Watch, Save, More Like This, Less Like This, Hide, and Never Show carry clearer intentional weights.
- Preferred audience size now uses the median of recent positive samples rather than an average that could be distorted by a few large channels.

## Alpha-0.14.1 shared project footer

- Adds Wormhole's Ko-fi support destination and **Project by OneEyedNerdy** credit to the NerdSync login screen.
- Adds the same project credit and links to the signed-in footer shown beneath Discover, Following, Creator Match, and Saved.
- Keeps external links accessible, touch friendly, and isolated with `noopener noreferrer`.

## Alpha-0.14.0 human story

- Rewrites GHOST SIGNAL as a human story about Vesper, 312 people trapped beneath Ward Nine, and a city being asked to remember people it was told were dead.
- Removes creators, streaming, discovery rankings, and platform commentary from the narrative.
- Removes the `.txt` download completely. Winning endings display only the reward, run profile, and cryptic final directive on screen.
- Resets local game progress for the new story while preserving the three endings and Golden Match Signal reward.

## Alpha-0.13.0 human conspiracy story

- Rewrites GHOST SIGNAL as an entirely human cyber-noir conspiracy involving missing pirate broadcaster Vesper, Helix Media’s visibility blacklist, and an underground creator relay.
- Removes the sentient system, synthetic-consciousness plot, predictive core, and human-machine ending.
- Preserves three meaningful endings, downloadable winning records, the cryptic final directive, and the Golden Match Signal reward.
- Starts the rewritten story with a fresh local progress record so endings from the earlier narrative are not counted automatically.

## Alpha-0.12.2 final directive

- Removes Discord role claims and ending codewords from GHOST SIGNAL.
- Winning records now close with a single cryptic final directive and retain no reward-claim mechanism.

## Alpha-0.12.1 Discord winner codewords

- Adds a themed Discord role codeword to every downloadable GHOST SIGNAL winning record.
- Each ending has a different codeword and the record tells the winner where to post it to request the special role.
- Codewords are an honor-system community reward, not secure proof; a browser-only static app cannot keep a browser-delivered secret.

## Alpha-0.12.0 supporter footer and signal records

- Adds a Wormhole-aligned Nerdspace Labs sponsorship footer with the same five Ko-fi tiers, shared benefits, one-time support, transparency, and independence promises.
- Keeps support separate from discovery ranking, recommendations, and free access.
- Every recovered GHOST SIGNAL ending can export a private, credential-free `.txt` signal record from its ending screen.
- Keeps **Secret Find** as the understated final utility link in the signed-in footer.

NerdSync is a personalized Twitch discovery app for finding relevant live creators at every audience stage. The browser experience remains plain HTML, CSS, and JavaScript with no user database or Twitch client secret. Alpha-0.18.0 uses small stateless Cloudflare endpoints to proxy public TwitchTracker 30-day channel/category summaries when requested by Historical Discovery or Creator Match; Twitch OAuth is never forwarded.

## Build and deploy on Cloudflare

1. Install Node.js 20 or newer. Cloudflare recommends using a currently supported LTS Node release for Wrangler.
2. Run `npm install`.
3. Register an application in the [Twitch Developer Console](https://dev.twitch.tv/console).
4. Add the exact production address as an OAuth redirect. This may be a `pages.dev`, `workers.dev`, or custom-domain URL depending on how NerdSync is deployed.
5. Put the public Twitch Client ID in `config.js`. Never add a Client Secret to this project.
6. Run `npm run check`. This rebuilds the production `dist/` directory.

For an existing **Cloudflare Pages** project, set the build command to `npm run build` and the build output directory to `dist`. Do not deploy the source directory directly anymore.

For **Wrangler / Workers Static Assets**, run `npm run preview` for local preview and `npm run deploy` to deploy the generated `dist/` directory using `wrangler.jsonc`. Alpha-0.18.0 includes `worker.js` so `/api/twitchtracker-summary` and `/api/twitchtracker-category-summary` run before static assets while every other request falls through to the `ASSETS` binding. There is intentionally no D1 binding in this release.

For an existing **Cloudflare Pages** project, keep the root-level `functions/api/twitchtracker-summary.js` and `functions/api/twitchtracker-category-summary.js` files in the repository. Pages Functions are discovered from the project-root `functions/` directory, not from `dist/`.

OAuth uses Twitch's browser implicit flow with a cryptographically random state check. The app requests only `user:read:follows`. Tokens remain in session storage.

## Alpha-0.11.1 Secret Find entry

- GHOST SIGNAL now opens exclusively from the **Secret Find** link in the signed-in NerdSync footer.
- Removes the repeated-logo, typed-word, and keyboard-combination activation methods.
- The footer entry remains keyboard operable, screen-reader accessible, touch friendly, and visually understated.

## Alpha-0.11.0 GHOST SIGNAL

- Adds an original hidden cyber-noir branching story with three endings: Open Signal, Golden Ghost, and Human Frequency.
- The game is entered through the accessible Secret Find footer link.
- Game choices are keyboard operable; the dialog contains focus, closes with Escape, supports reduced motion and forced colors, and returns focus when dismissed.
- Ending progress is stored locally per signed-in Twitch account. Replaying can recover all three endings.
- Recovering any ending unlocks a gold-bordered Golden Match Signal profile card inside Creator Match.
- The achievement is deliberately described as local. Other users cannot see it unless NerdSync later adds an opt-in shared profile backend.

See `GHOST_SIGNAL.md` for activation, endings, accessibility, persistence, and reward boundaries.

## Alpha-0.10.2 visual alignment and spacing

- Replaces the orbital mark with NerdSync's single-color purple brain-and-circuit SVG across the privacy screen, login screen, and compact app header.
- Introduces a consistent spacing scale for panels, toolbars, control groups, cards, chips, action areas, search tools, comparisons, diagnostics, and dialogs.
- Separates grouped controls with clearer padding and prevents headings from inheriting unwanted margins inside panel headers.
- Replaces horizontally scrolling mobile action rows with wrapping, evenly spaced layouts so controls never depend on cramped side-by-side placement.
- Adds dedicated modal action layout, roomier mobile cards, safer narrow-phone navigation padding, and better separation between result actions.
- Removes one-off inline presentation styles. The Cloudflare Content Security Policy no longer needs `style-src 'unsafe-inline'`.

## Alpha-0.10.1 security hardening

- Ports the applicable security protections from Wormhole while preserving NerdSync's static browser-only architecture.
- Verifies every Twitch session at startup and hourly, and revalidates an older session when the page becomes visible again.
- Rejects tokens issued for a different Twitch Client ID, expired tokens, tokens without a user identity, and tokens missing NerdSync's single read-only `user:read:follows` scope.
- Confirms the validated Twitch user ID matches the profile returned by Helix before opening the discovery interface.
- OAuth state values are single-use, cryptographically random, and expire after ten minutes. OAuth fragments are removed from browser history immediately after return.
- All Helix requests are restricted to HTTPS, the official Twitch API origin, the `/helix/` path, and the read-only GET method. Requests omit credentials and referrers, bypass browser caches, and time out after 15 seconds.
- Dynamic Twitch links are limited to HTTPS Twitch destinations, and API-provided image URLs must use HTTPS before they are rendered.
- Diagnostic downloads omit browser-identifying details, tokens, query values, and response bodies.
- Cloudflare response headers add a restrictive Content Security Policy, clickjacking protection, MIME sniffing protection, referrer isolation, permissions restrictions, HTTPS enforcement, and no-store rules for HTML and public configuration.
- This release adds no Twitch Client Secret, database, tracking service, advertising system, or write permission.

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
- The browser runtime still requires no framework, server, or database. Starting in Alpha-0.16.3, production deployment uses the Node/npm build pipeline documented above.

The script order in `index.html` is intentional: foundation and UI state first; filters, Twitch access, and discovery next; recommendation, creator, rendering, and stream-detail features after that; controls and session startup last. Keep that dependency order when adding future releases unless the shared state is migrated to native ES modules.

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
- **Newer Affiliates** appears underneath and shows currently live channels whose Twitch `broadcaster_type` is Affiliate and whose account was created less than 365 days ago.
- Newer Affiliates has no built-in viewer ceiling; global viewer controls remain available when the user wants one.
- Followed channels and the logged-in creator are excluded so the section remains discovery-oriented.
- Selected categories are prioritized, top Twitch categories fill remaining scan slots, and category diversity is retained.
- Sort Newer Affiliates by the bounded Newer Affiliate signal, newest account, or the global low-to-high/high-to-low viewer controls.
- Creators eligible for Newer Affiliates are shown only in that section, preventing duplicate cards across both sections.
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
- Opening a Creator Match's **Details** loads an optional TwitchTracker 30-day summary through NerdSync's same-origin Cloudflare endpoint. When available, it shows 30-day average viewers, peak viewers, streamed hours, hours watched, follower gain, and TwitchTracker rank.
- Creator Match cards include a **TwitchTracker stats** link that opens the creator's public TwitchTracker profile in a new tab for deeper historical information.
- TwitchTracker requests are on demand and cached briefly. Only the public Twitch login is sent; the Twitch OAuth token is never sent to TwitchTracker.
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
- Newer Affiliates uses current Affiliate status and account creation date, not an Affiliate-earned date. When Historical Discovery data is available, recent activity and follower-growth efficiency can strengthen the signal.
- Activity checking relies on archived VODs. A channel that disables VODs may appear inactive.
- Detailed checks cover the strongest 40 candidates per load to protect responsiveness and API limits.
- Browser-local preferences do not synchronize across devices.

True historical momentum and cross-device synchronization would still require a database in a future Beta release. The Alpha-0.16.3 Cloudflare Worker/Pages Function is intentionally stateless and is used only for the TwitchTracker summary proxy.

## Version convention

Versions use `Alpha-MAJOR.MINOR.PATCH` during alpha development. Increment PATCH for fixes, MINOR for backward-compatible feature releases, and MAJOR for substantial or breaking changes. Keep this README and the login badge synchronized.

## Alpha-0.16.3 filter control update

Quick-choice discovery controls now use native buttons instead of checkbox-label or clickable-list substitutes. Tags, audience presets, stream language, maximum uptime, recent activity, content classifications, game genres, category include/exclude mode, Open Chat Only, and Creator Match source/range choices synchronize their visual state and `aria-pressed` state with NerdSync's filter model.


## Alpha-0.16.6 additions

Following Live includes an optional **Twitch teams first** control that checks Twitch team memberships for live followed creators, labels their teams, and prioritizes team-affiliated channels. The footer also links to the **NerdSync Field Guide**, a plain-language guide to the main sections and filters.

### Alpha-0.18.0 module layout

Creator Match 2.0 lives in `js/creator-match.js`, while 30-day Discovery context and filter explanation/status helpers live in `js/discovery-context.js`. This keeps the main Discovery and feed-rendering modules below the project's 25 KB source-module target.
