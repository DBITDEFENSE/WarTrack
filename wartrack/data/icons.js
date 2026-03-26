// ============================================
// AIRCRAFT ICON LIBRARY — Precise top-down silhouettes by ICAO type code
// Each SVG is a recognizable planform view of the actual aircraft
// ============================================

export const ICON_CLASS = {
  NARROWBODY: 'narrowbody',
  WIDEBODY:   'widebody',
  REGIONAL:   'regional',
  BIZJET:     'bizjet',
  TURBOPROP:  'turboprop',
  LIGHT:      'light',
  HELICOPTER: 'helicopter',
  FIGHTER:    'fighter',
  HEAVYLIFT:  'heavylift',
  TANKER:     'tanker',
  BOMBER:     'bomber',
  ISR:        'isr',
  UAV:        'uav',
  TILTROTOR:  'tiltrotor',
  GENERIC:    'generic',
};

// ============================================
// SVG SILHOUETTE PATHS — top-down, 32x32 viewBox, nose up
// ============================================
const SHAPES = {
  narrowbody: (c) => `<path d="M16 2 L17.5 8 L16.5 12 L26 17 L26 18.5 L16.5 16 L16.5 26 L20 28.5 L20 30 L16 28.5 L12 30 L12 28.5 L15.5 26 L15.5 16 L6 18.5 L6 17 L15.5 12 L15 8 Z" fill="${c}" opacity="0.92"/>`,

  widebody: (c) => `<path d="M16 1 L18 6 L17 10 L28 15.5 L28 17.5 L17 14.5 L17 25 L21.5 28 L21.5 30 L16 27.5 L10.5 30 L10.5 28 L15 25 L15 14.5 L4 17.5 L4 15.5 L15 10 L14.5 6 Z" fill="${c}" opacity="0.92"/>`,

  regional: (c) => `<path d="M16 3 L17 8 L16.5 11 L23 15.5 L23 17 L16.5 14.5 L16.5 25 L19 27 L19 28.5 L16 27 L13 28.5 L13 27 L15.5 25 L15.5 14.5 L9 17 L9 15.5 L15.5 11 L15.5 8 Z" fill="${c}" opacity="0.92"/>`,

  bizjet: (c) => `<path d="M16 3 L17 9 L16.5 13 L22 16.5 L22 17.5 L16.5 15.5 L16.5 25 L19 27.5 L19 28.5 L16 27 L13 28.5 L13 27.5 L15.5 25 L15.5 15.5 L10 17.5 L10 16.5 L15.5 13 L15.5 9 Z" fill="${c}" opacity="0.92"/>`,

  turboprop: (c) => `<circle cx="11" cy="14" r="1.5" fill="${c}" opacity="0.4"/><circle cx="21" cy="14" r="1.5" fill="${c}" opacity="0.4"/><path d="M16 3 L17 9 L16.5 12 L24 15 L24 16.5 L16.5 14.5 L16.5 25 L19 27 L19 28.5 L16 27 L13 28.5 L13 27 L15.5 25 L15.5 14.5 L8 16.5 L8 15 L15.5 12 L15.5 9 Z" fill="${c}" opacity="0.92"/>`,

  light: (c) => `<path d="M16 5 L17 10 L16.5 13 L22 15.5 L22 16.5 L16.5 15 L16.5 24 L18.5 26 L18.5 27 L16 25.5 L13.5 27 L13.5 26 L15.5 24 L15.5 15 L10 16.5 L10 15.5 L15.5 13 L15.5 10 Z" fill="${c}" opacity="0.85"/>`,

  helicopter: (c) => `<circle cx="16" cy="12" r="8" fill="none" stroke="${c}" stroke-width="0.7" opacity="0.35"/><line x1="8" y1="12" x2="24" y2="12" stroke="${c}" stroke-width="0.5" opacity="0.3"/><path d="M15 8 L17 8 L17 12 L19.5 14 L19.5 15.5 L17 13.5 L17 23 L19 24.5 L15.5 24 L15.5 25.5 L16.5 25.5 L13 24.5 L15 23 L15 13.5 L12.5 15.5 L12.5 14 L15 12 L15 8 Z" fill="${c}" opacity="0.9"/>`,

  fighter: (c) => `<path d="M16 2 L17.5 9 L15.5 12 L24.5 18 L23 19.5 L16 16 L16.5 24 L19 26.5 L19 28 L16 27 L13 28 L13 26.5 L15.5 24 L16 16 L9 19.5 L7.5 18 L16.5 12 L14.5 9 Z" fill="${c}" opacity="0.95"/>`,

  heavylift: (c) => `<path d="M14 1 L18 1 L19 7 L18 11 L27 16 L27 18 L18 15.5 L18 25 L22 28 L22 30 L16 27.5 L10 30 L10 28 L14 25 L14 15.5 L5 18 L5 16 L14 11 L13.5 7 Z" fill="${c}" opacity="0.92"/>`,

  tanker: (c) => `<path d="M16 1 L17.5 7 L16.5 11 L26 16 L26 17.5 L16.5 15 L16.5 25 L20 28 L20 29.5 L16 27.5 L12 29.5 L12 28 L15.5 25 L15.5 15 L6 17.5 L6 16 L15.5 11 L15 7 Z" fill="${c}" opacity="0.92"/><line x1="16" y1="25" x2="16" y2="31.5" stroke="${c}" stroke-width="0.8" opacity="0.5"/>`,

  bomber: (c) => `<path d="M16 1 L18 10 L28 18 L26 20 L18 17 L17 26 L20 29 L16 28 L12 29 L15 26 L14 17 L6 20 L4 18 L14 10 Z" fill="${c}" opacity="0.92"/>`,

  isr: (c) => `<ellipse cx="16" cy="13" rx="8" ry="2.5" fill="${c}" opacity="0.3"/><path d="M16 1 L17.5 7 L16.5 11 L26 15.5 L26 17 L16.5 14.5 L16.5 25 L20 28 L20 29.5 L16 27.5 L12 29.5 L12 28 L15.5 25 L15.5 14.5 L6 17 L6 15.5 L15.5 11 L15 7 Z" fill="${c}" opacity="0.92"/>`,

  uav: (c) => `<path d="M16 4 L16.8 10 L16.5 14 L26 18 L26 19 L16.5 16.5 L16.5 26 L18.5 28 L16 27 L13.5 28 L15.5 26 L15.5 16.5 L6 19 L6 18 L15.5 14 L15.5 10 Z" fill="${c}" opacity="0.9"/>`,

  tiltrotor: (c) => `<circle cx="8" cy="13" r="4" fill="none" stroke="${c}" stroke-width="0.6" opacity="0.3"/><circle cx="24" cy="13" r="4" fill="none" stroke="${c}" stroke-width="0.6" opacity="0.3"/><path d="M15 4 L17 4 L17 11 L24 13 L24 15 L17 13.5 L17 24 L19.5 26 L16 25 L12.5 26 L15 24 L15 13.5 L8 15 L8 13 L15 11 Z" fill="${c}" opacity="0.92"/>`,

  generic: (c) => `<path d="M16 4 L17.5 10 L23 14 L23 15.5 L17 13.5 L17 24 L19.5 26 L16 25 L12.5 26 L15 24 L15 13.5 L9 15.5 L9 14 L14.5 10 Z" fill="${c}" opacity="0.85"/>`,
};

