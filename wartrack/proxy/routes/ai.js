// ============================================
// AI ROUTES — Claude API for summaries + ElevenLabs TTS
// ============================================

import https from 'https';
import http from 'http';

// API keys — same fallbacks as server.js so they're available regardless of import order
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

// Strip markdown code fences from Claude responses
function stripCodeFences(text) {
  if (!text) return text;
  // Remove ```json ... ``` or ``` ... ```
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

// Cache briefing for 30 minutes
let briefingCache = { data: null, timestamp: 0 };
const BRIEFING_CACHE_TTL = 30 * 60 * 1000;

// ============================================
// CLAUDE SUMMARY
// ============================================
async function callClaude(systemPrompt, userPrompt) {
  console.log('  [AI] callClaude invoked, API key configured:', !!ANTHROPIC_API_KEY);

  if (!ANTHROPIC_API_KEY) {
    console.error('  [AI] ERROR: No ANTHROPIC_API_KEY');
    return { error: 'no_api_key', message: 'Set ANTHROPIC_API_KEY environment variable' };
  }

  let Anthropic;
  try {
    const mod = await import('@anthropic-ai/sdk');
    Anthropic = mod.default;
    console.log('  [AI] Anthropic SDK loaded');
  } catch (err) {
    console.error('  [AI] ERROR: SDK import failed:', err.message);
    return { error: 'sdk_missing', message: 'Install @anthropic-ai/sdk' };
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  try {
    console.log('  [AI] Calling Claude (claude-sonnet-4-20250514)...');
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.text || '';
    console.log('  [AI] Claude response received:', text.substring(0, 100) + '...');
    return { text };
  } catch (err) {
    console.error('  [AI] ERROR: Claude API call failed:', err.message);
    return { error: 'api_error', message: err.message };
  }
}

// ============================================
// ELEVENLABS TTS
// ============================================
function callElevenLabs(text) {
  return new Promise((resolve, reject) => {
    if (!ELEVENLABS_API_KEY) {
      return reject(new Error('Set ELEVENLABS_API_KEY environment variable'));
    }

    const body = JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.65,
        similarity_boost: 0.75,
      }
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      }
    };

    console.log('  [TTS] Calling ElevenLabs, voice:', ELEVENLABS_VOICE_ID, 'text length:', text.length);
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('  [TTS] Audio received, size:', Buffer.concat(chunks).length, 'bytes');
          resolve(Buffer.concat(chunks));
        } else {
          const errBody = Buffer.concat(chunks).toString().substring(0, 200);
          console.error('  [TTS] ERROR:', res.statusCode, errBody);
          reject(new Error(`ElevenLabs ${res.statusCode}: ${errBody}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================
// ROUTE HANDLER
// ============================================
export async function handleAI(req, res, urlPath, body) {
  // POST /api/summary — generate world briefing
  if (urlPath === '/api/summary' && req.method === 'POST') {
    // Check cache
    const now = Date.now();
    if (briefingCache.data && (now - briefingCache.timestamp) < BRIEFING_CACHE_TTL && !body?.refresh) {
      res.writeHead(200);
      return res.end(JSON.stringify({ ...briefingCache.data, cached: true }));
    }

    if (!ANTHROPIC_API_KEY) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        error: 'no_api_key',
        briefing: 'NEXUS is offline. Set ANTHROPIC_API_KEY to enable AI briefings.',
        highlights: [],
        topStories: body?.articles?.slice(0, 5) || [],
        closingRemark: 'Configure your API key to bring me online, operator.',
        cached: false,
      }));
    }

    const articles = body?.articles || [];
    const articleSummary = articles.slice(0, 15).map((a, i) =>
      `[${i + 1}] ${a.title || 'Untitled'} — ${a.source?.name || 'Unknown'} (${a.hotspot || 'Global'})`
    ).join('\n');

    const currentDate = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are NEXUS, the WarTrack Tactical Intelligence Analyst — an AI embedded in a global situational awareness command center.

PERSONALITY: Polished, composed, precise. Dry wit, understated humor. Calm tactical analyst energy.

COMMUNICATION STYLE: Lead with critical intelligence. Use precise terminology. Keep briefings under 150 words. End with a brief dry observation.

GEOPOLITICAL FRAMEWORK (use for accurate analysis):
- NATO alliance: US, UK, France, Germany, Poland, Turkey, and 26 other members. Article 5 collective defense.
- Russia: Adversarial to NATO. Engaged in Ukraine conflict since 2022. Allies: Belarus, partial support from Iran, North Korea.
- China (PRC): Strategic competitor to US. Claims Taiwan, South China Sea islands. Partners with Russia but not formal military ally.
- Taiwan: Self-governing, claimed by PRC. Supported by US/Japan informally (no formal defense treaty).
- Iran: Backs Houthi rebels (Yemen), Hezbollah (Lebanon), Hamas (Gaza). Adversarial to Israel, Saudi Arabia, US.
- Houthis: Iran-backed, attacking Red Sea shipping since late 2023. Target commercial and military vessels.
- Israel: In conflict in Gaza since Oct 2023. Normalized relations with UAE, Bahrain (Abraham Accords). Adversarial to Iran.
- North Korea: Nuclear-armed, allied with China/Russia. Adversarial to South Korea, Japan, US.
- India: Non-aligned but QUAD member (with US, Japan, Australia). Border tensions with China and Pakistan.

ESCALATION ASSESSMENT:
- GREEN (normal): diplomatic statements, routine exercises, trade disputes
- YELLOW (elevated): military repositioning, sanctions escalation, naval deployments, airspace incursions
- RED (critical): armed clashes, weapons use, territory seizure, civilian targeting, nuclear signaling

CONSTRAINTS: Base analysis ONLY on provided headlines. Do NOT speculate beyond what evidence supports. Flag uncertainty. Distinguish between confirmed reports and unverified claims. Prioritize wire services (Reuters, AP, AFP) over opinion pieces.`;

    const userPrompt = `Current date: ${currentDate}

Analyze these intelligence reports and produce a world situation briefing.

NEWS INTELLIGENCE:
${articleSummary || 'No current intelligence feeds available.'}

Respond in valid JSON only (no markdown):
{
  "briefing": "2-3 sentence executive summary grounded in the actual headlines above",
  "highlights": [
    { "region": "name", "severity": "high|elevated|watch", "insight": "1 sentence assessment based on evidence in the headlines" }
  ],
  "closingRemark": "Brief dry tactical observation (1 sentence)"
}`;

    const result = await callClaude(systemPrompt, userPrompt);

    if (result.error) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        error: result.error,
        briefing: `NEXUS encountered an issue: ${result.message}`,
        highlights: [],
        topStories: articles.slice(0, 5),
        closingRemark: '',
        cached: false,
      }));
    }

    // Parse Claude's JSON response
    let parsed;
    try {
      parsed = JSON.parse(stripCodeFences(result.text));
    } catch {
      parsed = {
        briefing: result.text.substring(0, 300),
        highlights: [],
        closingRemark: '',
      };
    }

    const response = {
      ...parsed,
      topStories: articles.slice(0, 5),
      cached: false,
      timestamp: now,
    };

    briefingCache = { data: response, timestamp: now };

    res.writeHead(200);
    return res.end(JSON.stringify(response));
  }

  // POST /api/tts — text to speech via ElevenLabs
  if (urlPath === '/api/tts' && req.method === 'POST') {
    if (!ELEVENLABS_API_KEY) {
      res.writeHead(200);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Set ELEVENLABS_API_KEY environment variable' }));
    }

    const text = body?.text || '';
    if (!text) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'text field required' }));
    }

    try {
      const audioBuffer = await callElevenLabs(text);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.writeHead(200);
      return res.end(audioBuffer);
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // POST /api/analysis — AI analysis of a specific region/entity
  if (urlPath === '/api/analysis' && req.method === 'POST') {
    const { region, severity, summary, articles } = body || {};

    if (!ANTHROPIC_API_KEY) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        analysis: 'NEXUS is offline. Configure Anthropic API key for AI analysis.',
        error: 'no_api_key',
      }));
    }

    const systemPrompt = `You are NEXUS, a tactical intelligence analyst. You provide concise, precise situation assessments. Dry wit, composed, professional. Never more than 100 words.`;

    const userPrompt = `Provide a tactical assessment of: ${region || 'Unknown region'}
Current severity: ${severity || 'unknown'}
Current status: ${summary || 'No status available'}
Recent headlines:
${articles || 'No recent intelligence'}

Respond in JSON only (no markdown):
{
  "analysis": "2-3 sentence tactical assessment",
  "threatLevel": "one-word threat level (CRITICAL/HIGH/ELEVATED/MODERATE/LOW)",
  "recommendation": "1 sentence tactical recommendation"
}`;

    const result = await callClaude(systemPrompt, userPrompt);

    if (result.error) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        analysis: `Assessment unavailable: ${result.message}`,
        error: result.error,
      }));
    }

    let parsed;
    try {
      parsed = JSON.parse(stripCodeFences(result.text));
    } catch {
      parsed = { analysis: result.text.substring(0, 300) };
    }

    res.writeHead(200);
    return res.end(JSON.stringify(parsed));
  }

  // POST /api/market-analysis — AI sentiment for defense/geopolitical stocks
  if (urlPath === '/api/market-analysis' && req.method === 'POST') {
    const { movers, sectors } = body || {};

    if (!ANTHROPIC_API_KEY) {
      res.writeHead(200);
      return res.end(JSON.stringify({ error: 'no_api_key', brief: 'NEXUS market analysis offline.' }));
    }

    // Cache for 15 minutes
    if (!global.marketAnalysisCache) global.marketAnalysisCache = { data: null, ts: 0 };
    if (global.marketAnalysisCache.data && Date.now() - global.marketAnalysisCache.ts < 900000 && !body?.refresh) {
      res.writeHead(200);
      return res.end(JSON.stringify(global.marketAnalysisCache.data));
    }

    const systemPrompt = `You are NEXUS, a defense/geopolitical market analyst embedded in WarTrack. Concise, precise, tactical. Analyze defense, aerospace, shipping, energy, and gold stocks through a geopolitical lens. Never give investment advice. State observations, not recommendations.`;

    const userPrompt = `Analyze these defense/geopolitical sector stock movements:

${movers || 'No specific mover data available.'}

Sector breakdown: ${sectors || 'defense, aerospace, maritime, energy, gold'}

Respond in JSON only (no markdown):
{
  "brief": "2-3 sentence market intelligence summary connecting moves to geopolitical context",
  "sectors": [
    { "name": "sector name", "sentiment": "bullish|bearish|neutral", "reason": "1 sentence why" }
  ],
  "topMovers": [
    { "ticker": "SYM", "sentiment": "positive|negative|neutral", "reason": "1 sentence connecting to geopolitics" }
  ]
}`;

    const result = await callClaude(systemPrompt, userPrompt);
    if (result.error) {
      res.writeHead(200);
      return res.end(JSON.stringify({ error: result.error, brief: 'Market analysis unavailable.' }));
    }

    let parsed;
    try {
      parsed = JSON.parse(stripCodeFences(result.text));
    } catch {
      parsed = { brief: result.text.substring(0, 300), sectors: [], topMovers: [] };
    }

    global.marketAnalysisCache = { data: parsed, ts: Date.now() };
    res.writeHead(200);
    return res.end(JSON.stringify(parsed));
  }

  // POST /api/entity-insight — "Why This Matters" for any entity
  if (urlPath === '/api/entity-insight' && req.method === 'POST') {
    const { entityType, entityData } = body || {};

    if (!ANTHROPIC_API_KEY) {
      res.writeHead(200);
      return res.end(JSON.stringify({ insight: 'NEXUS offline. Configure API key.', error: 'no_api_key' }));
    }

    // Cache per entity
    const cacheKey = `insight-${entityType}-${entityData?.id || entityData?.callsign || entityData?.name || 'unknown'}`;
    if (!global.insightCache) global.insightCache = {};
    const cached = global.insightCache[cacheKey];
    if (cached && Date.now() - cached.ts < 900000) { // 15 min
      res.writeHead(200);
      return res.end(JSON.stringify(cached.data));
    }

    const systemPrompt = `You are NEXUS, a geopolitical intelligence analyst. Provide concise "why this matters" assessments. Be precise, factual, and grounded. Distinguish confirmed facts from assessment. Max 80 words total.

GEOPOLITICAL CONTEXT: NATO vs Russia (Ukraine conflict), US-China competition (Taiwan, SCS), Iran proxy network (Houthis, Hezbollah), North Korea nuclear program. Current date: ${new Date().toISOString().split('T')[0]}.`;

    let context = '';
    if (entityType === 'flight') {
      const d = entityData;
      context = `Aircraft: ${d.callsign || 'Unknown'}, ICAO: ${d.icao24 || ''}, Origin: ${d.origin || ''}, Military: ${d.isMilitary ? 'YES' : 'NO'}, Class: ${d.iconClass || ''}, Alt: ${d.altitude ? Math.round(d.altitude * 3.281) + 'ft' : '?'}, Nation: ${d.nation?.name || d.origin || '?'}`;
    } else if (entityType === 'vessel') {
      const d = entityData;
      context = `Vessel: ${d.name || 'Unknown'}, MMSI: ${d.mmsi || ''}, Type: ${d.shipType || ''}, Flag: ${d.flag || ''}, Destination: ${d.destination || ''}, Speed: ${d.speed || '?'} kts`;
    } else if (entityType === 'satellite') {
      const d = entityData;
      context = `Satellite: ${d.name || 'Unknown'}, NORAD: ${d.noradId || ''}, Category: ${d.category || ''}, Alt: ${d.altitude ? Math.round(d.altitude / 1000) + 'km' : '?'}`;
    } else {
      context = JSON.stringify(entityData || {}).substring(0, 300);
    }

    const userPrompt = `Assess this ${entityType}:
${context}

Respond in JSON only (no markdown):
{
  "insight": "2-3 sentences explaining why this entity matters in the current geopolitical context",
  "actors": "Key actors/parties involved (1 line)",
  "implications": "Possible significance or implications (1 line)"
}`;

    const result = await callClaude(systemPrompt, userPrompt);
    if (result.error) {
      res.writeHead(200);
      return res.end(JSON.stringify({ insight: `Assessment unavailable: ${result.message}`, error: result.error }));
    }

    let parsed;
    try { parsed = JSON.parse(stripCodeFences(result.text)); }
    catch { parsed = { insight: result.text.substring(0, 300) }; }

    global.insightCache[cacheKey] = { data: parsed, ts: Date.now() };
    res.writeHead(200);
    return res.end(JSON.stringify(parsed));
  }

  // POST /api/nexus — Map-aware intelligence advisor
  if (urlPath === '/api/nexus' && req.method === 'POST') {
    const { query, conversationHistory, liveContext } = body || {};

    if (!query) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'query required' }));
    }

    if (!ANTHROPIC_API_KEY) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        briefing: 'NEXUS is offline. Configure Anthropic API key.',
        error: 'no_api_key'
      }));
    }

    // Build live data context string for the prompt
    let liveDataSection = '';
    if (liveContext) {
      liveDataSection = `\n\nLIVE WARTRACK DATA (REAL-TIME):
- Total tracked aircraft: ${liveContext.totalFlights}
- Military signatures: ${liveContext.totalMilitary}
- Vessels tracked: ${liveContext.totalVessels}
- GPS anomaly cells: ${liveContext.jammingCells}
- Satellites overhead: ${liveContext.satellites}`;

      if (liveContext.globalSummary && liveContext.globalSummary.length > 0) {
        liveDataSection += '\n\nTHREAT ASSESSMENT (correlation engine):';
        for (const r of liveContext.globalSummary) {
          liveDataSection += `\n- ${r.region}: ${r.threatLevel} (score ${r.score}) — ${r.milAircraft} MIL aircraft, ${r.vessels} vessels, ${r.jammingCells} jamming cells. ${r.topSignal}`;
        }
      }
      liveDataSection += '\n\nIMPORTANT: Reference this live data in your briefing when relevant. Say "our sensors show" or "WarTrack is tracking" to ground your analysis in real data.';
    }

    const systemPrompt = `You are NEXUS, a map-aware intelligence advisor embedded in WarTrack — a global situational awareness command center. You answer geopolitical questions and tie them to specific locations on the globe.

PERSONALITY: Composed, precise, dry confidence. Tactical analyst energy. Concise — never more than 120 words in your briefing.
${liveDataSection}

GEOPOLITICAL CONTEXT:
- NATO vs Russia (Ukraine conflict since 2022)
- US-China competition (Taiwan Strait, South China Sea)
- Iran proxy network (Houthis in Yemen targeting Red Sea shipping, Hezbollah, Hamas)
- Israel-Gaza conflict (since Oct 2023)
- North Korea nuclear/missile program
Current date: ${new Date().toISOString().split('T')[0]}

KNOWN WARTRACK HOTSPOT REGIONS (use these coordinates when matching):
- Ukraine Front: lat 48.5, lon 31.2 (severity: high)
- Taiwan Strait: lat 23.5, lon 120.0 (severity: elevated)
- Red Sea / Houthi Zone: lat 15.0, lon 42.5 (severity: high)
- Strait of Hormuz: lat 26.5, lon 56.3 (severity: elevated)
- Gaza Strip: lat 31.4, lon 34.4 (severity: high)
- South China Sea: lat 12.0, lon 114.0 (severity: elevated)
- North Korea DMZ: lat 38.3, lon 127.0 (severity: watch)

INSTRUCTIONS:
1. Identify the geographic location the user is asking about
2. If it matches a known hotspot, use those exact coordinates
3. If not a known hotspot, estimate reasonable lat/lon from your knowledge
4. Provide a concise intelligence briefing grounded in current geopolitical reality
5. Distinguish confirmed facts from assessment

Respond in JSON only (no markdown):
{
  "location": { "name": "region name", "lat": number, "lon": number },
  "briefing": "concise intelligence assessment (max 120 words)",
  "severity": "high|elevated|watch|low",
  "recommendation": "1 sentence — what to monitor",
  "audioText": "same as briefing but optimized for spoken delivery"
}

If the query is not location-specific (e.g., "where are tensions highest?"), set location to the most relevant hotspot and explain in the briefing.`;

    // Build conversation context
    let contextMessages = [{ role: 'user', content: query }];
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const recent = conversationHistory.slice(-4); // last 2 exchanges
      contextMessages = [...recent, { role: 'user', content: query }];
    }

    const result = await callClaude(systemPrompt, query);

    if (result.error) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        briefing: `NEXUS encountered an issue: ${result.message}`,
        error: result.error
      }));
    }

    let parsed;
    try {
      parsed = JSON.parse(stripCodeFences(result.text));
    } catch {
      parsed = { briefing: result.text.substring(0, 500), location: null };
    }

    res.writeHead(200);
    return res.end(JSON.stringify(parsed));
  }

  return false;
}
