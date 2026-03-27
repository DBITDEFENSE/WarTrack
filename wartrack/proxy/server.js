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
import { apiTracker } from './lib/rate-limiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_ROOT = path.resolve(__dirname, '..');

const PORT = process.env.PORT || 5173;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const WINDY_WEBCAMS_KEY = process.env.WINDY_WEBCAMS_KEY || '';
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY || '';
const MAPILLARY_TOKEN = process.env.MAPILLARY_TOKEN || '';
const ADSBX_API_KEY = process.env.ADSBX_API_KEY || '';

// ADS-B Exchange cache
let adsbxCache = { data: null, timestamp: 0 };
const ADSBX_CACHE_TTL = 15000;

// ============================================
// VESSEL TRACKING — Digitraffic AIS (free, no key)
// ============================================
const vesselStore = new Map(); // keyed by MMSI
let vesselCacheJson = null;
let vesselCacheTs = 0;
const VESSEL_CACHE_TTL = 30000; // 30s response cache
const VESSEL_STALE_TTL = 600000; // prune vessels not seen in 10 min
const VESSEL_FETCH_INTERVAL = 60000; // poll every 60s

let vesselMetadata = new Map(); // MMSI → { name, shipType, destination, callSign }
let vesselMetaLastFetch = 0;
const VESSEL_META_TTL = 300000; // refresh metadata every 5 min

// MMSI prefix → country code (first 3 digits of MMSI identify the flag state)
const MMSI_FLAG = {
  '201':'GR','209':'MT','210':'MT','211':'DE','212':'CY','213':'GE','214':'MD','215':'MT',
  '218':'DE','219':'DK','220':'DK','224':'ES','225':'ES','226':'FR','227':'FR','228':'FR',
  '229':'MT','230':'FI','231':'FI','232':'GB','233':'GB','234':'GB','235':'GB','236':'GI',
  '237':'GR','238':'HR','239':'GR','240':'GR','241':'GR','242':'MA','243':'HU','244':'NL',
  '245':'NL','246':'NL','247':'IT','248':'MT','249':'MT','250':'IE','251':'IS','252':'LI',
  '253':'LU','255':'PT','256':'MT','257':'NO','258':'NO','259':'NO','261':'PL','263':'PT',
  '265':'SE','266':'SE','267':'SE','269':'CH','270':'CZ','271':'TR','272':'UA','273':'RU',
  '274':'MK','275':'LV','276':'EE','277':'LT','278':'SI','279':'MT','301':'AI','303':'US',
  '304':'AG','305':'AG','306':'CW','307':'AR','308':'BS','309':'BS','310':'BM','311':'BS',
  '312':'BZ','314':'BB','316':'BR','319':'KY','321':'CL','323':'CO','325':'CR','327':'CU',
  '329':'GP','330':'GD','331':'GL','332':'GT','334':'HN','336':'HT','338':'US','339':'JM',
  '341':'KN','343':'LC','345':'MX','347':'MQ','348':'MS','350':'NI','351':'PA','352':'PA',
  '353':'PA','354':'PA','355':'PA','356':'PA','357':'PA','358':'PR','359':'SV','361':'PM',
  '362':'TT','364':'TC','366':'US','367':'US','368':'US','369':'US','370':'PA','371':'PA',
  '372':'PA','373':'PA','374':'PA','375':'VC','376':'VC','377':'VC','378':'VG','379':'VI',
  '401':'AF','403':'SA','405':'BD','408':'BH','410':'BT','412':'CN','413':'CN','414':'CN',
  '416':'TW','417':'LK','419':'IN','422':'IR','423':'AZ','425':'IQ','428':'IL','431':'JP',
  '432':'JP','434':'TM','436':'KZ','437':'UZ','438':'JO','440':'KR','441':'KR','443':'PS',
  '445':'KP','447':'KW','450':'LB','451':'KG','453':'MO','455':'MV','457':'MN','459':'NP',
  '461':'OM','463':'PK','466':'QA','468':'SY','470':'AE','471':'AE','472':'TJ','473':'YE',
  '475':'SA','477':'HK','478':'BA','501':'FR','503':'AU','506':'MM','508':'BN','510':'FM',
  '511':'PW','512':'NZ','514':'KH','515':'KH','516':'AU','518':'NZ','520':'KI','523':'CK',
  '525':'ID','529':'KI','531':'LA','533':'MY','536':'MP','538':'MH','540':'NC','542':'NU',
  '544':'NR','546':'FR','548':'PH','553':'PG','555':'PN','557':'SB','559':'AS','561':'WS',
  '563':'SG','564':'SG','565':'SG','566':'SG','567':'TH','570':'TO','572':'TV','574':'VN',
  '576':'VU','577':'VU','578':'WF','601':'ZA','603':'AO','605':'DZ','607':'FR','608':'GB',
  '609':'BI','610':'BJ','611':'BW','612':'CF','613':'CM','616':'KM','617':'CV','618':'CD',
  '619':'CI','620':'KM','621':'DJ','622':'EG','624':'ET','625':'ER','626':'GA','627':'GH',
  '629':'GM','630':'GW','631':'GQ','632':'GN','633':'BF','634':'KE','636':'LR','637':'LR',
  '638':'SS','642':'LY','644':'LS','645':'MU','647':'MG','649':'ML','650':'MZ','654':'MR',
  '655':'MW','656':'NE','657':'NG','659':'NA','660':'RE','661':'RW','662':'SD','663':'SN',
  '664':'SC','665':'SH','666':'SO','667':'SL','668':'ST','669':'SZ','670':'TD','671':'TG',
  '672':'TN','674':'TZ','675':'UG','676':'CD','677':'TZ','678':'ZM','679':'ZW',
};

