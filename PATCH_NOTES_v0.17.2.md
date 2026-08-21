# NerdSync Alpha-0.17.2 — Creator Match TwitchTracker Link

- Added a **TwitchTracker stats** action directly to Creator Match cards.
- The action opens the creator's public TwitchTracker profile in a new tab for deeper public historical statistics.
- The external link is visually secondary to NerdSync's Details action and uses `noopener noreferrer`.
- Clicking the TwitchTracker action no longer triggers the NerdSync card Details modal.
- No Twitch OAuth token or private NerdSync data is sent through the link.
- Creator Match Details continues to use NerdSync's same-origin TwitchTracker summary proxy independently.
