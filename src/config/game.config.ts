import type { ApacheConfig, ShipConfig, EnemyConfig, UpgradeConfig, MissionConfig } from '../types/index.ts';

// ── Display ─────────────────────────────────────────────────

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
export const WORLD_WIDTH = 9600;
export const WORLD_HEIGHT = 1920;

// ── Colors ──────────────────────────────────────────────────

export const COLORS = {
  ocean: 0x0a2a4a,
  oceanLight: 0x0e3d6b,
  oceanDark: 0x071e38,
  sand: 0xc2a366,
  sandDark: 0x8a7044,
  hud: 0x00ff88,
  hudWarning: 0xff4444,
  hudAmmo: 0x44aaff,
  playerTracer: 0xffdd44,
  rocketTrail: 0xff6600,
  explosion: 0xff4400,
  explosionInner: 0xffcc00,
  healthGreen: 0x00dd44,
  healthYellow: 0xdddd00,
  healthRed: 0xdd2200,
  enemyFast: 0xcc2222,
  enemyDrone: 0xdd6600,
  enemySuicide: 0xff0044,
  enemyMissile: 0xbb4488,
  enemyArmored: 0x884422,
  enemyJammer: 0x8844bb,
  mine: 0x555555,
  mineGlow: 0xff2200,
  shipContainer: 0x5588bb,
  shipTanker: 0x668844,
  shipPatrol: 0x888888,
  apache: 0x2d5a1e,
  boss: 0xff2244,
};

// ── Apache Base Stats (BALANCED) ────────────────────────────

export const APACHE_BASE: ApacheConfig = {
  hp: 120,
  speed: 720,
  combatRadius: 1320,
  autocannon: {
    type: 'autocannon',
    damage: 12,
    speed: 1800,
    range: 624,
    fireRate: 5.5,
    projectileSize: 6,
    color: COLORS.playerTracer,
  },
  rocketDamage: 75,
  rocketCount: 4,
  rocketCooldown: 7,
  rocketBlastRadius: 156,
  flareCooldown: 14,
};

// ── Ship Configs (BALANCED) ────────────────────────────────

export const SHIP_CONFIGS: Record<string, ShipConfig> = {
  container: {
    type: 'container',
    hp: 180,
    speed: 132,
    value: 100,
    width: 192,
    height: 58,
    color: COLORS.shipContainer,
  },
  tanker: {
    type: 'tanker',
    hp: 140,
    speed: 108,
    value: 160,
    width: 216,
    height: 67,
    color: COLORS.shipTanker,
  },
  patrol: {
    type: 'patrol',
    hp: 90,
    speed: 180,
    value: 60,
    width: 120,
    height: 38,
    color: COLORS.shipPatrol,
  },
};

// ── Enemy Configs (BALANCED + NEW TYPES) ────────────────────

export const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  fastAttack: {
    type: 'fastAttack',
    hp: 28,
    speed: 432,
    damage: 12,
    attackRange: 336,
    attackRate: 1.2,
    behavior: 'rush',
    width: 58,
    height: 29,
    color: COLORS.enemyFast,
    scoreValue: 50,
  },
  droneBoat: {
    type: 'droneBoat',
    hp: 14,
    speed: 552,
    damage: 70,
    attackRange: 0,
    attackRate: 0,
    behavior: 'suicide',
    width: 43,
    height: 24,
    color: COLORS.enemyDrone,
    scoreValue: 40,
  },
  suicideDrone: {
    type: 'suicideDrone',
    hp: 8,
    speed: 768,
    damage: 55,
    attackRange: 0,
    attackRate: 0,
    behavior: 'suicide',
    width: 34,
    height: 34,
    color: COLORS.enemySuicide,
    scoreValue: 60,
  },
  mine: {
    type: 'mine',
    hp: 5,
    speed: 0,
    damage: 110,
    attackRange: 91,
    attackRate: 0,
    behavior: 'static',
    width: 38,
    height: 38,
    color: COLORS.mine,
    scoreValue: 20,
  },
  missileSkiff: {
    type: 'missileSkiff',
    hp: 22,
    speed: 288,
    damage: 40,
    attackRange: 720,
    attackRate: 0.5,
    behavior: 'strafe',
    width: 53,
    height: 29,
    color: COLORS.enemyMissile,
    scoreValue: 80,
  },
  armoredPatrol: {
    type: 'armoredPatrol',
    hp: 80,
    speed: 240,
    damage: 20,
    attackRange: 432,
    attackRate: 1.0,
    behavior: 'rush',
    width: 86,
    height: 38,
    color: COLORS.enemyArmored,
    scoreValue: 120,
    isBoss: false,
  },
  jammerDrone: {
    type: 'jammerDrone',
    hp: 18,
    speed: 480,
    damage: 0,
    attackRange: 600,
    attackRate: 0,
    behavior: 'strafe',
    width: 38,
    height: 38,
    color: COLORS.enemyJammer,
    scoreValue: 70,
  },
};

