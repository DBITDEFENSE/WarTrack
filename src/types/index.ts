// ── Core Types ──────────────────────────────────────────────

export interface Vector2 {
  x: number;
  y: number;
}

// ── Entity Types ────────────────────────────────────────────

export type ShipType = 'container' | 'tanker' | 'patrol';
export type EnemyType = 'fastAttack' | 'droneBoat' | 'suicideDrone' | 'mine' | 'missileSkiff' | 'armoredPatrol' | 'jammerDrone';
export type ProjectileType = 'autocannon' | 'rocket' | 'enemyBullet' | 'missile';
export type UpgradeTrack = 'firepower' | 'fireRate' | 'rockets' | 'armor';
export type MissionMode = 'escort' | 'defend' | 'mineField' | 'survive' | 'boss' | 'endless';

// ── Config Interfaces ───────────────────────────────────────

export interface ShipConfig {
  type: ShipType;
  hp: number;
  speed: number;
  value: number;
  width: number;
  height: number;
  color: number;
}

export interface EnemyConfig {
  type: EnemyType;
  hp: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackRate: number;
  behavior: 'rush' | 'suicide' | 'static' | 'strafe' | 'boss';
  width: number;
  height: number;
  color: number;
  scoreValue: number;
  isBoss?: boolean;
}

export interface WeaponConfig {
  type: ProjectileType;
  damage: number;
  speed: number;
  range: number;
  fireRate: number;
  projectileSize: number;
  color: number;
}

export interface ApacheConfig {
  hp: number;
  speed: number;
  combatRadius: number;
  autocannon: WeaponConfig;
  rocketDamage: number;
  rocketCount: number;
  rocketCooldown: number;
  rocketBlastRadius: number;
  flareCooldown: number;
}

// ── Mission Interfaces ──────────────────────────────────────

export interface SpawnGroup {
  type: EnemyType;
  count: number;
  spawnSide: 'top' | 'bottom' | 'right' | 'left' | 'random';
  delay: number;
  startDelay: number;
}

export interface WaveConfig {
  triggerAt: number;
  enemies: SpawnGroup[];
}

export interface MissionConfig {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  mode: MissionMode;
  convoyComposition: ShipType[];
  waves: WaveConfig[];
  parTime: number;
  baseReward: number;
  /** For defend mode: how long to hold (seconds) */
  holdTime?: number;
  /** For survive mode: convoy must reach this progress to win */
  surviveTarget?: number;
  /** Boss mission flag */
  isBoss?: boolean;
}

// ── Progression Interfaces ──────────────────────────────────

export interface UpgradeLevel {
  cost: number;
  effect: number;
}

export interface UpgradeConfig {
  track: UpgradeTrack;
  name: string;
  description: string;
  levels: UpgradeLevel[];
}

export interface MissionResult {
  missionId: string;
  stars: number;
  bestTime: number;
  shipsLost: number;
  shipsSurvived: number;
  enemiesKilled: number;
  creditsEarned: number;
  completed: boolean;
}

export interface GameState {
  credits: number;
  upgrades: Record<UpgradeTrack, number>;
  missionResults: Record<string, MissionResult>;
  highestUnlockedMission: number;
  supportUnlocks: Record<string, boolean>;
  endlessHighScore: number;
  dailyMissionDate: string;
  dailyMissionCompleted: boolean;
}

// ── Runtime Types ───────────────────────────────────────────

export interface DamageEvent {
  targetId: string;
  amount: number;
  source: 'player' | 'enemy';
  position: Vector2;
}
