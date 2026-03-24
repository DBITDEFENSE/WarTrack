// ============================================
// PLANET DATA — Orbital elements, display info, position computation
// Simplified Keplerian elements from JPL (valid ~2000-2050)
// ============================================

// Earth's mean radius in meters
const EARTH_RADIUS = 6371000;

// Planets with orbital elements (J2000 epoch, rates per century)
// a = semi-major axis (AU), e = eccentricity, I = inclination (deg)
// L = mean longitude (deg), w = longitude of perihelion (deg), O = longitude of ascending node (deg)
export const PLANETS = [
  {
    name: 'Moon',
    color: '#ccccdd',
    glowColor: '#aaaacc',
    radiusKm: 1737,
    displayScale: 1,
    distanceLabel: '384,400 km',
    dayLength: '29.5 Earth days',
    yearLength: '27.3 days (orbit)',
    moons: 0,
    description: 'Earth\'s only natural satellite. Target of renewed exploration via Artemis program.',
    isMoon: true,
    // Extended stats
    massKg: '7.34 × 10²² kg',
    gravity: '1.62 m/s²',
    tempRange: '-173°C to 127°C',
    atmosphere: 'None (trace exosphere)',
    composition: 'Silicate rock, iron core',
    // Missions
    missions: [
      { name: 'Artemis Program', type: 'CREWED', status: 'ACTIVE', agency: 'NASA', year: '2022-present', desc: 'Return humans to the Moon' },
      { name: 'Chang\'e 6', type: 'SAMPLE RETURN', status: 'COMPLETED', agency: 'CNSA', year: '2024', desc: 'Far-side sample return' },
      { name: 'Chandrayaan-3', type: 'LANDER', status: 'COMPLETED', agency: 'ISRO', year: '2023', desc: 'South pole landing' },
      { name: 'SLIM', type: 'LANDER', status: 'COMPLETED', agency: 'JAXA', year: '2024', desc: 'Precision lunar lander' },
      { name: 'Lunar Reconnaissance Orbiter', type: 'ORBITER', status: 'ACTIVE', agency: 'NASA', year: '2009-present', desc: 'High-res lunar mapping' },
    ],
  },
  {
    name: 'Sun',
    color: '#ffdd44',
    glowColor: '#ffaa00',
    radiusKm: 696340,
    displayScale: 0.05, // heavily compressed
    distanceLabel: '149.6 million km',
    dayLength: '25 Earth days',
    yearLength: '--',
    moons: 0,
    description: 'Our star. G-type main-sequence. Powers all life on Earth.',
    isSun: true,
    massKg: '1.989 × 10³⁰ kg',
    gravity: '274 m/s²',
    tempRange: '5,500°C (surface)',
    atmosphere: 'Hydrogen, Helium plasma',
    composition: '73% Hydrogen, 25% Helium',
    missions: [
      { name: 'Parker Solar Probe', type: 'PROBE', status: 'ACTIVE', agency: 'NASA', year: '2018-present', desc: 'Closest approach to Sun' },
      { name: 'Solar Orbiter', type: 'ORBITER', status: 'ACTIVE', agency: 'ESA/NASA', year: '2020-present', desc: 'Solar polar observations' },
    ],
    a: 1.00000261, e: 0.01671123, I: 0,
    L: 100.46457166, w: 102.93768193, O: 0,
  },
  {
    name: 'Mercury',
    color: '#aa8866',
    glowColor: '#997755',
    radiusKm: 2440,
    displayScale: 0.1,
    distanceLabel: '77.3 million km',
    dayLength: '58.6 Earth days',
    yearLength: '88 Earth days',
    moons: 0,
    description: 'Smallest planet. Extreme temperature swings. Heavily cratered.',
    massKg: '3.30 × 10²³ kg', gravity: '3.7 m/s²', tempRange: '-180°C to 430°C',
    atmosphere: 'Trace (sodium, potassium)', composition: 'Iron core, silicate mantle',
    missions: [
      { name: 'MESSENGER', type: 'ORBITER', status: 'COMPLETED', agency: 'NASA', year: '2011-2015', desc: 'First Mercury orbiter' },
      { name: 'BepiColombo', type: 'ORBITER', status: 'EN ROUTE', agency: 'ESA/JAXA', year: '2018-2025', desc: 'Dual orbiter mission' },
    ],
    a: 0.38709927, e: 0.20563593, I: 7.00497902,
    L: 252.25032350, w: 77.45779628, O: 48.33076593,
    aRate: 0.00000037, eRate: 0.00001906, IRate: -0.00594749,
    LRate: 149472.67411175, wRate: 0.16047689, ORate: -0.12534081,
  },
  {
    name: 'Venus',
    color: '#eedd88',
    glowColor: '#ddcc66',
    radiusKm: 6052,
    displayScale: 0.1,
    distanceLabel: '108.2 million km',
    dayLength: '243 Earth days',
    yearLength: '225 Earth days',
    moons: 0,
    description: 'Hottest planet due to runaway greenhouse effect. Dense CO2 atmosphere.',
    massKg: '4.87 × 10²⁴ kg', gravity: '8.87 m/s²', tempRange: '462°C (surface)',
    atmosphere: '96.5% CO2, 3.5% N2', composition: 'Silicate rock, iron core',
    missions: [
      { name: 'Akatsuki', type: 'ORBITER', status: 'ACTIVE', agency: 'JAXA', year: '2015-present', desc: 'Venus climate orbiter' },
      { name: 'VERITAS', type: 'ORBITER', status: 'PLANNED', agency: 'NASA', year: '~2031', desc: 'Venus radar mapping' },
    ],
    a: 0.72333566, e: 0.00677672, I: 3.39467605,
    L: 181.97909950, w: 131.60246718, O: 76.67984255,
    aRate: 0.00000390, eRate: -0.00004107, IRate: -0.00078890,
    LRate: 58517.81538729, wRate: 0.00268329, ORate: -0.27769418,
  },
  {
    name: 'Mars',
    color: '#ee5533',
    glowColor: '#cc4422',
    radiusKm: 3390,
    displayScale: 0.1,
    distanceLabel: '227.9 million km',
    dayLength: '24h 37m',
    yearLength: '687 Earth days',
    moons: 2,
    description: 'Most explored planet after Earth. Active rovers on surface. Primary target for human colonization.',
    massKg: '6.42 × 10²³ kg', gravity: '3.72 m/s²', tempRange: '-87°C to -5°C',
    atmosphere: '95% CO2, 2.7% N2', composition: 'Iron oxide surface, basaltic rock',
    hasRoverPhotos: true,
    missions: [
      { name: 'Perseverance', type: 'ROVER', status: 'ACTIVE', agency: 'NASA', year: '2021-present', desc: 'Sample collection, Jezero Crater' },
      { name: 'Curiosity', type: 'ROVER', status: 'ACTIVE', agency: 'NASA', year: '2012-present', desc: 'Gale Crater exploration' },
      { name: 'Ingenuity', type: 'HELICOPTER', status: 'COMPLETED', agency: 'NASA', year: '2021-2024', desc: 'First powered flight on another planet' },
      { name: 'Mars Express', type: 'ORBITER', status: 'ACTIVE', agency: 'ESA', year: '2003-present', desc: 'Longest-serving Mars orbiter' },
      { name: 'MAVEN', type: 'ORBITER', status: 'ACTIVE', agency: 'NASA', year: '2014-present', desc: 'Atmospheric loss studies' },
      { name: 'Tianwen-1/Zhurong', type: 'ROVER', status: 'HIBERNATING', agency: 'CNSA', year: '2021-present', desc: 'Utopia Planitia exploration' },
    ],
    a: 1.52371034, e: 0.09339410, I: 1.84969142,
    L: -4.55343205, w: -23.94362959, O: 49.55953891,
    aRate: 0.00001847, eRate: 0.00007882, IRate: -0.00813131,
    LRate: 19140.30268499, wRate: 0.44441088, ORate: -0.29257343,
  },
  {
    name: 'Jupiter',
    color: '#ddaa66',
    glowColor: '#cc9955',
    radiusKm: 69911,
    displayScale: 0.01,
    distanceLabel: '778.5 million km',
    dayLength: '9h 56m',
    yearLength: '11.9 Earth years',
    moons: 95,
    description: 'Largest planet. Massive magnetic field. Great Red Spot storm. 95 known moons including Europa.',
    massKg: '1.898 × 10²⁷ kg', gravity: '24.79 m/s²', tempRange: '-145°C (cloud top)',
    atmosphere: '89% H2, 10% He', composition: 'Gas giant, metallic hydrogen interior',
    missions: [
      { name: 'Juno', type: 'ORBITER', status: 'ACTIVE', agency: 'NASA', year: '2016-present', desc: 'Jupiter polar orbiter, magnetic field study' },
      { name: 'Europa Clipper', type: 'ORBITER', status: 'EN ROUTE', agency: 'NASA', year: '2024-2030', desc: 'Europa ocean investigation' },
      { name: 'JUICE', type: 'ORBITER', status: 'EN ROUTE', agency: 'ESA', year: '2023-2031', desc: 'Jupiter icy moons explorer' },
    ],
    a: 5.20288700, e: 0.04838624, I: 1.30439695,
    L: 34.39644051, w: 14.72847983, O: 100.47390909,
    aRate: -0.00011607, eRate: -0.00013253, IRate: -0.00183714,
    LRate: 3034.74612775, wRate: 0.21252668, ORate: 0.20469106,
  },
  {
    name: 'Saturn',
    color: '#eedd99',
    glowColor: '#ddcc88',
    radiusKm: 58232,
    displayScale: 0.01,
    distanceLabel: '1.43 billion km',
    dayLength: '10h 42m',
    yearLength: '29.5 Earth years',
    moons: 146,
    description: 'Famous ring system. Least dense planet (would float in water). 146 known moons including Titan.',
    massKg: '5.683 × 10²⁶ kg', gravity: '10.44 m/s²', tempRange: '-178°C (cloud top)',
    atmosphere: '96% H2, 3% He', composition: 'Gas giant, hydrogen/helium',
    hasRings: true,
    missions: [
      { name: 'Cassini-Huygens', type: 'ORBITER', status: 'COMPLETED', agency: 'NASA/ESA', year: '2004-2017', desc: '13-year Saturn system study' },
      { name: 'Dragonfly', type: 'ROTORCRAFT', status: 'PLANNED', agency: 'NASA', year: '~2034', desc: 'Titan rotorcraft lander' },
    ],
    a: 9.53667594, e: 0.05386179, I: 2.48599187,
    L: 49.95424423, w: 92.59887831, O: 113.66242448,
    aRate: -0.00125060, eRate: -0.00050991, IRate: 0.00193609,
    LRate: 1222.49362201, wRate: -0.41897216, ORate: -0.28867794,
  },
  {
    name: 'Uranus',
    color: '#88ccdd',
    glowColor: '#66aabb',
    radiusKm: 25362,
    displayScale: 0.005,
    distanceLabel: '2.87 billion km',
    dayLength: '17h 14m',
    yearLength: '84 Earth years',
    moons: 28,
    description: 'Ice giant tilted 98° on its axis. Faint ring system. 28 known moons.',
    massKg: '8.681 × 10²⁵ kg', gravity: '8.69 m/s²', tempRange: '-224°C',
    atmosphere: '83% H2, 15% He, 2% CH4', composition: 'Ice giant, water/ammonia/methane',
    missions: [
      { name: 'Voyager 2', type: 'FLYBY', status: 'COMPLETED', agency: 'NASA', year: '1986', desc: 'Only spacecraft to visit Uranus' },
      { name: 'Uranus Orbiter', type: 'ORBITER', status: 'PROPOSED', agency: 'NASA', year: '~2030s', desc: 'Decadal Survey priority mission' },
    ],
    a: 19.18916464, e: 0.04725744, I: 0.77263783,
    L: 313.23810451, w: 170.95427630, O: 74.01692503,
    aRate: -0.00196176, eRate: -0.00004397, IRate: -0.00242939,
    LRate: 428.48202785, wRate: 0.40805281, ORate: 0.04240589,
  },
  {
    name: 'Neptune',
    color: '#4466ff',
    glowColor: '#3355dd',
    radiusKm: 24622,
    displayScale: 0.005,
    distanceLabel: '4.50 billion km',
    dayLength: '16h 6m',
    yearLength: '165 Earth years',
    moons: 16,
    description: 'Farthest planet. Strongest winds in solar system (2,100 km/h). 16 known moons including Triton.',
    massKg: '1.024 × 10²⁶ kg', gravity: '11.15 m/s²', tempRange: '-214°C',
    atmosphere: '80% H2, 19% He, 1% CH4', composition: 'Ice giant, water/ammonia/methane',
    missions: [
      { name: 'Voyager 2', type: 'FLYBY', status: 'COMPLETED', agency: 'NASA', year: '1989', desc: 'Only spacecraft to visit Neptune' },
    ],
    a: 30.06992276, e: 0.00859048, I: 1.77004347,
    L: -55.12002969, w: 44.96476227, O: 131.78422574,
    aRate: 0.00026291, eRate: 0.00005105, IRate: 0.00035372,
    LRate: 218.45945325, wRate: -0.32241464, ORate: -0.00508664,
  },
];

