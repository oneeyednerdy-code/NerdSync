# NerdSync Alpha-0.16.4 — Creator Match Tag Highlighting

## Added
- Creator Match cards now show each live creator's Twitch tags directly on the card.
- Tags matching the Twitch tags entered in Discovery Filters are highlighted and marked with a check.
- Matching tags are shown first, followed by the creator's remaining tags.
- Creators with no Twitch tags display a small “No Twitch tags listed” note instead of an empty area.

## Matching behavior
- Highlight matching is case-insensitive.
- It uses the same exact-tag matching rule as NerdSync's discovery filter.
- Non-matching creator tags remain visible for context.
- The feature uses tags already returned by Twitch's live-stream response, so it adds no extra API request.

## Accessibility
- Highlighted tags include an accessible label stating that the tag matches the user's selected tag.
- The visual check mark is decorative and hidden from screen readers.
- Forced-colors mode gives matched tags a stronger system highlight border.