function flagFromMmsi(mmsi) {
  const prefix = String(mmsi).substring(0, 3);
  return MMSI_FLAG[prefix] || '';
}

async function fetchVesselMetadata() {
  if (Date.now() - vesselMetaLastFetch < VESSEL_META_TTL && vesselMetadata.size > 0) return;
  try {
    const { data, statusCode } = await fetchUrl('https://meri.digitraffic.fi/api/ais/v1/vessels', {
      headers: { 'Accept-Encoding': 'gzip' }
    });
    if (statusCode !== 200 || !Array.isArray(data)) return;
    for (const v of data) {
      if (!v.mmsi) continue;
      vesselMetadata.set(v.mmsi, {
        name: v.name || '',
        shipType: v.shipType || 0,
        destination: v.destination || '',
        callSign: v.callSign || '',
        imo: v.imo || 0,
      });
    }
    vesselMetaLastFetch = Date.now();
    console.log(`  Digitraffic metadata: ${vesselMetadata.size} vessel records`);
  } catch (err) {
    console.warn('  Digitraffic metadata fetch error:', err.message);
  }
}

async function fetchDigitrafficVessels() {
  // Fetch metadata first (cached, only refreshes every 5 min)
  await fetchVesselMetadata();

  try {
    const { data, statusCode } = await fetchUrl('https://meri.digitraffic.fi/api/ais/v1/locations', {
      headers: { 'Accept-Encoding': 'gzip' }
    });
    if (statusCode !== 200 || !data?.features) {
      console.warn('  Digitraffic AIS: HTTP', statusCode);
      return;
    }
    let count = 0;
    for (const f of data.features) {
      const props = f.properties;
      const coords = f.geometry?.coordinates;
      if (!props?.mmsi || !coords) continue;
      const meta = vesselMetadata.get(props.mmsi) || {};
      vesselStore.set(props.mmsi, {
        mmsi: String(props.mmsi),
        name: meta.name || '',
        lat: coords[1],
        lon: coords[0],
        heading: props.heading ?? props.cog ?? 0,
        cog: props.cog ?? 0,
        speed: props.sog ?? 0,
        shipType: meta.shipType ?? 0,
        destination: meta.destination || '',
        flag: flagFromMmsi(props.mmsi),
        navStat: props.navStat ?? null,
        lastSeen: Date.now(),
      });
      count++;
    }
    vesselCacheJson = null; // invalidate response cache
    console.log(`  Digitraffic AIS: ${count} vessels updated (${vesselStore.size} total in store)`);
  } catch (err) {
    console.warn('  Digitraffic AIS fetch error:', err.message);
  }
}

function getVesselData() {
  const now = Date.now();
  // Return cached serialized JSON if fresh
  if (vesselCacheJson && now - vesselCacheTs < VESSEL_CACHE_TTL) {
    return vesselCacheJson;
  }
  // Prune stale entries
  for (const [mmsi, v] of vesselStore) {
    if (now - v.lastSeen > VESSEL_STALE_TTL) vesselStore.delete(mmsi);
  }
  const vessels = Array.from(vesselStore.values());
  vesselCacheJson = JSON.stringify(vessels);
  vesselCacheTs = now;
  return vesselCacheJson;
}

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

async function fetchOpenSky() {
  const now = Date.now();
  const cacheTTL = apiTracker.getAdaptiveTTL('opensky');
  if (openSkyCache.data && (now - openSkyCache.timestamp) < cacheTTL) {
    return { data: openSkyCache.data, cached: true };
  }

  // Check budget before making upstream request
  if (!apiTracker.canRequest('opensky')) {
    if (openSkyCache.data) return { data: openSkyCache.data, cached: true, budgetExhausted: true };
    return { data: { error: 'budget_exhausted', states: null }, cached: false, budgetExhausted: true };
  }

  const url = 'https://opensky-network.org/api/states/all';
  const headers = {};

  // Try OAuth2 bearer token first
  const token = await getOpenSkyToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    apiTracker.recordRequest('opensky');
    const { data, statusCode } = await fetchUrl(url, { headers });

    if (statusCode === 200 && data && data.states) {
      openSkyCache.data = data;
      openSkyCache.timestamp = now;
      return { data, cached: false };
    }

    if (statusCode === 429) {
      apiTracker.recordError('opensky');
      if (openSkyCache.data) {
        return { data: openSkyCache.data, cached: true, rateLimited: true };
      }
      return { data: { error: 'rate_limited', states: null }, cached: false, rateLimited: true };
    }

    apiTracker.recordError('opensky');
    if (openSkyCache.data) {
      return { data: openSkyCache.data, cached: true };
    }
    return { data: data || { error: 'fetch_failed', states: null }, cached: false };
  } catch (err) {
    apiTracker.recordError('opensky');
    if (openSkyCache.data) {
      return { data: openSkyCache.data, cached: true };
    }
    return { data: { error: err.message, states: null }, cached: false };
  }
}

// ============================================
// MERGED FLIGHTS — OpenSky (bbox) + ADSB-X (radius), deduplicated
// Both fetched in parallel with 8-second timeout each
// ============================================
const flightsRegionCache = new Map();

function adsbxToOpenSkyState(ac) {
  return [
    (ac.hex || '').toLowerCase(),       // 0: icao24
    (ac.flight || '').trim(),           // 1: callsign
    ac.r || '',                         // 2: registration/origin
    null, null,                         // 3,4: timestamps
    ac.lon, ac.lat,                     // 5,6: position
    ac.alt_baro === 'ground' ? 0 : (ac.alt_baro ? ac.alt_baro * 0.3048 : null), // 7: baro alt
    ac.alt_baro === 'ground',           // 8: on_ground
    ac.gs ? ac.gs * 0.5144 : null,     // 9: velocity m/s
    ac.track,                           // 10: heading
    ac.baro_rate ? ac.baro_rate * 0.00508 : null, // 11: vert rate
    null,                               // 12: sensors
    ac.alt_geom ? ac.alt_geom * 0.3048 : null, // 13: geo alt
    ac.squawk,                          // 14: squawk
    ac.t || null,                       // 15: ICAO type code (B738, A320, F16, etc.)
    ac.category || null,                // 16: size category (A1-A5, B1-B7, C1-C3)
  ];
}

