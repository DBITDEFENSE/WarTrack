// ============================================
// MARKET UNIVERSE — Defense, Aerospace, Shipping, Energy, Gold
// Stocks and ETFs relevant to geopolitical intelligence
// ============================================

export const CATEGORIES = {
  defense:    { label: 'DEFENSE',    color: '#ff3344', icon: '⚔' },
  aerospace:  { label: 'AEROSPACE',  color: '#00ddff', icon: '✈' },
  maritime:   { label: 'MARITIME',   color: '#0088ff', icon: '⚓' },
  logistics:  { label: 'LOGISTICS',  color: '#aa88ff', icon: '📦' },
  industrial: { label: 'INDUSTRIAL', color: '#ff8800', icon: '⚙' },
  energy:     { label: 'ENERGY',     color: '#ffaa00', icon: '⛽' },
  gold:       { label: 'GOLD',       color: '#ffd700', icon: '🥇' },
  etf:        { label: 'ETF/MACRO',  color: '#00ff88', icon: '📊' },
};

export const STOCKS = [
  // Defense
  { ticker: 'LMT',  name: 'Lockheed Martin',      category: 'defense',    desc: 'F-35, missiles, defense systems' },
  { ticker: 'NOC',  name: 'Northrop Grumman',      category: 'defense',    desc: 'B-21, satellites, cyber defense' },
  { ticker: 'RTX',  name: 'RTX (Raytheon)',         category: 'defense',    desc: 'Missiles, radar, engines' },
  { ticker: 'GD',   name: 'General Dynamics',       category: 'defense',    desc: 'Submarines, tanks, IT systems' },
  { ticker: 'LHX',  name: 'L3Harris Technologies',  category: 'defense',    desc: 'Comms, ISR, space systems' },
  { ticker: 'BA',   name: 'Boeing',                 category: 'defense',    desc: 'Military aircraft, commercial jets' },
  { ticker: 'HII',  name: 'Huntington Ingalls',     category: 'defense',    desc: 'Aircraft carriers, submarines' },
  { ticker: 'LDOS', name: 'Leidos',                 category: 'defense',    desc: 'Defense IT, intelligence services' },

  // Aerospace
  { ticker: 'AVAV', name: 'AeroVironment',          category: 'aerospace',  desc: 'Drones, tactical UAS, loitering munitions' },
  { ticker: 'KTOS', name: 'Kratos Defense',          category: 'aerospace',  desc: 'Drone swarms, hypersonic tech' },
  { ticker: 'RKLB', name: 'Rocket Lab',             category: 'aerospace',  desc: 'Small launch, satellite manufacturing' },
  { ticker: 'PLTR', name: 'Palantir',               category: 'aerospace',  desc: 'AI/data analytics for defense/intel' },
  { ticker: 'SPR',  name: 'Spirit AeroSystems',     category: 'aerospace',  desc: 'Aerostructures, fuselages' },
  { ticker: 'TDG',  name: 'TransDigm',              category: 'aerospace',  desc: 'Aerospace components, OEM parts' },

  // Maritime / Shipping
  { ticker: 'ZIM',  name: 'ZIM Integrated Shipping', category: 'maritime',  desc: 'Container shipping, Red Sea exposure' },
  { ticker: 'SBLK', name: 'Star Bulk Carriers',     category: 'maritime',   desc: 'Dry bulk shipping' },
  { ticker: 'DAC',  name: 'Danaos Corporation',     category: 'maritime',   desc: 'Container ship owner/operator' },
  { ticker: 'GOGL', name: 'Golden Ocean',           category: 'maritime',   desc: 'Dry bulk shipping, Capesize fleet' },
  { ticker: 'MATX', name: 'Matson Inc',             category: 'maritime',   desc: 'Pacific shipping, logistics' },
  { ticker: 'KEX',  name: 'Kirby Corporation',      category: 'maritime',   desc: 'Inland barge transport, petrochemicals' },

  // Logistics
  { ticker: 'UPS',  name: 'UPS',                    category: 'logistics',  desc: 'Global package/freight logistics' },
  { ticker: 'FDX',  name: 'FedEx',                  category: 'logistics',  desc: 'Express delivery, freight' },
  { ticker: 'XPO',  name: 'XPO Inc',                category: 'logistics',  desc: 'LTL freight, last-mile' },
  { ticker: 'CHRW', name: 'C.H. Robinson',          category: 'logistics',  desc: 'Freight brokerage, supply chain' },
  { ticker: 'JBHT', name: 'J.B. Hunt',              category: 'logistics',  desc: 'Intermodal, trucking' },

  // Industrials / Steel
  { ticker: 'X',    name: 'U.S. Steel',             category: 'industrial', desc: 'Steel production, defense supply chain' },
  { ticker: 'NUE',  name: 'Nucor',                  category: 'industrial', desc: 'Steel manufacturing, infrastructure' },
  { ticker: 'STLD', name: 'Steel Dynamics',         category: 'industrial', desc: 'Steel, metals recycling' },
  { ticker: 'CLF',  name: 'Cleveland-Cliffs',       category: 'industrial', desc: 'Iron ore, flat-rolled steel' },
  { ticker: 'GE',   name: 'GE Aerospace',           category: 'industrial', desc: 'Jet engines, power systems' },
  { ticker: 'HON',  name: 'Honeywell',              category: 'industrial', desc: 'Avionics, defense tech, industrials' },

  // Energy
  { ticker: 'XOM',  name: 'ExxonMobil',             category: 'energy',     desc: 'Oil & gas, global energy' },
  { ticker: 'CVX',  name: 'Chevron',                category: 'energy',     desc: 'Oil & gas, refining' },
  { ticker: 'OXY',  name: 'Occidental Petroleum',   category: 'energy',     desc: 'Oil & gas, carbon capture' },
  { ticker: 'SLB',  name: 'Schlumberger',           category: 'energy',     desc: 'Oilfield services, drilling tech' },
  { ticker: 'HAL',  name: 'Halliburton',            category: 'energy',     desc: 'Oilfield services, completion' },

  // Gold / Safe Haven
  { ticker: 'GLD',  name: 'SPDR Gold Trust',        category: 'gold',       desc: 'Gold ETF, safe-haven asset' },
  { ticker: 'GDX',  name: 'VanEck Gold Miners',     category: 'gold',       desc: 'Gold mining ETF' },
  { ticker: 'NEM',  name: 'Newmont Mining',         category: 'gold',       desc: 'Largest gold miner' },
  { ticker: 'GOLD', name: 'Barrick Gold',           category: 'gold',       desc: 'Gold/copper mining' },
  { ticker: 'AEM',  name: 'Agnico Eagle Mines',     category: 'gold',       desc: 'Gold mining, Americas/Europe' },

  // ETFs / Macro
  { ticker: 'ITA',  name: 'iShares US Aerospace & Defense', category: 'etf', desc: 'US defense sector ETF' },
  { ticker: 'PPA',  name: 'Invesco Aerospace & Defense',    category: 'etf', desc: 'Aerospace & defense ETF' },
  { ticker: 'DFEN', name: 'Direxion Daily Aero & Defense Bull 3X', category: 'etf', desc: '3x leveraged defense ETF' },
  { ticker: 'XAR',  name: 'SPDR S&P Aerospace & Defense',  category: 'etf', desc: 'Equal-weight defense ETF' },
  { ticker: 'JETS', name: 'US Global Jets ETF',     category: 'etf',        desc: 'Airline industry ETF' },
  { ticker: 'XLE',  name: 'Energy Select Sector SPDR', category: 'etf',     desc: 'US energy sector ETF' },
];

// Quick lookup by ticker
export const STOCK_MAP = {};
for (const s of STOCKS) {
  STOCK_MAP[s.ticker] = s;
}