// ── Boss Config ─────────────────────────────────────────────

export const BOSS_CONFIG: EnemyConfig = {
  type: 'armoredPatrol',
  hp: 300,
  speed: 192,
  damage: 30,
  attackRange: 528,
  attackRate: 1.5,
  behavior: 'boss',
  width: 120,
  height: 53,
  color: COLORS.boss,
  scoreValue: 500,
  isBoss: true,
};

// ── Upgrade Configs (BALANCED) ──────────────────────────────

export const UPGRADE_CONFIGS: UpgradeConfig[] = [
  {
    track: 'firepower',
    name: 'Firepower',
    description: 'Autocannon damage',
    levels: [
      { cost: 80, effect: 1.15 },
      { cost: 200, effect: 1.30 },
      { cost: 450, effect: 1.50 },
      { cost: 900, effect: 1.75 },
      { cost: 1800, effect: 2.0 },
    ],
  },
  {
    track: 'fireRate',
    name: 'Fire Rate',
    description: 'Autocannon fire rate',
    levels: [
      { cost: 80, effect: 1.10 },
      { cost: 200, effect: 1.20 },
      { cost: 450, effect: 1.35 },
      { cost: 900, effect: 1.50 },
      { cost: 1800, effect: 1.70 },
    ],
  },
  {
    track: 'rockets',
    name: 'Rocket Payload',
    description: 'Rocket capacity',
    levels: [
      { cost: 120, effect: 5 },
      { cost: 280, effect: 6 },
      { cost: 550, effect: 8 },
      { cost: 1100, effect: 10 },
      { cost: 2200, effect: 12 },
    ],
  },
  {
    track: 'armor',
    name: 'Armor Plating',
    description: 'Maximum HP',
    levels: [
      { cost: 100, effect: 140 },
      { cost: 240, effect: 165 },
      { cost: 500, effect: 200 },
      { cost: 1000, effect: 240 },
      { cost: 2000, effect: 300 },
    ],
  },
];

// ── Support Asset Unlock Costs ──────────────────────────────

export const SUPPORT_UNLOCK_COSTS: Record<string, number> = {
  escort: 300,
  ciws: 500,
  recon: 400,
};

// ── Mission Configs (EXPANDED — 9 missions) ─────────────────

