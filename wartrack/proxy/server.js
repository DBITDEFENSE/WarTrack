// ============================================
// WARTRACK Server — Static files + API Proxy + Auth
// ============================================

import http from 'http';
import https from 'https';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleAuth } from './routes/auth.js';
import { handleFavorites } from './routes/favorites.js';
import { handleAI } from './routes/ai.js';
import { handleBilling } from './routes/billing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_ROOT = path.resolve(__dirname, '..');

const PORT = process.env.PORT || 5173;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const WINDY_WEBCAMS_KEY = process.env.WINDY_WEBCAMS_KEY || '';
const ADSBX_API_KEY = process.env.ADSBX_API_KEY || '';

// ADS-B Exchange cache
let adsbxCache = { data: null, timestamp: 0 };
const ADSBX_CACHE_TTL = 15000;

// ============================================
// OPENSKY — OAuth2 Client Credentials Flow
// ============================================
let openSkyCreds = null;
try {
  const credsPath = path.join(__dirname, 'credentials.json');
  openSkyCreds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
} catch { /* no credentials */ }

// OAuth2 token management
let oauthToken = null;
let oauthTokenExpiry = 0;

async function getOpenSkyToken() {
  if (oauthToken && Date.now() < oauthTokenExpiry - 60000) {
    return oauthToken; // still valid (with 1-min buffer)
  }

  if (!openSkyCreds) return null;

  try {
    const tokenUrl = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(openSkyCreds.clientId)}&client_secret=${encodeURIComponent(openSkyCreds.clientSecret)}`;

    const { data, statusCode } = await fetchUrl(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (statusCode === 200 && data.access_token) {
      oauthToken = data.access_token;
      oauthTokenExpiry = Date.now() + (data.expires_in || 1800) * 1000;
      console.log('  OpenSky OAuth token acquired (expires in', data.expires_in, 's)');
      return oauthToken;
    } else {
      console.warn('  OpenSky token exchange failed:', statusCode, JSON.stringify(data).substring(0, 200));
      return null;
    }
  } catch (err) {
    console.warn('  OpenSky token error:', err.message);
    return null;
  }
}

// Server-side cache for OpenSky data
let openSkyCache = { data: null, timestamp: 0 };
const OPENSKY_CACHE_TTL = 15000;

async function fetchOpenSky() {
  const now = Date.now();
  if (openSkyCache.data && (now - openSkyCache.timestamp) < OPENSKY_CACHE_TTL) {
    return { data: openSkyCache.data, cached: true };
  }

  const url = 'https://opensky-network.org/api/states/all';
  const headers = {};

  // Try OAuth2 bearer token first
  const token = await getOpenSkyToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const { data, statusCode } = await fetchUrl(url, { headers });

    if (statusCode === 200 && data && data.states) {
      openSkyCache.data = data;
      openSkyCache.timestamp = now;
      return { data, cached: false };
    }

    if (statusCode === 429) {
      if (openSkyCache.data) {
        return { data: openSkyCache.data, cached: true, rateLimited: true };
      }
      return { data: { error: 'rate_limited', states: null }, cached: false, rateLimited: true };
    }

    if (openSkyCache.data) {
      return { data: openSkyCache.data, cached: true };
    }
    return { data: data || { error: 'fetch_failed', states: null }, cached: false };
  } catch (err) {
    if (openSkyCache.data) {
      return { data: openSkyCache.data, cached: true };
    }
    return { data: { error: err.message, states: null }, cached: false };
  }
}

// ============================================
// MERGED FLIGHTS — OpenSky + ADSB-X with deduplication
// ============================================
let mergedFlightsCache = { data: null, timestamp: 0 };
const MERGED_CACHE_TTL = 20000; // 20 seconds

// ADSB-X regional fetch points for global coverage
const ADSBX_REGIONS = [
  { lat: 50, lon: 10, dist: 250, name: 'Europe' },
  { lat: 35, lon: -40, dist: 250, name: 'N-Atlantic' },
  { lat: 40, lon: -95, dist: 250, name: 'N-America' },
  { lat: 25, lon: 55, dist: 250, name: 'Middle-East' },
  { lat: 35, lon: 120, dist: 250, name: 'E-Asia' },
  { lat: 10, lon: 105, dist: 250, name: 'SE-Asia' },
];

async function fetchAdsbxRegion(lat, lon, dist) {
  if (!ADSBX_API_KEY) return [];
  try {
    const adsbxUrl = `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${lat}/lon/${lon}/dist/${dist}/`;
    const { data, statusCode } = await fetchUrl(adsbxUrl, {
      headers: {
        'X-RapidAPI-Key': ADSBX_API_KEY,
        'X-RapidAPI-Host': 'adsbexchange-com1.p.rapidapi.com'
      }
    });
    if (statusCode === 200 && data?.ac) {
      return data.ac.map(ac => ([
        (ac.hex || '').toLowerCase(),       // 0: icao24
        (ac.flight || '').trim(),           // 1: callsign
        ac.r || '',                         // 2: origin (registration country)
        null,                               // 3: time_position
        null,                               // 4: last_contact
        ac.lon,                             // 5: longitude
        ac.lat,                             // 6: latitude
        ac.alt_baro === 'ground' ? 0 : (ac.alt_baro ? ac.alt_baro * 0.3048 : null), // 7: baro alt (ft→m)
        ac.alt_baro === 'ground',           // 8: on_ground
        ac.gs ? ac.gs * 0.5144 : null,     // 9: velocity (kts→m/s)
        ac.track,                           // 10: heading
        ac.baro_rate ? ac.baro_rate * 0.00508 : null, // 11: vert rate (fpm→m/s)
        null,                               // 12: sensors
        ac.alt_geom ? ac.alt_geom * 0.3048 : null, // 13: geo alt (ft→m)
        ac.squawk,                          // 14: squawk
      ]));
    }
    return [];
  } catch {
    return [];
  }
}

async function fetchMergedFlights() {
  const now = Date.now();
  if (mergedFlightsCache.data && (now - mergedFlightsCache.timestamp) < MERGED_CACHE_TTL) {
    return { data: mergedFlightsCache.data, cached: true, sources: ['cache'] };
  }

  const sources = [];
  const aircraftMap = new Map(); // icao24 → state array

  // Source 1: OpenSky (global coverage, may be rate-limited)
  try {
    const opensky = await fetchOpenSky();
    if (opensky.data?.states) {
      sources.push('opensky');
      for (const state of opensky.data.states) {
        const icao = (state[0] || '').toLowerCase();
        if (icao && state[5] && state[6]) {
          aircraftMap.set(icao, state);
        }
      }
    }
  } catch { /* opensky failed */ }

  // Source 2: ADSB-X (regional fetches, run in parallel)
  if (ADSBX_API_KEY) {
    try {
      // Fetch 2 regions at a time to stay within rate limits
      for (let i = 0; i < ADSBX_REGIONS.length; i += 2) {
        const batch = ADSBX_REGIONS.slice(i, i + 2);
        const results = await Promise.all(
          batch.map(r => fetchAdsbxRegion(r.lat, r.lon, r.dist))
        );
        let adsbxCount = 0;
        for (const states of results) {
          for (const state of states) {
            const icao = (state[0] || '').toLowerCase();
            if (icao && state[5] && state[6]) {
              // Only add if not already from OpenSky (OpenSky has better global position data)
              if (!aircraftMap.has(icao)) {
                aircraftMap.set(icao, state);
                adsbxCount++;
              }
            }
          }
        }
        if (adsbxCount > 0) sources.push('adsbx');
      }
    } catch { /* adsbx failed */ }
  }

  // Build merged response in OpenSky format
  const mergedStates = Array.from(aircraftMap.values());
  const result = {
    time: Math.floor(now / 1000),
    states: mergedStates.length > 0 ? mergedStates : null,
    sources,
    count: mergedStates.length,
  };

  if (mergedStates.length > 0) {
    mergedFlightsCache = { data: result, timestamp: now };
  }

  return { data: result, cached: false, sources };
}

// ============================================
// HTTP FETCH UTILITY (supports GET and POST)
// ============================================
const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
};

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: { 'User-Agent': 'WARTRACK/1.0', ...options.headers },
    };

    const req = mod.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); }
        catch { parsed = data; }
        resolve({ data: parsed, statusCode: res.statusCode });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ============================================
// JSON BODY PARSER
// ============================================
function parseBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'OPTIONS') {
      return resolve({ parsed: null, raw: '' });
    }
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); }
      catch { parsed = null; }
      resolve({ parsed, raw: body });
    });
  });
}

// ============================================
// STATIC FILE SERVER
// ============================================
function serveStatic(req, res, urlPath) {
  let filePath = path.join(STATIC_ROOT, urlPath === '/' ? 'index.html' : urlPath);
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!path.extname(filePath)) {
        filePath = path.join(STATIC_ROOT, 'index.html');
      } else {
        res.writeHead(404); res.end('Not found'); return;
      }
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ============================================
// HTTP SERVER
// ============================================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const urlPath = url.pathname;

  if (!urlPath.startsWith('/api/')) {
    return serveStatic(req, res, urlPath);
  }

  // CORS for all API routes
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // Parse body for POST/DELETE
    const { parsed: body, raw: rawBody } = await parseBody(req);

    // ---- AUTH ROUTES ----
    if (urlPath.startsWith('/api/auth/')) {
      const handled = await handleAuth(req, res, urlPath, body);
      if (handled !== false) return;
    }

    // ---- FAVORITES ROUTES ----
    if (urlPath.startsWith('/api/favorites')) {
      const handled = await handleFavorites(req, res, urlPath, body);
      if (handled !== false) return;
    }

    // ---- BILLING ROUTES ----
    if (urlPath.startsWith('/api/billing')) {
      const handled = await handleBilling(req, res, urlPath, body, rawBody);
      if (handled !== false) return;
    }

    // ---- AI ROUTES (summary, tts) ----
    if (urlPath === '/api/summary' || urlPath === '/api/tts' || urlPath === '/api/analysis' || urlPath === '/api/market-analysis' || urlPath === '/api/entity-insight' || urlPath === '/api/nexus') {
      const handled = await handleAI(req, res, urlPath, body);
      if (handled !== false) return;
    }

    // ---- OPENSKY (legacy, still available) ----
    if (urlPath === '/api/opensky') {
      const result = await fetchOpenSky();
      res.setHeader('X-Cache', result.cached ? 'HIT' : 'MISS');
      if (result.rateLimited) res.setHeader('X-Rate-Limited', 'true');
      res.writeHead(200);
      return res.end(JSON.stringify(result.data));
    }

    // ---- MERGED FLIGHTS (OpenSky + ADSB-X, deduplicated) ----
    if (urlPath === '/api/flights') {
      const result = await fetchMergedFlights();
      res.setHeader('X-Cache', result.cached ? 'HIT' : 'MISS');
      res.setHeader('X-Sources', result.sources.join(','));
      res.writeHead(200);
      return res.end(JSON.stringify(result.data));
    }

    // ---- NEWS (with server-side cache + multi-source) ----
    if (urlPath === '/api/news') {
      const q = url.searchParams.get('q') || 'conflict';
      const max = Math.min(parseInt(url.searchParams.get('max')) || 8, 10);

      // Server-side news cache (10 min per query)
      if (!global.newsCache) global.newsCache = {};
      const cacheKey = `news-${q}`;
      const cached = global.newsCache[cacheKey];
      if (cached && Date.now() - cached.ts < 600000) {
        res.setHeader('X-Cache', 'HIT');
        res.writeHead(200);
        return res.end(JSON.stringify(cached.data));
      }

      let articles = [];

      // Primary source: GNews
      if (GNEWS_API_KEY) {
        try {
          const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=${max}&apikey=${GNEWS_API_KEY}`;
          const { data } = await fetchUrl(gnewsUrl);
          if (data?.articles) articles = data.articles;
        } catch { /* GNews failed, try secondary */ }
      }

      // Secondary source: Google News RSS (free, no key needed)
      if (articles.length < 3) {
        try {
          const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
          const { data: rssData } = await fetchUrl(rssUrl);
          if (typeof rssData === 'string' && rssData.includes('<item>')) {
            // Simple XML parse for RSS items
            const items = rssData.match(/<item>([\s\S]*?)<\/item>/g) || [];
            for (const item of items.slice(0, max - articles.length)) {
              const title = item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '') || '';
              const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
              const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
              const source = item.match(/<source.*?>(.*?)<\/source>/)?.[1] || 'Google News';
              if (title && link) {
                articles.push({
                  title, url: link, publishedAt: pubDate,
                  source: { name: source, url: link },
                  _secondary: true,
                });
              }
            }
          }
        } catch { /* secondary failed too */ }
      }

      const result = { articles };
      global.newsCache[cacheKey] = { data: result, ts: Date.now() };

      res.setHeader('X-Cache', 'MISS');
      res.writeHead(200);
      return res.end(JSON.stringify(result));
    }

    // ---- VESSELS ----
    if (urlPath === '/api/vessels') {
      res.writeHead(200);
      return res.end(JSON.stringify([]));
    }

    // ---- NASA API (Mars rover photos, APOD) ----
    if (urlPath === '/api/nasa') {
      const type = url.searchParams.get('type') || 'mars-rover';
      if (!global.nasaCache) global.nasaCache = {};
      const cached = global.nasaCache[type];
      if (cached && Date.now() - cached.ts < 3600000) { // 1hr cache
        res.writeHead(200);
        return res.end(JSON.stringify(cached.data));
      }
      try {
        let nasaUrl;
        if (type === 'mars-rover') {
          nasaUrl = 'https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/latest_photos?api_key=DEMO_KEY';
        } else {
          nasaUrl = `https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY`;
        }
        const { data, statusCode } = await fetchUrl(nasaUrl);
        if (statusCode === 200) {
          global.nasaCache[type] = { data, ts: Date.now() };
          res.writeHead(200);
          return res.end(JSON.stringify(data));
        }
        res.writeHead(200);
        return res.end(JSON.stringify({ photos: [] }));
      } catch {
        res.writeHead(200);
        return res.end(JSON.stringify({ photos: [] }));
      }
    }

    // ---- SOCIAL CONTENT (YouTube + Reddit + Bluesky) ----
    if (urlPath === '/api/social') {
      const region = url.searchParams.get('region') || 'world';
      const cacheKey = `social-${region}`;
      if (!global.socialCache) global.socialCache = {};
      const cached = global.socialCache[cacheKey];
      if (cached && Date.now() - cached.ts < 900000) { // 15 min cache
        res.writeHead(200);
        return res.end(JSON.stringify(cached.data));
      }

      const items = [];

      // SOURCE 1: YouTube (public search, no key needed for RSS)
      try {
        const ytQuery = encodeURIComponent(`${region} conflict news 2024 2025`);
        const ytUrl = `https://www.youtube.com/results?search_query=${ytQuery}&sp=CAI%253D`; // sort by date
        // Use YouTube RSS feed (no API key needed)
        const ytRssUrl = `https://www.youtube.com/feeds/videos.xml?search_query=${ytQuery}`;
        // Fallback: use Google RSS for YouTube results
        const googleYtUrl = `https://news.google.com/rss/search?q=${ytQuery}+site:youtube.com&hl=en-US`;
        const { data: rssData } = await fetchUrl(googleYtUrl);
        if (typeof rssData === 'string' && rssData.includes('<item>')) {
          const rssItems = rssData.match(/<item>([\s\S]*?)<\/item>/g) || [];
          for (const item of rssItems.slice(0, 5)) {
            const title = item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '') || '';
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
            if (title && link) {
              items.push({
                id: `yt-${items.length}`,
                source: 'YouTube',
                type: 'video',
                title: title.replace(/ - YouTube$/, ''),
                author: '',
                timestamp: pubDate,
                url: link,
                thumbnail: '',
                region,
                relevance: 0.7,
              });
            }
          }
        }
      } catch { /* YouTube fetch failed */ }

      // SOURCE 2: Reddit (public JSON — requires browser-like User-Agent)
      try {
        const redditQuery = encodeURIComponent(region);
        const redditUrl = `https://www.reddit.com/search.json?q=${redditQuery}&sort=new&limit=5&t=week`;
        const { data: redditData, statusCode } = await fetchUrl(redditUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        if (statusCode === 200 && redditData?.data?.children) {
          for (const child of redditData.data.children.slice(0, 5)) {
            const post = child.data;
            if (!post || post.over_18) continue;
            items.push({
              id: `reddit-${post.id}`,
              source: 'Reddit',
              type: 'post',
              title: post.title?.substring(0, 120),
              text: post.selftext?.substring(0, 200),
              author: post.author,
              timestamp: new Date(post.created_utc * 1000).toISOString(),
              url: `https://reddit.com${post.permalink}`,
              thumbnail: post.thumbnail?.startsWith('http') ? post.thumbnail : '',
              subreddit: post.subreddit,
              score: post.score,
              region,
              relevance: Math.min(0.9, (post.score || 0) / 1000 + 0.3),
            });
          }
        }
      } catch { /* Reddit fetch failed */ }

      // SOURCE 3: Bluesky (public search, no auth needed)
      try {
        const bskyQuery = encodeURIComponent(region);
        const bskyUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${bskyQuery}&limit=5&sort=latest`;
        const { data: bskyData, statusCode } = await fetchUrl(bskyUrl);
        if (statusCode === 200 && bskyData?.posts) {
          for (const post of bskyData.posts.slice(0, 5)) {
            items.push({
              id: `bsky-${post.uri?.split('/').pop()}`,
              source: 'Bluesky',
              type: 'post',
              title: post.record?.text?.substring(0, 120) || '',
              author: post.author?.displayName || post.author?.handle,
              timestamp: post.record?.createdAt || '',
              url: `https://bsky.app/profile/${post.author?.handle}/post/${post.uri?.split('/').pop()}`,
              thumbnail: '',
              region,
              relevance: 0.5,
            });
          }
        }
      } catch { /* Bluesky fetch failed */ }

      // Sort by relevance
      items.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

      const result = { items: items.slice(0, 15), region, sources: ['YouTube', 'Reddit', 'Bluesky'] };
      global.socialCache[cacheKey] = { data: result, ts: Date.now() };
      res.writeHead(200);
      return res.end(JSON.stringify(result));
    }

    // ---- STOCK SEARCH (Yahoo Finance autocomplete) ----
    if (urlPath === '/api/stock-search') {
      const q = url.searchParams.get('q') || '';
      if (!q) { res.writeHead(400); return res.end(JSON.stringify({ error: 'q required' })); }
      try {
        const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=5&newsCount=0`;
        const { data, statusCode } = await fetchUrl(searchUrl);
        if (statusCode === 200 && data?.quotes?.length) {
          const best = data.quotes[0];
          res.writeHead(200);
          return res.end(JSON.stringify({ symbol: best.symbol, name: best.shortname || best.longname, exchange: best.exchange }));
        }
        res.writeHead(200);
        return res.end(JSON.stringify({ symbol: null }));
      } catch {
        res.writeHead(200);
        return res.end(JSON.stringify({ symbol: null }));
      }
    }

    // ---- STOCK QUOTES (Yahoo Finance) ----
    if (urlPath === '/api/quotes') {
      const tickers = (url.searchParams.get('tickers') || '').split(',').filter(Boolean).slice(0, 50);
      if (!tickers.length) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'tickers parameter required' }));
      }
      if (!global.quotesCache) global.quotesCache = {};
      const results = [];
      const toFetch = [];

      // Check cache for each ticker (5 min TTL)
      for (const t of tickers) {
        const cached = global.quotesCache[t];
        if (cached && Date.now() - cached.ts < 300000) {
          results.push(cached.data);
        } else {
          toFetch.push(t);
        }
      }

      // Fetch missing tickers from Yahoo Finance
      for (const t of toFetch) {
        try {
          const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?interval=1d&range=5d`;
          const { data, statusCode } = await fetchUrl(yahooUrl);
          if (statusCode === 200 && data?.chart?.result?.[0]) {
            const r = data.chart.result[0];
            const meta = r.meta || {};
            const quote = {
              ticker: t,
              price: meta.regularMarketPrice || 0,
              prevClose: meta.previousClose || meta.chartPreviousClose || 0,
              change: (meta.regularMarketPrice || 0) - (meta.previousClose || meta.chartPreviousClose || 0),
              changePercent: meta.previousClose ? (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100) : 0,
              volume: meta.regularMarketVolume || 0,
              currency: meta.currency || 'USD',
              exchange: meta.exchangeName || '',
              marketState: meta.marketState || 'CLOSED',
            };
            global.quotesCache[t] = { data: quote, ts: Date.now() };
            results.push(quote);
          }
        } catch { /* skip failed ticker */ }
      }

      res.writeHead(200);
      return res.end(JSON.stringify({ quotes: results }));
    }

    // ---- CAMERAS (Windy Webcams) ----
    if (urlPath === '/api/cameras') {
      if (!WINDY_WEBCAMS_KEY) {
        // Return sample cameras when no API key
        res.writeHead(200);
        return res.end(JSON.stringify({ webcams: generateSampleCameras(url.searchParams.get('bbox')) }));
      }
      const bbox = url.searchParams.get('bbox') || '60,30,20,-10'; // default Europe
      // Cache by bbox rounded to 1 decimal
      const cacheKey = 'cam-' + bbox.split(',').map(n => parseFloat(n).toFixed(0)).join(',');
      if (!global.cameraCache) global.cameraCache = {};
      const cached = global.cameraCache[cacheKey];
      if (cached && Date.now() - cached.ts < 600000) { // 10 min cache
        res.writeHead(200);
        return res.end(JSON.stringify(cached.data));
      }
      try {
        const camUrl = `https://api.windy.com/webcams/api/v3/webcams?lang=en&limit=50&offset=0&bbox=${bbox}&include=images,location,player,urls,categories`;
        const { data, statusCode } = await fetchUrl(camUrl, {
          headers: { 'x-windy-api-key': WINDY_WEBCAMS_KEY }
        });
        if (statusCode === 200) {
          global.cameraCache[cacheKey] = { data, ts: Date.now() };
          res.writeHead(200);
          return res.end(JSON.stringify(data));
        }
        // Fallback to sample data on API error
        res.writeHead(200);
        return res.end(JSON.stringify({ webcams: generateSampleCameras(bbox) }));
      } catch {
        res.writeHead(200);
        return res.end(JSON.stringify({ webcams: generateSampleCameras(bbox) }));
      }
    }

    // ---- ADSB-X STATUS (check if key configured) ----
    if (urlPath === '/api/adsbx/status') {
      res.writeHead(200);
      return res.end(JSON.stringify({ available: !!ADSBX_API_KEY }));
    }

    // ---- ADSB-X DATA (ADS-B Exchange V2 with quality fields) ----
    if (urlPath === '/api/adsbx') {
      if (!ADSBX_API_KEY) {
        res.writeHead(200);
        return res.end(JSON.stringify({ error: 'no_key', available: false, aircraft: [] }));
      }
      const now = Date.now();
      if (adsbxCache.data && (now - adsbxCache.timestamp) < ADSBX_CACHE_TTL) {
        res.setHeader('X-Cache', 'HIT');
        res.writeHead(200);
        return res.end(JSON.stringify(adsbxCache.data));
      }
      try {
        const lat = url.searchParams.get('lat') || '45';
        const lon = url.searchParams.get('lon') || '25';
        const dist = url.searchParams.get('dist') || '250';
        const adsbxUrl = `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${lat}/lon/${lon}/dist/${dist}/`;
        const { data, statusCode } = await fetchUrl(adsbxUrl, {
          headers: {
            'X-RapidAPI-Key': ADSBX_API_KEY,
            'X-RapidAPI-Host': 'adsbexchange-com1.p.rapidapi.com'
          }
        });
        if (statusCode === 200 && data?.ac) {
          // Normalize aircraft with quality fields
          const normalized = {
            available: true,
            aircraft: data.ac.map(ac => ({
              icao24: ac.hex || '',
              callsign: (ac.flight || '').trim(),
              lat: ac.lat,
              lon: ac.lon,
              alt: ac.alt_baro,
              geoAlt: ac.alt_geom,
              heading: ac.track,
              velocity: ac.gs, // ground speed in knots
              vertRate: ac.baro_rate,
              nacp: ac.nac_p,
              nic: ac.nic,
              sil: ac.sil,
              nacv: ac.nac_v,
              sda: ac.sda,
              gva: ac.gva,
              squawk: ac.squawk,
              category: ac.category,
              onGround: ac.alt_baro === 'ground',
            }))
          };
          adsbxCache = { data: normalized, timestamp: now };
          res.setHeader('X-Cache', 'MISS');
          res.writeHead(200);
          return res.end(JSON.stringify(normalized));
        }
        if (adsbxCache.data) {
          res.setHeader('X-Cache', 'HIT');
          res.writeHead(200);
          return res.end(JSON.stringify(adsbxCache.data));
        }
        res.writeHead(200);
        return res.end(JSON.stringify({ available: true, aircraft: [], error: 'fetch_failed' }));
      } catch (err) {
        if (adsbxCache.data) {
          res.writeHead(200);
          return res.end(JSON.stringify(adsbxCache.data));
        }
        res.writeHead(200);
        return res.end(JSON.stringify({ available: true, aircraft: [], error: err.message }));
      }
    }

    // ---- TLE (CelesTrak satellite data) ----
    if (urlPath === '/api/tle') {
      const group = url.searchParams.get('group') || 'stations';
      const allowed = ['stations', 'starlink', 'military', 'gps-ops', 'weather', 'active'];
      if (!allowed.includes(group)) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Invalid TLE group' }));
      }
      // 2-hour cache per group
      if (!global.tleCache) global.tleCache = {};
      const cached = global.tleCache[group];
      if (cached && Date.now() - cached.ts < 7200000) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('X-Cache', 'HIT');
        res.writeHead(200);
        return res.end(cached.data);
      }
      try {
        const tleUrl = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`;
        const { data, statusCode } = await fetchUrl(tleUrl);
        if (statusCode === 200) {
          const text = typeof data === 'string' ? data : JSON.stringify(data);
          global.tleCache[group] = { data: text, ts: Date.now() };
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('X-Cache', 'MISS');
          res.writeHead(200);
          return res.end(text);
        }
        res.writeHead(statusCode || 500);
        return res.end(JSON.stringify({ error: 'CelesTrak fetch failed' }));
      } catch (err) {
        if (cached) {
          res.setHeader('Content-Type', 'text/plain');
          res.writeHead(200);
          return res.end(cached.data);
        }
        res.writeHead(500);
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('API error:', err.message || err);
    const status = err.status || 500;
    res.writeHead(status);
    res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
});

// ============================================
// SAMPLE CAMERA DATA (when no Windy API key)
// ============================================
function generateSampleCameras(bboxStr) {
  // Sample cameras with real YouTube live stream IDs for embed
  const cameras = [
    { webcamId: 'cam-001', title: 'Times Square NYC', location: { latitude: 40.758, longitude: -73.9855, city: 'New York', country: 'United States' }, categories: ['city'], status: 'active', urls: { detail: 'https://www.earthcam.com/usa/newyork/timessquare/' }, images: { current: { preview: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400&h=225&fit=crop' } } },
    { webcamId: 'cam-002', title: 'Eiffel Tower Paris', location: { latitude: 48.8584, longitude: 2.2945, city: 'Paris', country: 'France' }, categories: ['city', 'landscape'], status: 'active', urls: { detail: 'https://www.earthcam.com/world/france/paris/' }, images: { current: { preview: 'https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=400&h=225&fit=crop' } } },
    { webcamId: 'cam-003', title: 'Tower Bridge London', location: { latitude: 51.5055, longitude: -0.0754, city: 'London', country: 'United Kingdom' }, categories: ['city'], status: 'active', urls: { detail: 'https://www.earthcam.com/world/england/london/' }, images: { current: { preview: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=225&fit=crop' } } },
    { webcamId: 'cam-004', title: 'LAX Airport', location: { latitude: 33.9425, longitude: -118.408, city: 'Los Angeles', country: 'United States' }, categories: ['airport'], status: 'active', urls: { detail: 'https://www.flightradar24.com/airport/lax' }, images: { current: { preview: 'https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=400&h=225&fit=crop' } } },
    { webcamId: 'cam-005', title: 'Port of Rotterdam', location: { latitude: 51.9036, longitude: 4.4860, city: 'Rotterdam', country: 'Netherlands' }, categories: ['harbor', 'port'], status: 'active', urls: { detail: 'https://www.portofrotterdam.com/en/online/webcams' }, images: { current: { preview: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=225&fit=crop' } } },
    { webcamId: 'cam-006', title: 'Shibuya Crossing Tokyo', location: { latitude: 35.6595, longitude: 139.7004, city: 'Tokyo', country: 'Japan' }, categories: ['city', 'traffic'], status: 'active', urls: { detail: 'https://www.youtube.com/watch?v=_9MKxJQMKfE' }, images: { current: { preview: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400&h=225&fit=crop' } } },
    { webcamId: 'cam-007', title: 'Dubai Skyline', location: { latitude: 25.1972, longitude: 55.2744, city: 'Dubai', country: 'United Arab Emirates' }, categories: ['city', 'landscape'], status: 'active', urls: { detail: 'https://www.earthcam.com/world/unitedarabemirates/dubai/' }, images: { current: { preview: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=225&fit=crop' } } },
    { webcamId: 'cam-008', title: 'Sydney Harbour', location: { latitude: -33.8568, longitude: 151.2153, city: 'Sydney', country: 'Australia' }, categories: ['harbor', 'city'], status: 'active', urls: { detail: 'https://www.sydney.com/webcams' }, images: { current: { preview: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400&h=225&fit=crop' } } },
    { webcamId: 'cam-009', title: 'Istanbul Bosphorus', location: { latitude: 41.0424, longitude: 29.0082, city: 'Istanbul', country: 'Turkey' }, categories: ['harbor', 'city'], status: 'active', urls: { detail: 'https://www.skylinewebcams.com/en/webcam/turkey/istanbul.html' }, images: { current: { preview: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=400&h=225&fit=crop' } } },
    { webcamId: 'cam-010', title: 'Singapore Marina Bay', location: { latitude: 1.2816, longitude: 103.8636, city: 'Singapore', country: 'Singapore' }, categories: ['city', 'harbor'], status: 'active', urls: { detail: 'https://www.skylinewebcams.com/en/webcam/singapore.html' }, images: { current: { preview: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&h=225&fit=crop' } } },
  ];

  if (!bboxStr) return cameras;
  const [north, east, south, west] = bboxStr.split(',').map(Number);
  return cameras.filter(c => {
    const lat = c.location.latitude;
    const lon = c.location.longitude;
    return lat >= south && lat <= north && lon >= west && lon <= east;
  });
}

server.listen(PORT, () => {
  console.log(`\n  WARTRACK running at http://localhost:${PORT}\n`);
  console.log(`  Data APIs:`);
  console.log(`    /api/opensky     — Flight data ${openSkyCreds ? '(OAuth2 authenticated)' : '(anonymous)'}`);
  console.log(`    /api/news?q=     — GNews headlines`);
  console.log(`    /api/vessels     — AIS vessel data`);
  console.log(`  Auth APIs:`);
  console.log(`    POST /api/auth/register`);
  console.log(`    POST /api/auth/login`);
  console.log(`    GET  /api/auth/me`);
  console.log(`  Favorites APIs:`);
  console.log(`    GET/POST/DELETE /api/favorites`);
});
