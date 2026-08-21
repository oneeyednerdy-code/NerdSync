# NerdSync Alpha-0.16.6

## Following teams + Field Guide

- The NerdSync brand in the signed-in header now links back to the main Discover page.
- Following Live now has an opt-in **Twitch teams first** checkbox.
- When enabled, NerdSync uses Twitch Helix Get Channel Teams for live followed creators, caches memberships for 15 minutes, places team-affiliated creators first, and shows the Twitch team name in bold on their card.
- Team lookups use the existing Twitch token and require no additional OAuth scope.
- Added **NerdSync Field Guide**, linked from the bottom/footer and login footer, explaining Discover, Following, Creator Match, Saved, filters, cards, settings, and privacy.
- Production build now includes `guide.html`.
