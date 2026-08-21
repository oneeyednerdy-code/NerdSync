# NerdSync Alpha-0.16.3 — Filter Button Reliability

## Fixed
- Hotfix: restricted-chat exclusion is enabled by default.
- Hotfix: renamed the control to “Exclude restricted chats” and reduced it to a compact inline button instead of a full-width control.
- Converted game genre filters from checkbox-label controls to native buttons.
- Converted Twitch content-classification filters to native toggle buttons.
- Converted Creator Match audience source and tolerance choices to button groups.
- Converted game-category include/exclude mode to buttons.
- Converted Twitch category autocomplete results to native buttons.
- Converted Open Chat Only to a native toggle button.
- Converted stream language, maximum uptime, and recent creator activity quick choices to native button groups.
- Added synchronized `aria-pressed` and active styling for tag, audience, genre, content, chat, category-mode, and Creator Match choices.
- Audience preset state now clears correctly when minimum/maximum viewer values are edited or removed.
- Clear All now resets every button control and its accessible pressed state.
- Removed a duplicated "30-Day Channel Stats" heading in Creator Details.

## Behavior
- Tag buttons add/remove tags from the active tag filter.
- Genre buttons resolve their curated game lists against Twitch categories and can be combined.
- Content-classification buttons match any selected Twitch classification.
- Game search results add a category using the currently selected Include or Exclude mode.
- Creator Match source/range buttons directly control the match calculation.

## Accessibility
- Native buttons provide consistent mouse, touch, Enter, and Space activation.
- Toggle buttons expose their state through `aria-pressed`.
- Category-search buttons include visible keyboard focus styling.