// ============================================
// PROCEDURAL PLANET ICON GENERATOR — canvas-rendered
// ============================================
const planetIconCache = new Map();

export function generatePlanetIcon(planet, size = 64) {
  const key = `${planet.name}-${size}`;
  if (planetIconCache.has(key)) return planetIconCache.get(key);

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size * 0.35;

  // Outer atmospheric glow
  const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.6);
  glowGrad.addColorStop(0, planet.glowColor + '40');
  glowGrad.addColorStop(1, planet.glowColor + '00');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, size, size);

  // Planet body
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();

  // Body gradient — simulate 3D lighting (light from top-left)
  const bodyGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  bodyGrad.addColorStop(0, lightenColor(planet.color, 40));
  bodyGrad.addColorStop(0.5, planet.color);
  bodyGrad.addColorStop(1, darkenColor(planet.color, 60));
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Planet-specific surface detail
  if (planet.name === 'Jupiter') {
    // Horizontal bands
    ctx.save();
    ctx.clip();
    for (let i = -4; i <= 4; i++) {
      const y = cy + i * (r * 0.2);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(180,130,80,0.25)' : 'rgba(200,160,100,0.15)';
      ctx.fillRect(cx - r, y - r * 0.08, r * 2, r * 0.16);
    }
    // Great Red Spot
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.2, cy + r * 0.15, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,80,50,0.4)';
    ctx.fill();
    ctx.restore();
  } else if (planet.name === 'Mars') {
    // Polar ice cap
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.75, r * 0.5, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
    // Dark surface feature
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.1, cy + r * 0.1, r * 0.4, r * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100,40,20,0.2)';
    ctx.fill();
    ctx.restore();
  } else if (planet.name === 'Moon') {
    // Crater-like dark patches (maria)
    ctx.save();
    ctx.clip();
    const craters = [[0.15, -0.1, 0.2], [-0.2, 0.15, 0.15], [0.05, 0.25, 0.12], [-0.1, -0.25, 0.1]];
    for (const [dx, dy, cr] of craters) {
      ctx.beginPath();
      ctx.arc(cx + dx * r, cy + dy * r, cr * r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(80,80,100,0.25)';
      ctx.fill();
    }
    ctx.restore();
  } else if (planet.hasRings) {
    // Saturn rings
    ctx.save();
    ctx.strokeStyle = planet.color + '88';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.7, r * 0.35, -0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = planet.color + '55';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.5, r * 0.3, -0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (planet.isSun) {
    // Corona rays
    ctx.save();
    ctx.clip();
    const coronaGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
    coronaGrad.addColorStop(0, 'rgba(255,255,200,0.3)');
    coronaGrad.addColorStop(1, 'rgba(255,200,50,0)');
    ctx.fillStyle = coronaGrad;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  // Atmosphere rim highlight
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r);
  rimGrad.addColorStop(0, 'rgba(255,255,255,0)');
  rimGrad.addColorStop(1, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = rimGrad;
  ctx.fill();

  const dataUrl = c.toDataURL();
  planetIconCache.set(key, dataUrl);
  return dataUrl;
}

function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1,3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3,5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5,7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, amount) {
  const r = Math.max(0, parseInt(hex.slice(1,3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3,5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5,7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

// ============================================
// POSITION COMPUTATION
// ============================================
const AU_TO_M = 149597870700; // 1 AU in meters
const DEG = Math.PI / 180;

// Julian date from JS Date
function toJulianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Centuries from J2000
function centuriesFromJ2000(jd) {
  return (jd - 2451545.0) / 36525.0;
}

// Solve Kepler's equation M = E - e*sin(E) via Newton's method
function solveKepler(M, e, tol = 1e-8) {
  let E = M;
  for (let i = 0; i < 20; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

// Compute planet position relative to Sun, return Earth-centered Cartesian3
export function computePlanetPosition(planet, jsDate) {
  if (planet.isMoon) {
    return computeMoonPosition(jsDate);
  }

  const jd = toJulianDate(jsDate);
  const T = centuriesFromJ2000(jd);

  // Current orbital elements
  const a = (planet.a + (planet.aRate || 0) * T) * AU_TO_M;
  const e = planet.e + (planet.eRate || 0) * T;
  const I = (planet.I + (planet.IRate || 0) * T) * DEG;
  const L = (planet.L + (planet.LRate || 0) * T) * DEG;
  const w = (planet.w + (planet.wRate || 0) * T) * DEG;
  const O = (planet.O + (planet.ORate || 0) * T) * DEG;

  // Mean anomaly
  const M = L - w;
  const E = solveKepler(M, e);

  // Heliocentric position in orbital plane
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // Rotate to ecliptic
  const cosO = Math.cos(O), sinO = Math.sin(O);
  const cosI = Math.cos(I), sinI = Math.sin(I);
  const cosW = Math.cos(w - O), sinW = Math.sin(w - O);

  const x = (cosO * cosW - sinO * sinW * cosI) * xp + (-cosO * sinW - sinO * cosW * cosI) * yp;
  const y = (sinO * cosW + cosO * sinW * cosI) * xp + (-sinO * sinW + cosO * cosW * cosI) * yp;
  const z = (sinW * sinI) * xp + (cosW * sinI) * yp;

  // Get Earth's heliocentric position (Sun element = Earth opposite)
  const earthA = 1.00000261 * AU_TO_M;
  const earthE = 0.01671123;
  const earthL = (100.46457166 + 35999.37244981 * T) * DEG;
  const earthW = 102.93768193 * DEG;
  const earthM = earthL - earthW;
  const earthEcc = solveKepler(earthM, earthE);
  const exP = earthA * (Math.cos(earthEcc) - earthE);
  const eyP = earthA * Math.sqrt(1 - earthE * earthE) * Math.sin(earthEcc);
  // Earth is approximately in the ecliptic plane (I ≈ 0)
  const ex = Math.cos(earthW) * exP - Math.sin(earthW) * eyP;
  const ey = Math.sin(earthW) * exP + Math.cos(earthW) * eyP;

  // Earth-centered position (apply display scale compression)
  const scale = planet.displayScale || 1;
  const dx = (x - ex) * scale;
  const dy = (y - ey) * scale;
  const dz = z * scale;

  // Convert ecliptic to ECEF (simplified: ecliptic ≈ equatorial for display)
  // CesiumJS uses ECEF, so we place objects relative to Earth center
  return new Cesium.Cartesian3(dx, dy, dz);
}

// ============================================
// MOON POSITION (simplified)
// ============================================
function computeMoonPosition(jsDate) {
  const jd = toJulianDate(jsDate);
  const T = centuriesFromJ2000(jd);

  // Simplified lunar position (Brown's theory, main terms only)
  const L0 = (218.3165 + 481267.8813 * T) * DEG; // mean longitude
  const M = (134.9634 + 477198.8676 * T) * DEG; // mean anomaly
  const F = (93.2721 + 483202.0175 * T) * DEG; // argument of latitude

  const lon = L0 + 6.289 * DEG * Math.sin(M);
  const lat = 5.128 * DEG * Math.sin(F);
  const dist = 384400000; // meters (mean distance)

  // Convert to ECEF-like Cartesian
  const x = dist * Math.cos(lat) * Math.cos(lon);
  const y = dist * Math.cos(lat) * Math.sin(lon);
  const z = dist * Math.sin(lat);

  return new Cesium.Cartesian3(x, y, z);
}
