# Nerd Sync

A multi-user Twitch dashboard single-page application (SPA) designed to be hosted publicly or locally.

## Setup & Configuration

1. Open `config.js` in a text editor.
2. Replace `"YOUR_TWITCH_CLIENT_ID_HERE"` with your Twitch Client ID registered in the Twitch Developer Console.
3. Serve `index.html` via Cloudflare Pages or any web host.
4. Anyone accessing the page can log in using their own Twitch credentials via OAuth Implicit Flow.

> **Note on Security:** Front-end applications using OAuth Implicit Flow only require the public **Client ID**. Never expose or embed your Twitch **Client Secret** in client-side front-end code.