// ============================================
// ICAO TYPE CODE → ICON CLASS (200+ types)
// ============================================
const TYPE_TO_CLASS = {
  // Narrowbody
  B731:'narrowbody',B732:'narrowbody',B733:'narrowbody',B734:'narrowbody',B735:'narrowbody',
  B736:'narrowbody',B737:'narrowbody',B738:'narrowbody',B739:'narrowbody',
  B37M:'narrowbody',B38M:'narrowbody',B39M:'narrowbody',
  A318:'narrowbody',A319:'narrowbody',A320:'narrowbody',A321:'narrowbody',
  A19N:'narrowbody',A20N:'narrowbody',A21N:'narrowbody',
  B752:'narrowbody',B753:'narrowbody',C919:'narrowbody',MC21:'narrowbody',
  // Widebody
  B744:'widebody',B748:'widebody',B74S:'widebody',
  B762:'widebody',B763:'widebody',B764:'widebody',
  B772:'widebody',B773:'widebody',B77L:'widebody',B77W:'widebody',
  B788:'widebody',B789:'widebody',B78X:'widebody',
  A332:'widebody',A333:'widebody',A338:'widebody',A339:'widebody',
  A342:'widebody',A343:'widebody',A345:'widebody',A346:'widebody',
  A359:'widebody',A35K:'widebody',A388:'widebody',
  IL96:'widebody',MD11:'widebody',DC10:'widebody',
  // Regional
  E170:'regional',E75L:'regional',E75S:'regional',E190:'regional',E195:'regional',
  E290:'regional',E295:'regional',CRJ2:'regional',CRJ7:'regional',CRJ9:'regional',
  CRJX:'regional',E135:'regional',E145:'regional',RJ85:'regional',RJ1H:'regional',SU95:'regional',
  // Turboprop
  AT43:'turboprop',AT45:'turboprop',AT72:'turboprop',AT75:'turboprop',AT76:'turboprop',
  DH8A:'turboprop',DH8B:'turboprop',DH8C:'turboprop',DH8D:'turboprop',
  SF34:'turboprop',JS41:'turboprop',SB20:'turboprop',AN24:'turboprop',AN26:'turboprop',
  B350:'turboprop',B200:'turboprop',PC12:'turboprop',TBM7:'turboprop',TBM8:'turboprop',TBM9:'turboprop',
  // Bizjet
  C525:'bizjet',C550:'bizjet',C560:'bizjet',C56X:'bizjet',C680:'bizjet',C700:'bizjet',
  CL30:'bizjet',CL35:'bizjet',CL60:'bizjet',
  GL5T:'bizjet',GL7T:'bizjet',GLEX:'bizjet',GLF4:'bizjet',GLF5:'bizjet',GLF6:'bizjet',
  LJ35:'bizjet',LJ45:'bizjet',LJ60:'bizjet',
  FA50:'bizjet',FA7X:'bizjet',FA8X:'bizjet',F900:'bizjet',
  E35L:'bizjet',E50P:'bizjet',E55P:'bizjet',PRM1:'bizjet',PC24:'bizjet',
  GALX:'bizjet',G150:'bizjet',G200:'bizjet',G280:'bizjet',
  // Light/GA
  C172:'light',C182:'light',C206:'light',C208:'light',C210:'light',
  P28A:'light',P28B:'light',PA32:'light',PA34:'light',PA46:'light',
  BE36:'light',BE58:'light',SR20:'light',SR22:'light',
  DA40:'light',DA42:'light',DA62:'light',M20P:'light',M20T:'light',
  // Helicopter
  EC35:'helicopter',EC45:'helicopter',EC55:'helicopter',EC75:'helicopter',
  H135:'helicopter',H145:'helicopter',H155:'helicopter',H160:'helicopter',H175:'helicopter',
  A139:'helicopter',A169:'helicopter',A189:'helicopter',
  AS50:'helicopter',AS55:'helicopter',AS65:'helicopter',
  B06:'helicopter',B212:'helicopter',B412:'helicopter',B429:'helicopter',
  S76:'helicopter',S92:'helicopter',R22:'helicopter',R44:'helicopter',R66:'helicopter',
  UH60:'helicopter',H60:'helicopter',H64:'helicopter',
  // Military fighters
  F16:'fighter',F15:'fighter',F18:'fighter',F22:'fighter',F35:'fighter',FA18:'fighter',
  EUFI:'fighter',RFAL:'fighter',GRIF:'fighter',TORN:'fighter',
  SU27:'fighter',SU30:'fighter',SU34:'fighter',SU35:'fighter',
  MG29:'fighter',MG31:'fighter',J10:'fighter',J20:'fighter',JAS:'fighter',
  // Military transport
  C17:'heavylift',C5M:'heavylift',C5:'heavylift',C130:'heavylift',C30J:'heavylift',
  L100:'heavylift',A400:'heavylift',AN12:'heavylift',AN22:'heavylift',IL76:'heavylift',
  // Tanker
  KC46:'tanker',K35R:'tanker',KC10:'tanker',MRTT:'tanker',
  // ISR
  E3CF:'isr',E3TF:'isr',E6B:'isr',E8:'isr',P8:'isr',P3:'isr',P8A:'isr',RC35:'isr',
  // Bomber
  B1:'bomber',B1B:'bomber',B52:'bomber',B52H:'bomber',B2:'bomber',
  // UAV
  RQ4:'uav',MQ9:'uav',MQ1:'uav',
  // Tiltrotor
  V22:'tiltrotor',
};