// Fetch with timeout — prevents hanging forever
function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetchUrl(url, options).then(result => {
      clearTimeout(timer);
      resolve(result);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function fetchFlightsForBbox(lamin, lamax, lomin, lomax) {
  const cacheKey = `${Math.round(lamin)},${Math.round(lamax)},${Math.round(lomin)},${Math.round(lomax)}`;
  const now = Date.now();
  const cached = flightsRegionCache.get(cacheKey);
  const bboxCacheTTL = apiTracker.getAdaptiveTTL('opensky-bbox');
  if (cached && (now - cached.timestamp) < bboxCacheTTL) {
    return { data: cached.data, cached: true, sources: ['cache'] };
  }

  const sources = [];
  const aircraftMap = new Map();

  // Fetch both sources IN PARALLEL with 8-second timeouts (budget-aware)
  const openSkyPromise = (async () => {
    if (!apiTracker.canRequest('opensky-bbox')) return []; // budget exhausted
    try {
      apiTracker.recordRequest('opensky-bbox');
      const token = await getOpenSkyToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const osUrl = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
      const { data, statusCode } = await fetchWithTimeout(osUrl, { headers }, 8000);
      if (statusCode === 200 && data?.states) return data.states;
      apiTracker.recordError('opensky-bbox');
    } catch { apiTracker.recordError('opensky-bbox'); }
    return [];
  })();

  const adsbxPromise = (async () => {
    if (!ADSBX_API_KEY || !apiTracker.canRequest('adsbx')) return [];
    try {
      const la1 = parseFloat(lamin), la2 = parseFloat(lamax);
      const lo1 = parseFloat(lomin), lo2 = parseFloat(lomax);
      const latSpan = Math.abs(la2 - la1);
      const lonSpan = Math.abs(lo2 - lo1);

      // ADSB-X max radius is 250nm (~4.6°). For large bboxes, split into a grid
      // of overlapping circles to cover the full area.
      const MAX_RADIUS_DEG = 4.5; // ~250nm
      const queryPoints = [];

      if (latSpan <= MAX_RADIUS_DEG * 2 && lonSpan <= MAX_RADIUS_DEG * 2) {
        // Small bbox — single center query
        queryPoints.push({ lat: (la1 + la2) / 2, lon: (lo1 + lo2) / 2, dist: 250 });
      } else {
        // Large bbox — grid of query points spaced ~8° apart (overlapping 250nm circles)
        const step = MAX_RADIUS_DEG * 1.6; // slight overlap
        for (let lat = la1 + step / 2; lat < la2; lat += step) {
          for (let lon = lo1 + step / 2; lon < lo2; lon += step) {
            queryPoints.push({ lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10, dist: 250 });
          }
        }
        // Cap at 4 queries to stay within budget
        if (queryPoints.length > 4) {
          // Pick evenly spaced subset
          const stride = Math.ceil(queryPoints.length / 4);
          const subset = [];
          for (let i = 0; i < queryPoints.length && subset.length < 4; i += stride) {
            subset.push(queryPoints[i]);
          }
          queryPoints.length = 0;
          queryPoints.push(...subset);
        }
      }

      // Fetch all query points in parallel
      const allAc = [];
      const results = await Promise.all(queryPoints.map(async (pt) => {
        if (!apiTracker.canRequest('adsbx')) return [];
        try {
          apiTracker.recordRequest('adsbx');
          const adsbxUrl = `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${pt.lat}/lon/${pt.lon}/dist/${pt.dist}/`;
          const { data, statusCode } = await fetchWithTimeout(adsbxUrl, {
            headers: { 'X-RapidAPI-Key': ADSBX_API_KEY, 'X-RapidAPI-Host': 'adsbexchange-com1.p.rapidapi.com' }
          }, 8000);
          if (statusCode === 200 && data?.ac) return data.ac;
          apiTracker.recordError('adsbx');
        } catch { apiTracker.recordError('adsbx'); }
        return [];
      }));
      for (const acs of results) allAc.push(...acs);
      return allAc;
    } catch { apiTracker.recordError('adsbx'); }
    return [];
  })();

  const [openSkyStates, adsbxAircraft] = await Promise.all([openSkyPromise, adsbxPromise]);

  // Merge OpenSky results
  if (openSkyStates.length > 0) {
    sources.push('opensky');
    for (const s of openSkyStates) {
      const icao = (s[0] || '').toLowerCase();
      if (icao && s[5] && s[6]) aircraftMap.set(icao, s);
    }
  }

  // Merge ADSB-X results (only add new aircraft not already from OpenSky)
  if (adsbxAircraft.length > 0) {
    sources.push('adsbx');
    for (const ac of adsbxAircraft) {
      const state = adsbxToOpenSkyState(ac);
      const icao = state[0];
      if (icao && state[5] && state[6] && !aircraftMap.has(icao)) {
        aircraftMap.set(icao, state);
      }
    }
  }

  const states = Array.from(aircraftMap.values());
  const result = { time: Math.floor(now / 1000), states: states.length > 0 ? states : null, sources, count: states.length };

  if (states.length > 0) {
    flightsRegionCache.set(cacheKey, { data: result, timestamp: now });
    if (flightsRegionCache.size > 20) {
      const oldest = flightsRegionCache.keys().next().value;
      flightsRegionCache.delete(oldest);
    }
  }

  return { data: result, cached: false, sources };
}

// ============================================
// GLOBAL FLIGHTS — OpenSky all + ADSB-X multi-region
// ============================================
let globalFlightsCache = { data: null, timestamp: 0 };
const GLOBAL_CACHE_TTL = 45000; // 45 seconds

const GLOBAL_ADSBX_REGIONS = [
  { lat: 51, lon: 5, dist: 250 },     // W Europe
  { lat: 48, lon: 20, dist: 250 },    // E Europe
  { lat: 40, lon: -75, dist: 250 },   // US East
  { lat: 35, lon: -100, dist: 250 },  // US Central
  { lat: 37, lon: -122, dist: 250 },  // US West
  { lat: 25, lon: 55, dist: 250 },    // Middle East
  { lat: 35, lon: 135, dist: 250 },   // Japan/Korea
  { lat: 22, lon: 114, dist: 250 },   // SE Asia
  { lat: -33, lon: 151, dist: 250 },  // Australia
  { lat: 55, lon: 37, dist: 250 },    // Russia/Moscow
];

async function fetchGlobalFlights() {
  const now = Date.now();
  if (globalFlightsCache.data && (now - globalFlightsCache.timestamp) < GLOBAL_CACHE_TTL) {
    return { data: globalFlightsCache.data, cached: true, sources: ['cache'] };
  }

  const sources = [];
  const aircraftMap = new Map();

  // OpenSky global (8s timeout)
  const osPromise = (async () => {
    try {
      const token = await getOpenSkyToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const { data, statusCode } = await fetchWithTimeout(
        'https://opensky-network.org/api/states/all', { headers }, 8000
      );
      if (statusCode === 200 && data?.states) return data.states;
    } catch {}
    return [];
  })();

  // ADSB-X regions in parallel batches of 3 (stay within rate limits)
  const adsbxPromise = (async () => {
    if (!ADSBX_API_KEY) return [];
    const allAc = [];
    for (let i = 0; i < GLOBAL_ADSBX_REGIONS.length; i += 3) {
      const batch = GLOBAL_ADSBX_REGIONS.slice(i, i + 3);
      const results = await Promise.all(batch.map(async r => {
        try {
          const { data, statusCode } = await fetchWithTimeout(
            `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${r.lat}/lon/${r.lon}/dist/${r.dist}/`,
            { headers: { 'X-RapidAPI-Key': ADSBX_API_KEY, 'X-RapidAPI-Host': 'adsbexchange-com1.p.rapidapi.com' } },
            8000
          );
          if (statusCode === 200 && data?.ac) return data.ac;
        } catch {}
        return [];
      }));
      for (const acs of results) allAc.push(...acs);
    }
    return allAc;
  })();

  const [osStates, adsbxAcs] = await Promise.all([osPromise, adsbxPromise]);

  if (osStates.length > 0) {
    sources.push('opensky');
    for (const s of osStates) {
      const icao = (s[0] || '').toLowerCase();
      if (icao && s[5] && s[6]) aircraftMap.set(icao, s);
    }
  }

  if (adsbxAcs.length > 0) {
    sources.push('adsbx');
    for (const ac of adsbxAcs) {
      const state = adsbxToOpenSkyState(ac);
      const icao = state[0];
      if (icao && state[5] && state[6] && !aircraftMap.has(icao)) {
        aircraftMap.set(icao, state);
      }
    }
  }

  const states = Array.from(aircraftMap.values());
  const result = { time: Math.floor(now / 1000), states: states.length > 0 ? states : null, sources, count: states.length };

  if (states.length > 0) {
    globalFlightsCache = { data: result, timestamp: now };
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
// RATE LIMIT HEADERS — attach budget info to every API response
// ============================================
function setRateLimitHeaders(res, api) {
  const info = apiTracker.getBudgetInfo(api);
  res.setHeader('X-RateLimit-Limit', String(info.limit));
  res.setHeader('X-RateLimit-Remaining', String(info.remaining));
  res.setHeader('X-RateLimit-Used', String(info.used));
  res.setHeader('X-Cache-TTL', String(Math.round(info.ttl / 1000)));
  if (info.fallback) res.setHeader('X-Fallback-Source', info.fallback);
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

  // ---- API BUDGET MONITOR (for debugging) ----
  if (urlPath === '/api/budget') {
    res.writeHead(200);
    return res.end(JSON.stringify(apiTracker.getAllBudgets(), null, 2));
  }

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
      setRateLimitHeaders(res, 'opensky');
      res.setHeader('X-Cache', result.cached ? 'HIT' : 'MISS');
      if (result.rateLimited) res.setHeader('X-Rate-Limited', 'true');
      if (result.budgetExhausted) res.setHeader('X-Budget-Exhausted', 'true');
      res.writeHead(200);
      return res.end(JSON.stringify(result.data));
    }

    // ---- MERGED FLIGHTS (OpenSky + ADSB-X, bbox-based, deduplicated) ----
    if (urlPath === '/api/flights') {
      setRateLimitHeaders(res, 'opensky-bbox');
      const global = url.searchParams.get('global') === '1';
      if (global) {
        const result = await fetchGlobalFlights();
        res.setHeader('X-Cache', result.cached ? 'HIT' : 'MISS');
        res.setHeader('X-Sources', (result.sources || []).join(','));
        res.writeHead(200);
        return res.end(JSON.stringify(result.data));
      }
      const lamin = url.searchParams.get('lamin') || '-90';
      const lamax = url.searchParams.get('lamax') || '90';
      const lomin = url.searchParams.get('lomin') || '-180';
      const lomax = url.searchParams.get('lomax') || '180';
      const result = await fetchFlightsForBbox(lamin, lamax, lomin, lomax);
      res.setHeader('X-Cache', result.cached ? 'HIT' : 'MISS');
      res.setHeader('X-Sources', (result.sources || []).join(','));
      res.writeHead(200);
      return res.end(JSON.stringify(result.data));
    }

    // ---- NEWS (with server-side cache + multi-source + budget tracking) ----
    if (urlPath === '/api/news') {
      setRateLimitHeaders(res, 'gnews');
      const q = url.searchParams.get('q') || 'conflict';
      const max = Math.min(parseInt(url.searchParams.get('max')) || 8, 10);

      // Server-side news cache (adaptive TTL based on budget)
      if (!global.newsCache) global.newsCache = {};
      const cacheKey = `news-${q}`;
      const cached = global.newsCache[cacheKey];
      const newsCacheTTL = apiTracker.getAdaptiveTTL('gnews');
      if (cached && Date.now() - cached.ts < newsCacheTTL) {
        res.setHeader('X-Cache', 'HIT');
        res.writeHead(200);
        return res.end(JSON.stringify(cached.data));
      }

      let articles = [];

      // Primary source: GNews (only if budget available)
      if (GNEWS_API_KEY && apiTracker.canRequest('gnews')) {
        try {
          apiTracker.recordRequest('gnews');
          const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=${max}&apikey=${GNEWS_API_KEY}`;
          const { data } = await fetchUrl(gnewsUrl);
          if (data?.articles) articles = data.articles;
          else apiTracker.recordError('gnews');
        } catch { apiTracker.recordError('gnews'); }
      }

      // Secondary/fallback source: Google News RSS (free, no key needed)
      // Always used when GNews budget is exhausted or returns few results
      if (articles.length < 3) {
        apiTracker.recordRequest('google-rss');
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

    // ---- VESSELS (Digitraffic AIS) ----
    if (urlPath === '/api/vessels') {
      const data = getVesselData();
      res.setHeader('X-Vessel-Count', String(vesselStore.size));
      res.writeHead(200);
      return res.end(data);
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

    // ---- SOCIAL CONTENT (GDELT + YouTube RSS + Reddit + Bluesky) ----
    if (urlPath === '/api/social') {
      const region = url.searchParams.get('region') || 'world';
      // Client can pass a better search query via &q= (hotspot.searchQuery)
      const searchQuery = url.searchParams.get('q') || region;
      const cacheKey = `social-${region}`;
      if (!global.socialCache) global.socialCache = {};
      const cached = global.socialCache[cacheKey];
      const socialCacheTTL = apiTracker.getAdaptiveTTL('gdelt');
      if (cached && Date.now() - cached.ts < socialCacheTTL) {
        res.writeHead(200);
        return res.end(JSON.stringify(cached.data));
      }

      const items = [];
      const sourcesStatus = {};
      const seenTitles = new Set(); // dedup across sources

      function addItem(item) {
        // Deduplicate by normalized title
        const key = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
        if (key.length > 10 && seenTitles.has(key)) return;
        seenTitles.add(key);
        items.push(item);
      }

      // SOURCE 1: GDELT (free, no key, geolocated global event articles)
      // Primary source — most reliable for geopolitical content
      try {
        apiTracker.recordRequest('gdelt');
        // Use proper geopolitical search terms, not display names
        const gdeltQuery = encodeURIComponent(searchQuery);
        const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${gdeltQuery}&mode=ArtList&maxrecords=12&format=json&sort=DateDesc&timespan=7d`;
        const { data: gdeltData, statusCode } = await fetchWithTimeout(gdeltUrl, {}, 8000);
        if (statusCode === 200 && gdeltData?.articles) {
          for (const art of gdeltData.articles.slice(0, 8)) {
            if (!art.title) continue;
            addItem({
              id: `gdelt-${items.length}-${Date.now()}`,
              source: 'GDELT',
              type: 'article',
              title: art.title.substring(0, 140),
              author: art.domain || art.sourcecountry || '',
              timestamp: art.seendate || '',
              url: art.url || '',
              thumbnail: art.socialimage || '',
              language: art.language || 'English',
              region,
              relevance: 0.85,
            });
          }
          sourcesStatus.gdelt = 'ok';
        } else {
          apiTracker.recordError('gdelt');
          sourcesStatus.gdelt = 'error';
        }
      } catch { apiTracker.recordError('gdelt'); sourcesStatus.gdelt = 'error'; }

      // SOURCE 2: YouTube RSS (free, no key, no rate limit)
      try {
        const ytQuery = encodeURIComponent(`${searchQuery} news`);
        const ytUrl = `https://www.youtube.com/results?search_query=${ytQuery}&sp=CAI%253D`; // sorted by date
        // YouTube RSS feed via search
        const ytRssUrl = `https://www.youtube.com/feeds/videos.xml?search_query=${ytQuery}`;
        const { data: ytData, statusCode } = await fetchWithTimeout(ytRssUrl, {}, 6000);
        if (statusCode === 200 && typeof ytData === 'string' && ytData.includes('<entry>')) {
          const entries = ytData.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
          for (const entry of entries.slice(0, 5)) {
            const title = entry.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || '';
            const author = entry.match(/<name>(.*?)<\/name>/)?.[1] || '';
            const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || '';
            if (title && videoId) {
              addItem({
                id: `yt-${videoId}`,
                source: 'YouTube',
                type: 'video',
                title: title.substring(0, 120),
                author,
                timestamp: published,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                embedUrl: `https://www.youtube.com/embed/${videoId}`,
                region,
                relevance: 0.7,
              });
            }
          }
          sourcesStatus.youtube = 'ok';
        } else {
          sourcesStatus.youtube = 'no_results';
        }
      } catch { sourcesStatus.youtube = 'error'; }

      // SOURCE 3: Reddit (public JSON — with exponential backoff)
      if (!global._redditBackoff || Date.now() > global._redditBackoff) {
        try {
          const redditQuery = encodeURIComponent(searchQuery);
          const redditUrl = `https://www.reddit.com/search.json?q=${redditQuery}&sort=new&limit=5&t=week&raw_json=1`;
          const { data: redditData, statusCode } = await fetchWithTimeout(redditUrl, {
            headers: { 'User-Agent': 'WarTrack/1.0 (intelligence platform; github.com/DBITDEFENSE/WarTrack)' }
          }, 6000);
          if (statusCode === 200 && redditData?.data?.children) {
            for (const child of redditData.data.children.slice(0, 5)) {
              const post = child.data;
              if (!post || post.over_18 || !post.title) continue;
              addItem({
                id: `reddit-${post.id}`,
                source: 'Reddit',
                type: 'post',
                title: post.title.substring(0, 120),
                text: post.selftext?.substring(0, 200) || '',
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
            sourcesStatus.reddit = 'ok';
            global._redditBackoff = null; // clear backoff on success
            global._redditBackoffMs = 0;
          } else if (statusCode === 429) {
            // Exponential backoff: 30s → 60s → 120s → 240s → 480s (max ~8 min)
            const backoffMs = Math.min(480000, (global._redditBackoffMs || 15000) * 2);
            global._redditBackoff = Date.now() + backoffMs;
            global._redditBackoffMs = backoffMs;
            sourcesStatus.reddit = `rate_limited (backoff ${Math.round(backoffMs/1000)}s)`;
            console.warn(`  Reddit 429 — backing off for ${Math.round(backoffMs/1000)}s`);
          } else {
            sourcesStatus.reddit = `http_${statusCode}`;
          }
        } catch (err) { sourcesStatus.reddit = `error: ${err.message}`; }
      } else {
        const waitSec = Math.round((global._redditBackoff - Date.now()) / 1000);
        sourcesStatus.reddit = `backoff (${waitSec}s remaining)`;
      }

      // SOURCE 4: Bluesky (public search, no auth needed)
      try {
        const bskyQuery = encodeURIComponent(searchQuery);
        const bskyUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${bskyQuery}&limit=5&sort=latest`;
        const { data: bskyData, statusCode } = await fetchWithTimeout(bskyUrl, {}, 6000);
        if (statusCode === 200 && bskyData?.posts) {
          for (const post of bskyData.posts.slice(0, 5)) {
            const text = post.record?.text || '';
            if (!text) continue;
            addItem({
              id: `bsky-${post.uri?.split('/').pop()}`,
              source: 'Bluesky',
              type: 'post',
              title: text.substring(0, 120),
              author: post.author?.displayName || post.author?.handle || '',
              timestamp: post.record?.createdAt || '',
              url: `https://bsky.app/profile/${post.author?.handle}/post/${post.uri?.split('/').pop()}`,
              thumbnail: '',
              region,
              relevance: 0.5,
            });
          }
          sourcesStatus.bluesky = 'ok';
        } else {
          sourcesStatus.bluesky = 'error';
        }
      } catch { sourcesStatus.bluesky = 'error'; }

      // Sort by relevance then recency
      items.sort((a, b) => {
        const relDiff = (b.relevance || 0) - (a.relevance || 0);
        if (Math.abs(relDiff) > 0.1) return relDiff;
        // Within same relevance tier, sort by recency
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });

      const activeSources = Object.entries(sourcesStatus).filter(([,v]) => v === 'ok').map(([k]) => k);
      const result = { items: items.slice(0, 20), region, sources: activeSources, sourcesStatus };
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
      setRateLimitHeaders(res, 'windy');
      if (!WINDY_WEBCAMS_KEY) {
        res.writeHead(200);
        return res.end(JSON.stringify({ webcams: generateSampleCameras(url.searchParams.get('bbox')) }));
      }
      const bbox = url.searchParams.get('bbox') || '60,30,20,-10';
      const cacheKey = 'cam-' + bbox.split(',').map(n => parseFloat(n).toFixed(0)).join(',');
      if (!global.cameraCache) global.cameraCache = {};
      const cached = global.cameraCache[cacheKey];
      const camCacheTTL = apiTracker.getAdaptiveTTL('windy');
      if (cached && Date.now() - cached.ts < camCacheTTL) {
        res.writeHead(200);
        return res.end(JSON.stringify(cached.data));
      }
      try {
        apiTracker.recordRequest('windy');
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
      setRateLimitHeaders(res, 'celestrak');
      const group = url.searchParams.get('group') || 'stations';
      const allowed = ['stations', 'starlink', 'military', 'gps-ops', 'weather', 'active'];
      if (!allowed.includes(group)) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Invalid TLE group' }));
      }
      // Adaptive cache TTL (2hr base, up to 12hr when budget low)
      if (!global.tleCache) global.tleCache = {};
      const cached = global.tleCache[group];
      const tleCacheTTL = apiTracker.getAdaptiveTTL('celestrak');
      if (cached && Date.now() - cached.ts < tleCacheTTL) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('X-Cache', 'HIT');
        res.writeHead(200);
        return res.end(cached.data);
      }
      try {
        apiTracker.recordRequest('celestrak');
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

    // ---- GOOGLE MAPS KEY (for JS API — browser-restricted key is OK to expose) ----
    if (urlPath === '/api/config/google-maps-key') {
      res.writeHead(200);
      return res.end(JSON.stringify({ key: GOOGLE_MAPS_KEY || '' }));
    }

    // ---- STREET VIEW PROXY (keeps Google API key server-side) ----
    if (urlPath === '/api/streetview') {
      if (!GOOGLE_MAPS_KEY) {
        res.writeHead(404);
        return res.end('No Google Maps key configured');
      }
      const lat = url.searchParams.get('lat') || '0';
      const lon = url.searchParams.get('lon') || '0';
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${lat},${lon}&key=${GOOGLE_MAPS_KEY}&return_error_code=true`;
        const imgResp = await new Promise((resolve, reject) => {
          https.get(gUrl, resolve).on('error', reject);
        });
        res.writeHead(imgResp.statusCode, {
          'Content-Type': imgResp.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        });
        imgResp.pipe(res);
        return;
      } catch {
        res.writeHead(500);
        return res.end('Street view fetch failed');
      }
    }

    // ---- STATIC MAP PROXY ----
    if (urlPath === '/api/staticmap') {
      if (!GOOGLE_MAPS_KEY) {
        res.writeHead(404);
        return res.end('No Google Maps key configured');
      }
      const lat = url.searchParams.get('lat') || '0';
      const lon = url.searchParams.get('lon') || '0';
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=16&size=800x400&maptype=satellite&key=${GOOGLE_MAPS_KEY}`;
        const imgResp = await new Promise((resolve, reject) => {
          https.get(gUrl, resolve).on('error', reject);
        });
        res.writeHead(imgResp.statusCode, {
          'Content-Type': imgResp.headers['content-type'] || 'image/png',
          'Cache-Control': 'public, max-age=86400',
        });
        imgResp.pipe(res);
        return;
      } catch {
        res.writeHead(500);
        return res.end('Static map fetch failed');
      }
    }

    // ---- MAPILLARY IMAGE SEARCH PROXY ----
    if (urlPath === '/api/mapillary') {
      if (!MAPILLARY_TOKEN) {
        res.writeHead(200);
        return res.end(JSON.stringify({ data: [] }));
      }
      const lat = parseFloat(url.searchParams.get('lat') || '0');
      const lon = parseFloat(url.searchParams.get('lon') || '0');
      const bbox = `${lon - 0.005},${lat - 0.005},${lon + 0.005},${lat + 0.005}`;
      try {
        const { data, statusCode } = await fetchUrl(
          `https://graph.mapillary.com/images?access_token=${MAPILLARY_TOKEN}&fields=id,thumb_1024_url,thumb_256_url,captured_at,geometry&bbox=${bbox}&limit=1`
        );
        res.writeHead(statusCode === 200 ? 200 : 500);
        return res.end(JSON.stringify(data));
      } catch {
        res.writeHead(200);
        return res.end(JSON.stringify({ data: [] }));
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
  const cam = (id, title, lat, lon, city, country, cats) => ({
    webcamId: id, title, location: { latitude: lat, longitude: lon, city, country },
    categories: cats, status: 'active', urls: { detail: '' }, images: { current: { preview: '' } },
  });
  const cameras = [
    // Major cities
    cam('cam-001', 'Times Square NYC', 40.758, -73.9855, 'New York', 'US', ['city', 'traffic']),
    cam('cam-002', 'Eiffel Tower Paris', 48.8584, 2.2945, 'Paris', 'FR', ['city', 'landscape']),
    cam('cam-003', 'Tower Bridge London', 51.5055, -0.0754, 'London', 'GB', ['city']),
    cam('cam-004', 'Shibuya Crossing Tokyo', 35.6595, 139.7004, 'Tokyo', 'JP', ['city', 'traffic']),
    cam('cam-005', 'Dubai Skyline', 25.1972, 55.2744, 'Dubai', 'AE', ['city', 'landscape']),
    cam('cam-006', 'Sydney Harbour', -33.8568, 151.2153, 'Sydney', 'AU', ['harbor', 'city']),
    cam('cam-007', 'Istanbul Bosphorus', 41.0424, 29.0082, 'Istanbul', 'TR', ['harbor', 'city']),
    cam('cam-008', 'Singapore Marina Bay', 1.2816, 103.8636, 'Singapore', 'SG', ['city', 'harbor']),
    cam('cam-009', 'Moscow Red Square', 55.7539, 37.6208, 'Moscow', 'RU', ['city']),
    cam('cam-010', 'Berlin Brandenburg Gate', 52.5163, 13.3777, 'Berlin', 'DE', ['city']),
    cam('cam-011', 'Rome Colosseum', 41.8902, 12.4922, 'Rome', 'IT', ['city', 'landscape']),
    cam('cam-012', 'Hong Kong Victoria Harbour', 22.2855, 114.1577, 'Hong Kong', 'HK', ['harbor', 'city']),
    cam('cam-013', 'Seoul Gangnam', 37.4979, 127.0276, 'Seoul', 'KR', ['city', 'traffic']),
    cam('cam-014', 'Mumbai Gateway of India', 18.9220, 72.8347, 'Mumbai', 'IN', ['city', 'harbor']),
    cam('cam-015', 'Cairo Pyramids', 29.9792, 31.1342, 'Cairo', 'EG', ['landscape']),
    // Airports
    cam('cam-016', 'LAX Airport', 33.9425, -118.408, 'Los Angeles', 'US', ['airport']),
    cam('cam-017', 'Heathrow Airport', 51.4700, -0.4543, 'London', 'GB', ['airport']),
    cam('cam-018', 'Frankfurt Airport', 50.0379, 8.5622, 'Frankfurt', 'DE', ['airport']),
    cam('cam-019', 'Changi Airport', 1.3644, 103.9915, 'Singapore', 'SG', ['airport']),
    cam('cam-020', 'JFK Airport', 40.6413, -73.7781, 'New York', 'US', ['airport']),
    cam('cam-021', 'Dubai International Airport', 25.2532, 55.3657, 'Dubai', 'AE', ['airport']),
    cam('cam-022', 'Incheon Airport', 37.4602, 126.4407, 'Seoul', 'KR', ['airport']),
    // Ports & harbors
    cam('cam-023', 'Port of Rotterdam', 51.9036, 4.486, 'Rotterdam', 'NL', ['harbor', 'port']),
    cam('cam-024', 'Port of Shanghai', 30.6167, 122.0670, 'Shanghai', 'CN', ['harbor', 'port']),
    cam('cam-025', 'Strait of Gibraltar', 35.9868, -5.6021, 'Tarifa', 'ES', ['harbor', 'landscape']),
    cam('cam-026', 'Suez Canal', 30.5765, 32.2651, 'Ismailia', 'EG', ['harbor']),
    cam('cam-027', 'Panama Canal Miraflores', 9.0153, -79.5900, 'Panama City', 'PA', ['harbor']),
    cam('cam-028', 'Port of Hamburg', 53.5400, 9.9700, 'Hamburg', 'DE', ['harbor', 'port']),
    cam('cam-029', 'Port of Piraeus', 37.9475, 23.6416, 'Athens', 'GR', ['harbor', 'port']),
    cam('cam-030', 'Busan Port', 35.0796, 129.0756, 'Busan', 'KR', ['harbor', 'port']),
    // Strategic / conflict-adjacent
    cam('cam-031', 'Odesa Sea Port', 46.4875, 30.7600, 'Odesa', 'UA', ['harbor']),
    cam('cam-032', 'Sevastopol Bay', 44.6167, 33.5254, 'Sevastopol', 'UA', ['harbor']),
    cam('cam-033', 'Haifa Port', 32.8191, 35.0004, 'Haifa', 'IL', ['harbor']),
    cam('cam-034', 'Taipei 101 Tower', 25.0340, 121.5645, 'Taipei', 'TW', ['city']),
    cam('cam-035', 'Djibouti Port', 11.5921, 43.1456, 'Djibouti', 'DJ', ['harbor']),
    cam('cam-036', 'Aden Harbor', 12.7854, 45.0187, 'Aden', 'YE', ['harbor']),
    cam('cam-037', 'Strait of Hormuz (Muscat)', 23.5880, 58.5922, 'Muscat', 'OM', ['harbor']),
    cam('cam-038', 'Bab el-Mandeb (Djibouti)', 11.8251, 43.2562, 'Obock', 'DJ', ['harbor', 'landscape']),
    // Traffic / infrastructure
    cam('cam-039', 'Autobahn A1 Hamburg', 53.5575, 10.0217, 'Hamburg', 'DE', ['traffic']),
    cam('cam-040', 'M25 London Orbital', 51.3984, -0.2577, 'London', 'GB', ['traffic']),
    cam('cam-041', 'I-405 Los Angeles', 33.9575, -118.3892, 'Los Angeles', 'US', ['traffic']),
    // Scenic / coastal
    cam('cam-042', 'Niagara Falls', 43.0799, -79.0747, 'Niagara Falls', 'CA', ['landscape']),
    cam('cam-043', 'Santorini Caldera', 36.4161, 25.4322, 'Santorini', 'GR', ['landscape', 'beach']),
    cam('cam-044', 'Copacabana Beach Rio', -22.9711, -43.1822, 'Rio de Janeiro', 'BR', ['beach', 'city']),
    cam('cam-045', 'Cape Town Table Mountain', -33.9625, 18.4099, 'Cape Town', 'ZA', ['landscape', 'city']),
    cam('cam-046', 'Reykjavik Harbour', 64.1466, -21.9426, 'Reykjavik', 'IS', ['harbor', 'city']),
    cam('cam-047', 'Nairobi City Centre', -1.2864, 36.8172, 'Nairobi', 'KE', ['city']),
    cam('cam-048', 'Buenos Aires Puerto Madero', -34.6158, -58.3655, 'Buenos Aires', 'AR', ['harbor', 'city']),
    cam('cam-049', 'Helsinki Market Square', 60.1674, 24.9514, 'Helsinki', 'FI', ['city', 'harbor']),
    cam('cam-050', 'Tallinn Old Town', 59.4370, 24.7536, 'Tallinn', 'EE', ['city']),
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
  console.log(`  Data APIs (adaptive rate-limit protection enabled):`);
  console.log(`    /api/flights     — OpenSky + ADSB-X merged (${openSkyCreds ? 'OAuth2' : 'anon'}, 400/day budget)`);
  console.log(`    /api/news?q=     — GNews + Google RSS fallback (${GNEWS_API_KEY ? '100/day budget' : 'RSS-only'})`);
  console.log(`    /api/vessels     — AIS vessel data (Digitraffic, free)`);
  console.log(`    /api/social      — GDELT + Reddit + Bluesky`);
  console.log(`    /api/cameras     — Webcams ${WINDY_WEBCAMS_KEY ? '(Windy, 1000/day)' : '(sample data)'}`);
  console.log(`    /api/budget      — API budget monitor (JSON)`);
  console.log(`  Auth APIs:`);
  console.log(`    POST /api/auth/register`);
  console.log(`    POST /api/auth/login`);
  console.log(`    GET  /api/auth/me`);
  console.log(`  Favorites APIs:`);
  console.log(`    GET/POST/DELETE /api/favorites`);

  // Start vessel AIS polling
  console.log('\n  Starting Digitraffic AIS vessel polling (60s interval)...');
  fetchDigitrafficVessels(); // initial fetch
  setInterval(fetchDigitrafficVessels, VESSEL_FETCH_INTERVAL);
});
