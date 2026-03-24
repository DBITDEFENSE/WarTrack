// ============================================
// AIRCRAFT CLASSIFIER — resolves icon class + nation from OpenSky data
// Uses ICAO hex → country, callsign → operator, military DB
// ============================================

import { ICON_CLASS } from './icons.js';

// ============================================
// ICAO HEX → COUNTRY mapping (first 2 hex chars)
// Based on ICAO address allocation blocks
// ============================================
const ICAO_COUNTRY = {
  '00': { code: 'ZZ', name: 'Unknown' },
  '01': { code: 'ZZ', name: 'Unknown' },
  '02': { code: 'ZZ', name: 'Unknown' },
  '0A': { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  '0B': { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  '0C': { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  '0D': { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  '0E': { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  '0F': { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  '10': { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  '14': { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  '20': { code: 'US', name: 'United States', flag: '🇺🇸' },
  '33': { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  '34': { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  '38': { code: 'FR', name: 'France', flag: '🇫🇷' },
  '39': { code: 'FR', name: 'France', flag: '🇫🇷' },
  '3A': { code: 'FR', name: 'France', flag: '🇫🇷' },
  '3B': { code: 'FR', name: 'France', flag: '🇫🇷' },
  '3C': { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  '3D': { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  '3E': { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  '3F': { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  '40': { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  '41': { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  '42': { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  '43': { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  '44': { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  '45': { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  '46': { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  '47': { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  '48': { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  '49': { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  '4A': { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  '4B': { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  '4C': { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  '4D': { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  '50': { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  '51': { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  '60': { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  '68': { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  '70': { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  '71': { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  '72': { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  '73': { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  '74': { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  '78': { code: 'CN', name: 'China', flag: '🇨🇳' },
  '79': { code: 'CN', name: 'China', flag: '🇨🇳' },
  '7A': { code: 'CN', name: 'China', flag: '🇨🇳' },
  '7B': { code: 'CN', name: 'China', flag: '🇨🇳' },
  '7C': { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  '7D': { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  '80': { code: 'IN', name: 'India', flag: '🇮🇳' },
  '81': { code: 'IN', name: 'India', flag: '🇮🇳' },
  '84': { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  '85': { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  '86': { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  '87': { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  '88': { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  '89': { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  'A0': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'A1': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'A2': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'A3': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'A4': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'A5': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'A6': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'A7': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'A8': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'A9': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'AA': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'AB': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'AC': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'AD': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'AE': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'AF': { code: 'US', name: 'United States', flag: '🇺🇸' },
  'C0': { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  'C1': { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  'C2': { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  'C3': { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  'C8': { code: 'IN', name: 'India', flag: '🇮🇳' },
  'C9': { code: 'IN', name: 'India', flag: '🇮🇳' },
  'E0': { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  'E4': { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  'E8': { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  '89': { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  '70': { code: 'AU', name: 'Australia', flag: '🇦🇺' },
};

// ============================================
// ORIGIN COUNTRY → FLAG emoji
// Maps OpenSky state[2] "origin_country" string to flag emoji
// ============================================
const COUNTRY_FLAGS = {
  'United States': '🇺🇸', 'Canada': '🇨🇦', 'United Kingdom': '🇬🇧',
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Italy': '🇮🇹', 'Spain': '🇪🇸',
  'Netherlands': '🇳🇱', 'Belgium': '🇧🇪', 'Switzerland': '🇨🇭',
  'Austria': '🇦🇹', 'Portugal': '🇵🇹', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
  'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Poland': '🇵🇱', 'Czechia': '🇨🇿',
  'Czech Republic': '🇨🇿', 'Romania': '🇷🇴', 'Hungary': '🇭🇺',
  'Greece': '🇬🇷', 'Turkey': '🇹🇷', 'Ireland': '🇮🇪', 'Iceland': '🇮🇸',
  'Russia': '🇷🇺', 'Ukraine': '🇺🇦', 'China': '🇨🇳', 'Japan': '🇯🇵',
  'South Korea': '🇰🇷', 'Republic of Korea': '🇰🇷', 'India': '🇮🇳',
  'Australia': '🇦🇺', 'New Zealand': '🇳🇿', 'Israel': '🇮🇱',
  'Saudi Arabia': '🇸🇦', 'United Arab Emirates': '🇦🇪', 'Qatar': '🇶🇦',
  'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'Mexico': '🇲🇽', 'Colombia': '🇨🇴',
  'Chile': '🇨🇱', 'Singapore': '🇸🇬', 'Thailand': '🇹🇭', 'Malaysia': '🇲🇾',
  'Indonesia': '🇮🇩', 'Philippines': '🇵🇭', 'Vietnam': '🇻🇳',
  'Pakistan': '🇵🇰', 'Iran': '🇮🇷', 'Iraq': '🇮🇶',
  'South Africa': '🇿🇦', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬', 'Morocco': '🇲🇦',
  'Ethiopia': '🇪🇹', 'Kenya': '🇰🇪', 'Taiwan': '🇹🇼',
  'Luxembourg': '🇱🇺', 'Malta': '🇲🇹', 'Cyprus': '🇨🇾',
  'Hong Kong': '🇭🇰', 'Bermuda': '🇧🇲', 'Cayman Islands': '🇰🇾',
  'Latvia': '🇱🇻', 'Lithuania': '🇱🇹', 'Estonia': '🇪🇪',
  'Bulgaria': '🇧🇬', 'Croatia': '🇭🇷', 'Slovenia': '🇸🇮', 'Serbia': '🇷🇸',
  'Slovakia': '🇸🇰',
};

// ============================================
// MILITARY CALLSIGN → AIRCRAFT TYPE inference
// ============================================
const CALLSIGN_TYPE_MAP = {
  // USAF/NATO ISR & AWACS
  'FORTE':  ICON_CLASS.UAV,       // RQ-4 Global Hawk
  'GLOBAL': ICON_CLASS.UAV,       // RQ-4
  'REAPER': ICON_CLASS.UAV,       // MQ-9
  'SIGNT':  ICON_CLASS.ISR,       // Signals intelligence
  'AWACS':  ICON_CLASS.ISR,       // E-3 Sentry
  'SENTRY': ICON_CLASS.ISR,       // E-3
  'RIVET':  ICON_CLASS.ISR,       // RC-135
  'HOMER':  ICON_CLASS.ISR,       // P-8
  'JAKE':   ICON_CLASS.ISR,       // P-8 / P-3

  // Tankers
  'LAGR':   ICON_CLASS.TANKER,    // KC-135/KC-46
  'NCHO':   ICON_CLASS.TANKER,    // KC-10/KC-46

  // Transport / Cargo
  'RCH':    ICON_CLASS.TRANSPORT, // AMC (Air Mobility Command)
  'REACH':  ICON_CLASS.TRANSPORT,
  'CASA':   ICON_CLASS.TRANSPORT,
  'MOOSE':  ICON_CLASS.TRANSPORT, // C-17
  'ATLAS':  ICON_CLASS.TRANSPORT, // A400M

  // Fighters
  'VIPER':  ICON_CLASS.FIGHTER,
  'SNAKE':  ICON_CLASS.FIGHTER,
  'WOLF':   ICON_CLASS.FIGHTER,
  'HAWK':   ICON_CLASS.FIGHTER,
  'RAPTOR': ICON_CLASS.FIGHTER,
  'TALON':  ICON_CLASS.FIGHTER,
  'LANCE':  ICON_CLASS.FIGHTER,
  'BOXER':  ICON_CLASS.FIGHTER,
  'FURY':   ICON_CLASS.FIGHTER,
  'SPIKE':  ICON_CLASS.FIGHTER,
  'ROGUE':  ICON_CLASS.FIGHTER,
  'DARK':   ICON_CLASS.FIGHTER,

  // Bombers
  'DOOM':   ICON_CLASS.BOMBER,
  'BONE':   ICON_CLASS.BOMBER,    // B-1B
  'DEATH':  ICON_CLASS.BOMBER,

  // Helicopters
  'EVAC':   ICON_CLASS.HELICOPTER,
  'PEDRO':  ICON_CLASS.HELICOPTER,
  'DUSTOFF':ICON_CLASS.HELICOPTER,

  // Tiltrotor
  'KNIFE':  ICON_CLASS.TILTROTOR, // V-22
  'BULL':   ICON_CLASS.TRANSPORT,

  // Misc military
  'DUKE':   ICON_CLASS.TRANSPORT,
  'JOINT':  ICON_CLASS.TRANSPORT,
  'MAGIC':  ICON_CLASS.ISR,
  'GIANT':  ICON_CLASS.TRANSPORT,
  'IRON':   ICON_CLASS.TRANSPORT,
  'STEEL':  ICON_CLASS.TRANSPORT,
  'VALOR':  ICON_CLASS.TRANSPORT,
  'BRAVE':  ICON_CLASS.FIGHTER,
  'STORM':  ICON_CLASS.FIGHTER,
  'STRIKE': ICON_CLASS.FIGHTER,
  'SCOUT':  ICON_CLASS.ISR,
  'COBRA':  ICON_CLASS.HELICOPTER,
  'TOPCAT': ICON_CLASS.FIGHTER,
};

// ============================================
// ICAO TYPE CODE → ICON CLASS (from aircraft-types.json icon field)
// ============================================
const TYPE_ICON_MAP = {
  'airliner':  ICON_CLASS.AIRLINER,
  'widebody':  ICON_CLASS.WIDEBODY,
  'regional':  ICON_CLASS.REGIONAL,
  'light':     ICON_CLASS.LIGHT,
  'fighter':   ICON_CLASS.FIGHTER,
  'bomber':    ICON_CLASS.BOMBER,
  'transport': ICON_CLASS.TRANSPORT,
  'cargo':     ICON_CLASS.CARGO,
  'tanker':    ICON_CLASS.TANKER,
  'isr':       ICON_CLASS.ISR,
  'uav':       ICON_CLASS.UAV,
  'helicopter':ICON_CLASS.HELICOPTER,
  'tiltrotor': ICON_CLASS.TILTROTOR,
};

// ============================================
// MAIN CLASSIFIER
// ============================================
export function classifyIconType(ac, aircraftTypesDB) {
  // 1. Try aircraft type database lookup (if we have typeInfo)
  if (ac.typeInfo && ac.typeInfo.icon) {
    const mapped = TYPE_ICON_MAP[ac.typeInfo.icon];
    if (mapped) return mapped;
  }

  // 2. Try callsign pattern matching for military aircraft
  if (ac.isMilitary && ac.callsign) {
    const cs = ac.callsign.trim().toUpperCase();
    for (const [prefix, iconClass] of Object.entries(CALLSIGN_TYPE_MAP)) {
      if (cs.startsWith(prefix)) return iconClass;
    }
    // Default military = generic military silhouette (fighter-like)
    return ICON_CLASS.FIGHTER;
  }

  // 3. Civilian fallback by altitude/speed heuristics
  if (!ac.isMilitary) {
    const altFt = (ac.altitude || 0) * 3.281;
    const spdKts = (ac.velocity || 0) * 1.944;

    // High altitude + high speed = airliner/widebody
    if (altFt > 30000 && spdKts > 350) return ICON_CLASS.WIDEBODY;
    if (altFt > 20000 && spdKts > 250) return ICON_CLASS.AIRLINER;
    // Medium altitude = regional
    if (altFt > 10000) return ICON_CLASS.REGIONAL;
    // Low + slow = light/helicopter
    if (spdKts < 100 && altFt < 5000) return ICON_CLASS.HELICOPTER;
    if (altFt < 10000) return ICON_CLASS.LIGHT;

    return ICON_CLASS.AIRLINER;
  }

  return ICON_CLASS.GENERIC;
}

// ============================================
// NATION RESOLVER — best effort from ICAO hex + origin country
// ============================================
export function resolveNation(ac) {
  // 1. Try ICAO hex prefix (most reliable for registration country)
  if (ac.icao24) {
    const prefix = ac.icao24.toUpperCase().substring(0, 2);
    const match = ICAO_COUNTRY[prefix];
    if (match && match.code !== 'ZZ') {
      return match;
    }
  }

  // 2. Fall back to OpenSky origin_country field
  if (ac.origin && ac.origin !== '--') {
    const flag = COUNTRY_FLAGS[ac.origin];
    return {
      code: ac.origin.substring(0, 2).toUpperCase(),
      name: ac.origin,
      flag: flag || '🏳️'
    };
  }

  return { code: 'ZZ', name: 'Unknown', flag: '🏳️' };
}

// ============================================
// FLAG EMOJI for detail panel display
// ============================================
export function getFlagEmoji(countryName) {
  return COUNTRY_FLAGS[countryName] || '🏳️';
}
