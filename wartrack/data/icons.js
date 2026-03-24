// ============================================
// AIRCRAFT ICON LIBRARY — SVG silhouettes by type class
// Each returns a data URI. Color parameterized for mil/civ/thermal.
// ============================================

// Icon category constants
export const ICON_CLASS = {
  FIGHTER:    'fighter',
  AIRLINER:   'airliner',
  WIDEBODY:   'widebody',
  REGIONAL:   'regional',
  BOMBER:     'bomber',
  CARGO:      'cargo',
  TANKER:     'tanker',
  HELICOPTER: 'helicopter',
  ISR:        'isr',       // reconnaissance / surveillance / AWACS
  UAV:        'uav',       // drone
  LIGHT:      'light',     // general aviation
  TILTROTOR:  'tiltrotor',
  TRANSPORT:  'transport',
  GENERIC:    'generic',   // fallback
};

function svg(width, height, pathData, color, opacity = 0.9) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${pathData(color, opacity)}</svg>`
  )}`;
}

// ============================================
// SILHOUETTE PATHS — top-down view
// ============================================
const SILHOUETTES = {
  // Fighter jet — swept wings, twin tail
  fighter: (c, o) => `
    <path d="M16 2 L18 8 L14 8 L14 12 L24 16 L24 18 L14 15 L14 22 L18 25 L18 27 L16 26 L14 27 L12 26 L10 27 L10 25 L14 22 L14 15 L4 18 L4 16 L14 12 L14 8 L10 8 Z"
          fill="${c}" opacity="${o}" transform="translate(2,0)"/>`,

  // Airliner — narrow body, swept wings, T-tail
  airliner: (c, o) => `
    <path d="M14 1 L16 6 L15 10 L24 15 L24 17 L15 14 L15 24 L19 27 L19 29 L14 27 L14 29 L14 27 L9 29 L9 27 L13 24 L13 14 L4 17 L4 15 L13 10 L13 6 Z"
          fill="${c}" opacity="${o}"/>`,

  // Widebody — larger, wider wings
  widebody: (c, o) => `
    <path d="M15 1 L17 5 L16 9 L27 14 L27 16 L16 13 L16 23 L21 27 L21 29 L15 26 L15 29 L15 26 L9 29 L9 27 L14 23 L14 13 L3 16 L3 14 L14 9 L14 5 Z"
          fill="${c}" opacity="${o}" transform="translate(-1,0)"/>`,

  // Regional — smaller wings, turboprop feel
  regional: (c, o) => `
    <path d="M12 2 L14 7 L13 10 L20 14 L20 15 L13 13 L13 22 L16 25 L16 26 L12 24 L12 26 L12 24 L8 26 L8 25 L11 22 L11 13 L4 15 L4 14 L11 10 L11 7 Z"
          fill="${c}" opacity="${o}" transform="translate(2,0)"/>`,

  // Bomber — delta/flying wing
  bomber: (c, o) => `
    <path d="M16 2 L18 10 L28 18 L26 20 L18 16 L17 26 L20 29 L16 28 L12 29 L15 26 L14 16 L6 20 L4 18 L14 10 Z"
          fill="${c}" opacity="${o}"/>`,

  // Cargo / Transport — fat fuselage, high wings
  cargo: (c, o) => `
    <path d="M14 1 L17 1 L18 6 L17 10 L26 15 L26 17 L17 14 L17 24 L21 27 L21 29 L15.5 26 L15.5 29 L15.5 26 L10 29 L10 27 L14 24 L14 14 L5 17 L5 15 L14 10 L14 6 Z"
          fill="${c}" opacity="${o}"/>`,

  // Tanker — similar to cargo but with boom
  tanker: (c, o) => `
    <path d="M14 0 L17 0 L18 6 L17 10 L26 14 L26 16 L17 13 L17 24 L21 27 L21 28 L15.5 26 L15.5 31 L15.5 26 L10 28 L10 27 L14 24 L14 13 L5 16 L5 14 L14 10 L14 6 Z"
          fill="${c}" opacity="${o}"/>`,

  // Helicopter — rotor disc suggested
  helicopter: (c, o) => `
    <circle cx="14" cy="10" r="7" fill="none" stroke="${c}" stroke-width="0.8" opacity="${o * 0.4}"/>
    <path d="M13 6 L15 6 L15 10 L18 12 L18 14 L15 12 L15 22 L18 24 L13 23 L13 25 L13 23 L8 24 L11 22 L11 12 L8 14 L8 12 L11 10 L11 6 Z"
          fill="${c}" opacity="${o}"/>`,

  // ISR / AWACS — distinctive radome
  isr: (c, o) => `
    <ellipse cx="15" cy="12" rx="8" ry="2.5" fill="${c}" opacity="${o * 0.35}"/>
    <path d="M14 1 L16 5 L15 9 L23 13 L23 15 L15 12 L15 23 L19 26 L19 28 L14.5 25 L14.5 28 L14.5 25 L10 28 L10 26 L14 23 L14 12 L6 15 L6 13 L14 9 L14 5 Z"
          fill="${c}" opacity="${o}"/>`,

  // UAV / Drone — long slender wings, V-tail
  uav: (c, o) => `
    <path d="M12 3 L13 8 L12.5 12 L22 16 L22 17 L12.5 14 L12.5 24 L15 26 L12.5 25 L10 26 L12.5 24 L12.5 14 L3 17 L3 16 L12.5 12 L12 8 Z"
          fill="${c}" opacity="${o}" transform="translate(2,0)"/>`,

  // Light / GA — Cessna-style high wing
  light: (c, o) => `
    <path d="M10 3 L12 8 L11 11 L18 14 L18 15 L11 13 L11 20 L14 22 L14 23 L10.5 21 L10.5 23 L10.5 21 L7 23 L7 22 L10 20 L10 13 L3 15 L3 14 L10 11 L10 8 Z"
          fill="${c}" opacity="${o}" transform="translate(4,0)"/>`,

  // Tiltrotor — V-22 Osprey style
  tiltrotor: (c, o) => `
    <circle cx="6" cy="12" r="4" fill="none" stroke="${c}" stroke-width="0.7" opacity="${o * 0.35}"/>
    <circle cx="22" cy="12" r="4" fill="none" stroke="${c}" stroke-width="0.7" opacity="${o * 0.35}"/>
    <path d="M13 4 L15 4 L15 10 L22 12 L22 14 L15 12 L15 22 L18 24 L14 23 L14 25 L14 23 L10 24 L13 22 L13 12 L6 14 L6 12 L13 10 Z"
          fill="${c}" opacity="${o}"/>`,

  // Transport — military cargo variant
  transport: (c, o) => `
    <path d="M14 1 L17 1 L18 6 L17 10 L26 15 L26 17 L17 14 L17 24 L21 27 L21 29 L15.5 26 L15.5 29 L15.5 26 L10 29 L10 27 L14 24 L14 14 L5 17 L5 15 L14 10 L14 6 Z"
          fill="${c}" opacity="${o}"/>`,

  // Generic fallback — simple aircraft diamond
  generic: (c, o) => `
    <path d="M14 3 L16 9 L22 12 L16 15 L15 23 L14 18 L13 23 L12 15 L6 12 L12 9 Z"
          fill="${c}" opacity="${o}"/>`,
};