// Size category fallback
const CATEGORY_TO_CLASS = {
  'A1':'light','A2':'turboprop','A3':'narrowbody','A4':'widebody','A5':'widebody',
  'A6':'widebody','A7':'helicopter','B1':'uav','B2':'light','B4':'uav',
};

// ============================================
// ICON CACHE + GENERATOR
// ============================================
const ICON_CACHE = new Map();

export function getAircraftIcon(iconClass, color) {
  const key = `${iconClass}-${color}`;
  if (ICON_CACHE.has(key)) return ICON_CACHE.get(key);
  const shapeFn = SHAPES[iconClass] || SHAPES.generic;
  const uri = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${shapeFn(color)}</svg>`
  )}`;
  ICON_CACHE.set(key, uri);
  return uri;
}

export function resolveIconClass(typeCode, category, isMilitary) {
  if (typeCode) {
    const u = typeCode.toUpperCase().trim();
    if (TYPE_TO_CLASS[u]) return TYPE_TO_CLASS[u];
    if (TYPE_TO_CLASS[u.substring(0,3)]) return TYPE_TO_CLASS[u.substring(0,3)];
    if (TYPE_TO_CLASS[u.substring(0,2)]) return TYPE_TO_CLASS[u.substring(0,2)];
  }
  if (category && CATEGORY_TO_CLASS[category]) return CATEGORY_TO_CLASS[category];
  if (isMilitary) return 'fighter';
  return 'generic';
}

export function getThermalIcon() {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#fff" opacity="0.12"/><circle cx="8" cy="8" r="4" fill="#fff" opacity="0.35"/><circle cx="8" cy="8" r="2" fill="#fff" opacity="0.95"/></svg>`
  )}`;
}

export const AIRCRAFT_COLORS = { military: '#ff3344', civilian: '#00ddff', thermal: '#ffffff' };
