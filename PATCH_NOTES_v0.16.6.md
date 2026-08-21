# NerdSync Alpha-0.16.6

## Following teams + Field Guide

- The NerdSync brand in the signed-in header now links back to the main Discover page.
- Following Live now has an opt-in **Twitch teams first** checkbox.
- When enabled, NerdSync uses Twitch Helix Get Channel Teams for live followed creators, caches memberships for 15 minutes, places team-affiliated creators first, and shows the Twitch team name in bold on their card.
- Team lookups use the existing Twitch token and require no additional OAuth scope.
- Added **NerdSync Field Guide**, linked from the bottom/footer and login footer, explaining Discover, Following, Creator Match, Saved, filters, cards, settings, and privacy.
- Production build now includes `guide.html`.

### Field Guide CSS hotfix
- Reworked the Field Guide to use NerdSync's 1180px application shell instead of a separate 980px documentation layout.
- Matched the guide header to NerdSync's main top bar treatment.
- Changed guide content to a stable single-column reading flow on desktop.
- Restyled guide navigation as real NerdSync-style controls with 44px targets.
- Turned Discovery filter explanations into individual raised panel items for easier scanning.
- Improved anchor scrolling, mobile spacing, small-screen navigation, and forced-colors support.
- Bumped the guide stylesheet cache key so an older cached guide layout is not reused after deployment.