// ============================================
// ICON GENERATOR — returns data URI for given class + color
// ============================================
const ICON_CACHE = new Map();

export function getAircraftIcon(iconClass, color, size = 28) {
  const key = `${iconClass}-${color}-${size}`;
  if (ICON_CACHE.has(key)) return ICON_CACHE.get(key);

  const pathFn = SILHOUETTES[iconClass] || SILHOUETTES.generic;
  const viewSize = iconClass === 'helicopter' || iconClass === 'tiltrotor' ? 28 : 30;
  const uri = svg(viewSize, viewSize, pathFn, color);
  ICON_CACHE.set(key, uri);
  return uri;
}

// ============================================
// THERMAL DOT — used for all aircraft in thermal mode
// ============================================
export function getThermalIcon() {
  // White-hot thermal dot with bloom halo
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
      <circle cx="8" cy="8" r="7" fill="#ffffff" opacity="0.12"/>
      <circle cx="8" cy="8" r="4" fill="#ffffff" opacity="0.35"/>
      <circle cx="8" cy="8" r="2" fill="#ffffff" opacity="0.95"/>
    </svg>`
  )}`;
}

// ============================================
// MIL vs CIV COLORS
// ============================================
export const AIRCRAFT_COLORS = {
  military: '#ff3344',
  civilian: '#00ddff',
  thermal:  '#ffe0a0',
};
