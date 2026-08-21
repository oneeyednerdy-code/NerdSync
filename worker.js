import { onRequestGet as twitchTrackerSummary } from './functions/api/twitchtracker-summary.js';
import { onRequestGet as twitchTrackerCategorySummary } from './functions/api/twitchtracker-category-summary.js';

function methodNotAllowed() {
  return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      allow: 'GET',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/twitchtracker-summary') {
      if (request.method !== 'GET') return methodNotAllowed();
      return twitchTrackerSummary({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });
    }

    if (url.pathname === '/api/twitchtracker-category-summary') {
      if (request.method !== 'GET') return methodNotAllowed();
      return twitchTrackerCategorySummary({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });
    }

    return env.ASSETS.fetch(request);
  },
};
