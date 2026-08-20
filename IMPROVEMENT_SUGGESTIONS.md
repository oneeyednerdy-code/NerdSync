# Post-Alpha-0.8.0 roadmap

## Alpha-0.6.0: accessibility and appearance — complete

1. **Theme choices.** Add Light, Dark, and System modes. System follows `prefers-color-scheme`; a manual choice is stored locally per Twitch account and always wins until reset.
2. **Low-vision presets.** Replace separate guesses with Normal, Large, and Extra Large interface-density presets while retaining independent text and card controls.
3. **Color-safe status design.** Never rely on purple, orange, red, or green alone. Pair every state with text, an icon or shape, and stronger borders. Verify contrast in both themes.
4. **Focus and keyboard pass.** Provide a skip link, predictable tab order, clearly visible focus rings, Escape behavior for dialogs and panels, focus return after closing, and no keyboard traps.
5. **Zoom and reflow.** Support 200% browser zoom and narrow layouts without horizontal scrolling, clipped controls, or card actions becoming unreachable.
6. **Screen-reader structure.** Add a main landmark, meaningful result-count announcements, dialog descriptions, loading announcements, clearer button names, and decorative-image handling.
7. **Motion and media.** Continue honoring reduced motion, stop nonessential animation, and avoid autoplay. Keep thumbnail information available as text.
8. **Accessible testing checklist.** Test keyboard-only use, screen-reader landmarks and names, WCAG AA contrast, 200% zoom, 400% text reflow, Windows High Contrast/forced colors, and mobile touch targets.

Theme work uses shared semantic color tokens so Light, Dark, High Contrast, and future themes do not create separate stylesheets.

## Recommended non-security features

### Highest-value static additions

1. **Collaboration Fit explanations.** Expand Creator Match with an explicit compatibility score showing audience overlap, shared tags, shared or complementary categories, language, chat openness, and schedule clues.
2. **Networking shortlist.** Let users place creators into a temporary raid, collaboration, guest, or “watch later” shortlist and export it as plain text or CSV.
3. **More Like This Creator.** Start a new discovery scan from any card using that creator's category, tags, language, and audience stage while still honoring exclusions.
4. **Schedule overlap.** Compare published Twitch schedules and show likely shared availability windows without claiming availability when a creator has no published schedule.
5. **Saved collections.** Organize saved creators into browser-local lists such as SWTOR, charity collaborators, accessibility creators, potential raids, or interview guests.
6. **Discovery session mode.** Offer a guided sequence of one creator at a time with Save, Skip, Less Like This, and Open on Twitch actions.
7. **Category opportunity snapshot.** Summarize the currently scanned directory: live channels, sampled audience distribution, language mix, and where a selected audience stage appears less crowded. Label it as a current sample rather than historical analytics.
8. **Creator comparison upgrade.** Compare three or four channels, highlight exact shared tags, and explain meaningful differences instead of only presenting raw fields.

### Best Worker-enabled additions

1. **Observed momentum.** Use scheduled public snapshots to calculate transparent 7-day and 30-day audience trends, consistency, and category movement.
2. **Recently went live alerts.** Optional notifications for saved discovery lists or creator stages.
3. **Cross-device lists and preferences.** Sync saved creators, hidden creators, collections, and accessibility settings after explicit opt-in.
4. **Collaboration history.** Let creators privately record contact status, prior raids, collaborations, and notes without scraping chat or private Twitch information.

## Later Worker-backed roadmap

The following deeper improvements require optional infrastructure:

1. **Beta-0.1.0: Cloudflare Worker + D1 snapshots.** Record opt-in daily channel observations to measure real 7-day and 30-day momentum instead of inferring growth from current public data.
2. **Cross-device synchronization.** Sync saved creators, hidden creators, and discovery preferences for users who explicitly opt in.
3. **Background enrichment cache.** Cache public activity and chat-mode results at the edge to reduce repeated browser requests without storing OAuth tokens.
4. **Privacy dashboard.** Clearly list stored observations, provide export/delete controls, and default every server-side feature to off.
5. **Recommendation evaluation.** Measure whether Save, Watch, and Dismiss actions improve later recommendations without collecting unnecessary identity or chat data.

The static application should remain available as the privacy-first deployment option even if a Worker-backed edition is introduced.