export const MISSION_CONFIGS: MissionConfig[] = [
  // ── MISSION 1: Tutorial ──
  {
    id: 'mission_1',
    name: 'First Crossing',
    description: 'Light resistance. Learn the ropes.',
    difficulty: 1,
    mode: 'escort',
    convoyComposition: ['container', 'patrol'],
    waves: [
      {
        triggerAt: 0.15,
        enemies: [
          { type: 'fastAttack', count: 2, spawnSide: 'top', delay: 1.5, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.35,
        enemies: [
          { type: 'fastAttack', count: 2, spawnSide: 'bottom', delay: 1, startDelay: 0 },
          { type: 'mine', count: 2, spawnSide: 'right', delay: 0, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.65,
        enemies: [
          { type: 'fastAttack', count: 3, spawnSide: 'top', delay: 1, startDelay: 0 },
          { type: 'droneBoat', count: 1, spawnSide: 'bottom', delay: 0, startDelay: 2 },
        ],
      },
    ],
    parTime: 120,
    baseReward: 80,
  },
  // ── MISSION 2: Mixed threats ──
  {
    id: 'mission_2',
    name: 'Contested Waters',
    description: 'Mixed threats. Mines ahead.',
    difficulty: 2,
    mode: 'escort',
    convoyComposition: ['container', 'tanker', 'patrol'],
    waves: [
      {
        triggerAt: 0.1,
        enemies: [
          { type: 'fastAttack', count: 3, spawnSide: 'top', delay: 1, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.3,
        enemies: [
          { type: 'mine', count: 4, spawnSide: 'right', delay: 0, startDelay: 0 },
          { type: 'droneBoat', count: 2, spawnSide: 'bottom', delay: 2, startDelay: 1 },
        ],
      },
      {
        triggerAt: 0.5,
        enemies: [
          { type: 'fastAttack', count: 3, spawnSide: 'top', delay: 0.8, startDelay: 0 },
          { type: 'fastAttack', count: 2, spawnSide: 'bottom', delay: 1, startDelay: 1 },
          { type: 'suicideDrone', count: 1, spawnSide: 'random', delay: 0, startDelay: 3 },
        ],
      },
      {
        triggerAt: 0.75,
        enemies: [
          { type: 'droneBoat', count: 3, spawnSide: 'top', delay: 1.5, startDelay: 0 },
          { type: 'suicideDrone', count: 2, spawnSide: 'random', delay: 2, startDelay: 1 },
          { type: 'mine', count: 3, spawnSide: 'right', delay: 0, startDelay: 0 },
        ],
      },
    ],
    parTime: 150,
    baseReward: 120,
  },
  // ── MISSION 3: Hard escort ──
  {
    id: 'mission_3',
    name: 'Gauntlet Run',
    description: 'Heavy resistance. All threats active.',
    difficulty: 3,
    mode: 'escort',
    convoyComposition: ['container', 'tanker', 'patrol'],
    waves: [
      {
        triggerAt: 0.08,
        enemies: [
          { type: 'fastAttack', count: 3, spawnSide: 'top', delay: 0.8, startDelay: 0 },
          { type: 'fastAttack', count: 2, spawnSide: 'bottom', delay: 1, startDelay: 0.5 },
        ],
      },
      {
        triggerAt: 0.25,
        enemies: [
          { type: 'mine', count: 5, spawnSide: 'right', delay: 0, startDelay: 0 },
          { type: 'droneBoat', count: 3, spawnSide: 'top', delay: 1.2, startDelay: 1 },
        ],
      },
      {
        triggerAt: 0.4,
        enemies: [
          { type: 'suicideDrone', count: 3, spawnSide: 'random', delay: 1.5, startDelay: 0 },
          { type: 'fastAttack', count: 4, spawnSide: 'bottom', delay: 0.7, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.6,
        enemies: [
          { type: 'droneBoat', count: 4, spawnSide: 'top', delay: 1, startDelay: 0 },
          { type: 'droneBoat', count: 2, spawnSide: 'bottom', delay: 1.5, startDelay: 1 },
          { type: 'mine', count: 4, spawnSide: 'right', delay: 0, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.8,
        enemies: [
          { type: 'fastAttack', count: 5, spawnSide: 'top', delay: 0.5, startDelay: 0 },
          { type: 'suicideDrone', count: 3, spawnSide: 'random', delay: 1, startDelay: 1 },
          { type: 'droneBoat', count: 3, spawnSide: 'bottom', delay: 1, startDelay: 2 },
        ],
      },
    ],
    parTime: 180,
    baseReward: 180,
  },
  // ── MISSION 4: Defend Disabled Vessel ──
  {
    id: 'mission_4',
    name: 'Dead in the Water',
    description: 'Defend a disabled tanker. Hold for 90 seconds.',
    difficulty: 2,
    mode: 'defend',
    convoyComposition: ['tanker'],
    holdTime: 90,
    waves: [
      {
        triggerAt: 0.0,
        enemies: [
          { type: 'fastAttack', count: 3, spawnSide: 'random', delay: 2, startDelay: 3 },
        ],
      },
      {
        triggerAt: 0.25,
        enemies: [
          { type: 'droneBoat', count: 3, spawnSide: 'random', delay: 1.5, startDelay: 0 },
          { type: 'fastAttack', count: 2, spawnSide: 'random', delay: 1, startDelay: 2 },
        ],
      },
      {
        triggerAt: 0.5,
        enemies: [
          { type: 'suicideDrone', count: 3, spawnSide: 'random', delay: 2, startDelay: 0 },
          { type: 'fastAttack', count: 4, spawnSide: 'random', delay: 1, startDelay: 1 },
          { type: 'droneBoat', count: 2, spawnSide: 'random', delay: 1.5, startDelay: 3 },
        ],
      },
      {
        triggerAt: 0.75,
        enemies: [
          { type: 'droneBoat', count: 4, spawnSide: 'random', delay: 1, startDelay: 0 },
          { type: 'suicideDrone', count: 3, spawnSide: 'random', delay: 1.5, startDelay: 1 },
          { type: 'fastAttack', count: 5, spawnSide: 'random', delay: 0.8, startDelay: 2 },
        ],
      },
    ],
    parTime: 90,
    baseReward: 150,
  },
  // ── MISSION 5: Mine Corridor ──
  {
    id: 'mission_5',
    name: 'Mine Corridor',
    description: 'Dense minefield. Precision shooting required.',
    difficulty: 2,
    mode: 'mineField',
    convoyComposition: ['container', 'tanker'],
    waves: [
      {
        triggerAt: 0.05,
        enemies: [
          { type: 'mine', count: 8, spawnSide: 'right', delay: 0, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.2,
        enemies: [
          { type: 'mine', count: 6, spawnSide: 'right', delay: 0, startDelay: 0 },
          { type: 'fastAttack', count: 2, spawnSide: 'top', delay: 1.5, startDelay: 2 },
        ],
      },
      {
        triggerAt: 0.4,
        enemies: [
          { type: 'mine', count: 10, spawnSide: 'right', delay: 0, startDelay: 0 },
          { type: 'droneBoat', count: 2, spawnSide: 'bottom', delay: 2, startDelay: 3 },
        ],
      },
      {
        triggerAt: 0.6,
        enemies: [
          { type: 'mine', count: 8, spawnSide: 'right', delay: 0, startDelay: 0 },
          { type: 'fastAttack', count: 3, spawnSide: 'top', delay: 0.8, startDelay: 1 },
          { type: 'suicideDrone', count: 2, spawnSide: 'random', delay: 2, startDelay: 4 },
        ],
      },
      {
        triggerAt: 0.8,
        enemies: [
          { type: 'mine', count: 12, spawnSide: 'right', delay: 0, startDelay: 0 },
        ],
      },
    ],
    parTime: 160,
    baseReward: 160,
  },
  // ── MISSION 6: Survive the Crossing ──
  {
    id: 'mission_6',
    name: 'Survive the Crossing',
    description: 'Endless waves until the convoy escapes.',
    difficulty: 3,
    mode: 'survive',
    convoyComposition: ['container', 'tanker', 'patrol'],
    surviveTarget: 0.85,
    waves: [
      {
        triggerAt: 0.05,
        enemies: [
          { type: 'fastAttack', count: 4, spawnSide: 'random', delay: 1, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.15,
        enemies: [
          { type: 'droneBoat', count: 3, spawnSide: 'random', delay: 1.2, startDelay: 0 },
          { type: 'fastAttack', count: 3, spawnSide: 'random', delay: 0.8, startDelay: 1 },
        ],
      },
      {
        triggerAt: 0.25,
        enemies: [
          { type: 'suicideDrone', count: 4, spawnSide: 'random', delay: 1.5, startDelay: 0 },
          { type: 'mine', count: 4, spawnSide: 'right', delay: 0, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.35,
        enemies: [
          { type: 'fastAttack', count: 5, spawnSide: 'random', delay: 0.6, startDelay: 0 },
          { type: 'droneBoat', count: 4, spawnSide: 'random', delay: 1, startDelay: 2 },
        ],
      },
      {
        triggerAt: 0.5,
        enemies: [
          { type: 'missileSkiff', count: 2, spawnSide: 'random', delay: 3, startDelay: 0 },
          { type: 'suicideDrone', count: 4, spawnSide: 'random', delay: 1, startDelay: 1 },
          { type: 'fastAttack', count: 4, spawnSide: 'random', delay: 0.7, startDelay: 2 },
        ],
      },
      {
        triggerAt: 0.65,
        enemies: [
          { type: 'droneBoat', count: 5, spawnSide: 'random', delay: 0.8, startDelay: 0 },
          { type: 'fastAttack', count: 5, spawnSide: 'random', delay: 0.6, startDelay: 1 },
          { type: 'mine', count: 5, spawnSide: 'right', delay: 0, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.8,
        enemies: [
          { type: 'suicideDrone', count: 5, spawnSide: 'random', delay: 1, startDelay: 0 },
          { type: 'droneBoat', count: 5, spawnSide: 'random', delay: 0.8, startDelay: 1 },
          { type: 'fastAttack', count: 6, spawnSide: 'random', delay: 0.5, startDelay: 2 },
        ],
      },
    ],
    parTime: 200,
    baseReward: 220,
  },
  // ── MISSION 7: Boss — Armored Patrol ──
  {
    id: 'mission_7',
    name: 'Iron Vanguard',
    description: 'Armored patrol craft leads the assault.',
    difficulty: 3,
    mode: 'boss',
    isBoss: true,
    convoyComposition: ['container', 'tanker', 'patrol'],
    waves: [
      {
        triggerAt: 0.1,
        enemies: [
          { type: 'fastAttack', count: 4, spawnSide: 'top', delay: 0.8, startDelay: 0 },
          { type: 'fastAttack', count: 3, spawnSide: 'bottom', delay: 1, startDelay: 1 },
        ],
      },
      {
        triggerAt: 0.3,
        enemies: [
          { type: 'armoredPatrol', count: 1, spawnSide: 'right', delay: 0, startDelay: 0 },
          { type: 'droneBoat', count: 3, spawnSide: 'top', delay: 1.5, startDelay: 2 },
        ],
      },
      {
        triggerAt: 0.5,
        enemies: [
          { type: 'missileSkiff', count: 2, spawnSide: 'random', delay: 3, startDelay: 0 },
          { type: 'suicideDrone', count: 4, spawnSide: 'random', delay: 1.2, startDelay: 1 },
          { type: 'fastAttack', count: 4, spawnSide: 'random', delay: 0.7, startDelay: 2 },
        ],
      },
      {
        triggerAt: 0.7,
        enemies: [
          { type: 'armoredPatrol', count: 2, spawnSide: 'random', delay: 3, startDelay: 0 },
          { type: 'droneBoat', count: 4, spawnSide: 'random', delay: 1, startDelay: 1 },
          { type: 'mine', count: 6, spawnSide: 'right', delay: 0, startDelay: 0 },
        ],
      },
    ],
    parTime: 200,
    baseReward: 250,
  },
  // ── MISSION 8: Saturation Assault (Boss) ──
  {
    id: 'mission_8',
    name: 'Saturation Assault',
    description: 'Coordinated mass attack. Everything at once.',
    difficulty: 3,
    mode: 'boss',
    isBoss: true,
    convoyComposition: ['tanker', 'container', 'patrol'],
    waves: [
      {
        triggerAt: 0.05,
        enemies: [
          { type: 'fastAttack', count: 5, spawnSide: 'top', delay: 0.5, startDelay: 0 },
          { type: 'fastAttack', count: 5, spawnSide: 'bottom', delay: 0.5, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.2,
        enemies: [
          { type: 'droneBoat', count: 5, spawnSide: 'random', delay: 0.8, startDelay: 0 },
          { type: 'suicideDrone', count: 4, spawnSide: 'random', delay: 1, startDelay: 2 },
          { type: 'mine', count: 8, spawnSide: 'right', delay: 0, startDelay: 0 },
        ],
      },
      {
        triggerAt: 0.4,
        enemies: [
          { type: 'missileSkiff', count: 3, spawnSide: 'random', delay: 2, startDelay: 0 },
          { type: 'armoredPatrol', count: 1, spawnSide: 'right', delay: 0, startDelay: 1 },
          { type: 'fastAttack', count: 6, spawnSide: 'random', delay: 0.5, startDelay: 2 },
        ],
      },
      {
        triggerAt: 0.6,
        enemies: [
          { type: 'jammerDrone', count: 2, spawnSide: 'random', delay: 3, startDelay: 0 },
          { type: 'suicideDrone', count: 6, spawnSide: 'random', delay: 0.8, startDelay: 1 },
          { type: 'droneBoat', count: 5, spawnSide: 'random', delay: 0.8, startDelay: 2 },
        ],
      },
      {
        triggerAt: 0.8,
        enemies: [
          { type: 'armoredPatrol', count: 2, spawnSide: 'random', delay: 2, startDelay: 0 },
          { type: 'missileSkiff', count: 3, spawnSide: 'random', delay: 1.5, startDelay: 1 },
          { type: 'fastAttack', count: 8, spawnSide: 'random', delay: 0.4, startDelay: 2 },
          { type: 'suicideDrone', count: 5, spawnSide: 'random', delay: 0.8, startDelay: 3 },
        ],
      },
    ],
    parTime: 240,
    baseReward: 350,
  },
  // ── MISSION 9: Missile Barrage ──
  {
    id: 'mission_9',
    name: 'Missile Rain',
    description: 'Long-range missile skiffs hammer the convoy.',
    difficulty: 3,
    mode: 'escort',
    convoyComposition: ['container', 'tanker', 'patrol'],
    waves: [
      {
        triggerAt: 0.1,
        enemies: [
          { type: 'missileSkiff', count: 2, spawnSide: 'top', delay: 3, startDelay: 0 },
          { type: 'fastAttack', count: 3, spawnSide: 'bottom', delay: 1, startDelay: 1 },
        ],
      },
      {
        triggerAt: 0.3,
        enemies: [
          { type: 'missileSkiff', count: 3, spawnSide: 'random', delay: 2, startDelay: 0 },
          { type: 'droneBoat', count: 3, spawnSide: 'random', delay: 1.5, startDelay: 2 },
        ],
      },
      {
        triggerAt: 0.5,
        enemies: [
          { type: 'missileSkiff', count: 2, spawnSide: 'top', delay: 2, startDelay: 0 },
          { type: 'missileSkiff', count: 2, spawnSide: 'bottom', delay: 2, startDelay: 1 },
          { type: 'suicideDrone', count: 3, spawnSide: 'random', delay: 1.5, startDelay: 2 },
          { type: 'fastAttack', count: 4, spawnSide: 'random', delay: 0.7, startDelay: 3 },
        ],
      },
      {
        triggerAt: 0.75,
        enemies: [
          { type: 'missileSkiff', count: 4, spawnSide: 'random', delay: 1.5, startDelay: 0 },
          { type: 'armoredPatrol', count: 1, spawnSide: 'right', delay: 0, startDelay: 2 },
          { type: 'droneBoat', count: 4, spawnSide: 'random', delay: 1, startDelay: 3 },
        ],
      },
    ],
    parTime: 190,
    baseReward: 200,
  },
];

// ── Convoy Path (world coordinates) ─────────────────────────

export const CONVOY_PATH: { x: number; y: number }[] = [
  { x: -240, y: 960 },
  { x: 960, y: 912 },
  { x: 2160, y: 1008 },
  { x: 3360, y: 936 },
  { x: 4560, y: 984 },
  { x: 5760, y: 912 },
  { x: 6960, y: 960 },
  { x: 8160, y: 984 },
  { x: 9360, y: 960 },
  { x: 10080, y: 960 },
];

// ── Scoring (BALANCED) ──────────────────────────────────────

export const SCORING = {
  shipSurvivalBonus: 25,
  starBonuses: [0, 30, 60, 120],
  accuracyBonusThreshold: 0.55,
  accuracyBonus: 40,
};

// ── Endless Mode Config ─────────────────────────────────────

export const ENDLESS_CONFIG = {
  baseSpawnInterval: 5, // seconds between waves
  spawnAcceleration: 0.97, // multiply interval each wave
  minSpawnInterval: 1.5,
  enemyHpScale: 1.02, // per wave
  enemySpeedScale: 1.005,
  scorePerWave: 10,
  creditsPer100Score: 50,
};

// ── Daily Mission Modifiers ─────────────────────────────────

export const DAILY_MODIFIERS = [
  { name: 'Double Threat', description: '2x enemy count, 2x rewards', enemyMult: 2, rewardMult: 2 },
  { name: 'Glass Cannon', description: 'Half HP, double damage', hpMult: 0.5, damageMult: 2, rewardMult: 1.5 },
  { name: 'Speed Run', description: 'Ships move 50% faster', speedMult: 1.5, rewardMult: 1.3 },
  { name: 'Iron Skin', description: 'Enemies have 2x HP', enemyHpMult: 2, rewardMult: 1.5 },
  { name: 'Rocket Party', description: '3x rockets, no autocannon', rocketMult: 3, noAutocannon: true, rewardMult: 1.8 },
  { name: 'Mine Maze', description: 'Triple mines spawned', mineMult: 3, rewardMult: 1.4 },
  { name: 'Drone Swarm', description: 'All enemies are drones', droneOnly: true, rewardMult: 1.6 },
];
