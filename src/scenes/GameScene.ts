import Phaser from 'phaser';
import { Apache } from '../entities/Apache.ts';
import { ConvoyShip } from '../entities/ConvoyShip.ts';
import { Enemy } from '../entities/Enemy.ts';
import { Projectile } from '../entities/Projectile.ts';
import { SupportAsset, SUPPORT_CONFIGS } from '../entities/SupportAsset.ts';
import { VirtualJoystick } from '../ui/VirtualJoystick.ts';
import { AbilityButton } from '../ui/AbilityButton.ts';
import { ThreatIndicator } from '../ui/ThreatIndicator.ts';
import { MiniMap } from '../ui/MiniMap.ts';
import { EffectsSystem } from '../systems/EffectsSystem.ts';
import { audio } from '../managers/AudioManager.ts';
import {
  GAME_WIDTH, GAME_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT,
  COLORS, SHIP_CONFIGS, ENEMY_CONFIGS, CONVOY_PATH,
  MISSION_CONFIGS, APACHE_BASE, SCORING, BOSS_CONFIG,
  ENDLESS_CONFIG,
} from '../config/game.config.ts';
import type { MissionConfig, Vector2, GameState, EnemyType } from '../types/index.ts';
import { distance, direction, angleBetween, randomRange, clamp } from '../utils/math.ts';
import { SaveManager } from '../managers/SaveManager.ts';

const MAX_PROJECTILES = 120;

export class GameScene extends Phaser.Scene {
  // Core entities
  private apache!: Apache;
  private convoyShips: ConvoyShip[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private supportAssets: SupportAsset[] = [];

  // Input
  private joystick!: VirtualJoystick;
  private rocketButton!: AbilityButton;
  private flareButton!: AbilityButton;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  // HUD
  private hpText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;

  // Systems
  private effects!: EffectsSystem;
  private threatIndicator!: ThreatIndicator;
  private miniMap!: MiniMap;

  // Mission state
  private mission!: MissionConfig;
  private missionIndex: number = 0;
  private saveManager!: SaveManager;
  private gameState!: GameState;
  private missionTime: number = 0;
  private score: number = 0;
  private enemiesKilled: number = 0;
  private shotsHit: number = 0;
  private waveIndex: number = 0;
  private spawnQueue: Array<{ type: EnemyType; spawnSide: string; delay: number; timer: number }> = [];
  private gameOver: boolean = false;
  private missionComplete: boolean = false;
  private isEndless: boolean = false;
  private defendTimer: number = 0;

  // Endless mode state
  private endlessWaveTimer: number = 0;
  private endlessWaveNum: number = 0;
  private endlessSpawnInterval: number = ENDLESS_CONFIG.baseSpawnInterval;

  // Jammer effect
  private jammerActive: boolean = false;
  private jammerTimer: number = 0;

  // Mine pulse timer
  private minePulseTimer: number = 0;

  constructor() {
    super('GameScene');
  }

  init(data: { missionIndex?: number; endless?: boolean }): void {
    this.missionIndex = data.missionIndex ?? 0;
    this.isEndless = data.endless ?? false;
  }

  create(): void {
    audio.init();
    this.saveManager = new SaveManager();
    this.gameState = this.saveManager.getState();

    if (this.isEndless) {
      // Generate an endless mission config
      this.mission = {
        id: 'endless',
        name: 'Endless Patrol',
        description: 'Survive as long as you can.',
        difficulty: 0,
        mode: 'endless',
        convoyComposition: ['container', 'tanker', 'patrol'],
        waves: [],
        parTime: 9999,
        baseReward: 0,
      };
    } else {
      this.mission = MISSION_CONFIGS[this.missionIndex];
    }

    // Reset state
    this.convoyShips = [];
    this.enemies = [];
    this.projectiles = [];
    this.supportAssets = [];
    this.spawnQueue = [];
    this.missionTime = 0;
    this.score = 0;
    this.enemiesKilled = 0;
    this.shotsHit = 0;
    this.waveIndex = 0;
    this.gameOver = false;
    this.missionComplete = false;
    this.defendTimer = 0;
    this.endlessWaveTimer = 0;
    this.endlessWaveNum = 0;
    this.endlessSpawnInterval = ENDLESS_CONFIG.baseSpawnInterval;
    this.jammerActive = false;
    this.jammerTimer = 0;
    this.minePulseTimer = 0;

    // World bounds
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.ocean);

    // Systems
    this.effects = new EffectsSystem(this);

    // Background
    this.createBackground();
    this.createPathVisual();

    // Convoy
    this.createConvoy();

    // Apache
    const startPos = CONVOY_PATH[0];
    this.apache = new Apache(this, startPos.x + 240, startPos.y - 144, this.gameState.upgrades);

    // Camera
    this.cameras.main.startFollow(this.apache.sprite, false, 0.08, 0.08);

    // Projectile pool
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      this.projectiles.push(new Projectile(this));
    }

    // Support assets
    this.createSupportAssets();

    // Input
    this.createInput();

    // HUD
    this.createHUD();

    // Threat indicators & minimap
    this.threatIndicator = new ThreatIndicator(this);
    this.miniMap = new MiniMap(this);
  }

  private createBackground(): void {
    // Deep ocean base with layered wave patterns
    const bgGraphics = this.add.graphics().setDepth(0);

    // Base ocean gradient (darker at edges, lighter in center)
    for (let y = 0; y < WORLD_HEIGHT; y += 20) {
      const yRatio = Math.abs(y / WORLD_HEIGHT - 0.5) * 2;
      const darken = yRatio * 0.15;
      const r = Math.max(0, 0x0a - Math.floor(darken * 255));
      const g = Math.max(0, 0x2a - Math.floor(darken * 128));
      const b = Math.max(0, 0x4a - Math.floor(darken * 64));
      bgGraphics.fillStyle((r << 16) | (g << 8) | b, 1);
      bgGraphics.fillRect(0, y, WORLD_WIDTH, 20);
    }

    // Wave pattern overlay (organic, large scale)
    const waveGraphics = this.add.graphics().setDepth(0);
    for (let x = 0; x < WORLD_WIDTH; x += 40) {
      for (let y = 0; y < WORLD_HEIGHT; y += 40) {
        const n1 = Math.sin(x * 0.008 + y * 0.005) * Math.cos(y * 0.012 - x * 0.003);
        const n2 = Math.sin(x * 0.015 + y * 0.01) * 0.5;
        const combined = (n1 + n2) * 0.5 + 0.5;

        if (combined > 0.6) {
          waveGraphics.fillStyle(COLORS.oceanLight, 0.12);
          waveGraphics.fillRect(x, y, 40, 40);
        } else if (combined < 0.3) {
          waveGraphics.fillStyle(COLORS.oceanDark, 0.1);
          waveGraphics.fillRect(x, y, 40, 40);
        }
      }
    }

    // Caustic light dappling
    const causticGraphics = this.add.graphics().setDepth(0);
    for (let i = 0; i < 500; i++) {
      const cx = Math.random() * WORLD_WIDTH;
      const cy = 180 + Math.random() * (WORLD_HEIGHT - 360);
      const size = 16 + Math.random() * 48;
      causticGraphics.fillStyle(0x2a6a9a, 0.05 + Math.random() * 0.06);
      causticGraphics.fillEllipse(cx, cy, size, size * 0.6);
    }

    // Coastlines — top
    const coastTop = this.add.graphics().setDepth(1);
    coastTop.fillStyle(0x6a5a34, 0.5);
    coastTop.fillRect(0, 0, WORLD_WIDTH, 144);
    coastTop.fillStyle(COLORS.sand, 0.5);
    coastTop.fillRect(0, 0, WORLD_WIDTH, 108);
    coastTop.fillStyle(0xd4b87a, 0.35);
    coastTop.fillRect(0, 0, WORLD_WIDTH, 60);
    // Surf line
    coastTop.fillStyle(0x4499bb, 0.2);
    coastTop.fillRect(0, 115, WORLD_WIDTH, 14);
    coastTop.fillStyle(0x66bbdd, 0.15);
    coastTop.fillRect(0, 120, WORLD_WIDTH, 8);
    coastTop.fillStyle(0x88ddee, 0.08);
    coastTop.fillRect(0, 128, WORLD_WIDTH, 16);
    // Rocky outcrops
    for (let x = 0; x < WORLD_WIDTH; x += 200 + Math.random() * 400) {
      const rockSize = 14 + Math.random() * 30;
      coastTop.fillStyle(0x6a5a34, 0.6);
      coastTop.fillCircle(x, 124 + Math.random() * 14, rockSize);
      coastTop.fillStyle(0x7a6034, 0.4);
      coastTop.fillCircle(x + rockSize * 0.3, 118, rockSize * 0.7);
      // Rock highlight
      coastTop.fillStyle(0x8a7044, 0.25);
      coastTop.fillCircle(x - rockSize * 0.2, 116, rockSize * 0.5);
    }

    // Coastlines — bottom
    const coastBot = this.add.graphics().setDepth(1);
    coastBot.fillStyle(0x6a5a34, 0.5);
    coastBot.fillRect(0, WORLD_HEIGHT - 144, WORLD_WIDTH, 144);
    coastBot.fillStyle(COLORS.sand, 0.5);
    coastBot.fillRect(0, WORLD_HEIGHT - 108, WORLD_WIDTH, 108);
    coastBot.fillStyle(0xd4b87a, 0.35);
    coastBot.fillRect(0, WORLD_HEIGHT - 60, WORLD_WIDTH, 60);
    coastBot.fillStyle(0x4499bb, 0.2);
    coastBot.fillRect(0, WORLD_HEIGHT - 130, WORLD_WIDTH, 14);
    coastBot.fillStyle(0x66bbdd, 0.15);
    coastBot.fillRect(0, WORLD_HEIGHT - 130, WORLD_WIDTH, 8);
    coastBot.fillStyle(0x88ddee, 0.08);
    coastBot.fillRect(0, WORLD_HEIGHT - 144, WORLD_WIDTH, 16);
    for (let x = 200; x < WORLD_WIDTH; x += 200 + Math.random() * 400) {
      const rockSize = 14 + Math.random() * 30;
      coastBot.fillStyle(0x6a5a34, 0.6);
      coastBot.fillCircle(x, WORLD_HEIGHT - 124 - Math.random() * 14, rockSize);
      coastBot.fillStyle(0x7a6034, 0.4);
      coastBot.fillCircle(x - rockSize * 0.3, WORLD_HEIGHT - 118, rockSize * 0.7);
      coastBot.fillStyle(0x8a7044, 0.25);
      coastBot.fillCircle(x + rockSize * 0.2, WORLD_HEIGHT - 116, rockSize * 0.5);
    }

    // Oil platforms
    for (let i = 0; i < 5; i++) {
      const px = 1500 + i * 1800 + Math.random() * 600;
      const py = Math.random() > 0.5 ? 220 + Math.random() * 80 : WORLD_HEIGHT - 220 - Math.random() * 80;
      this.add.ellipse(px + 6, py + 6, 60, 44, 0x000000, 0.15).setDepth(1);
      this.add.rectangle(px, py, 52, 52, 0x555555, 0.6).setDepth(2);
      this.add.rectangle(px - 18, py, 4, 60, 0x444444, 0.5).setDepth(2);
      this.add.rectangle(px + 18, py, 4, 60, 0x444444, 0.5).setDepth(2);
      this.add.rectangle(px, py - 32, 8, 44, 0x666666, 0.6).setDepth(3);
      this.add.circle(px, py - 50, 4, 0xff4400, 0.5).setDepth(3);
    }
  }

  private createPathVisual(): void {
    const graphics = this.add.graphics();
    // Shipping lane markers (dashed)
    graphics.lineStyle(1, 0x1a4a7a, 0.2);
    for (let t = 0; t < 1; t += 0.01) {
      const i = Math.floor(t * (CONVOY_PATH.length - 1));
      const seg = t * (CONVOY_PATH.length - 1) - i;
      if (i < CONVOY_PATH.length - 1) {
        const x = CONVOY_PATH[i].x + (CONVOY_PATH[i + 1].x - CONVOY_PATH[i].x) * seg;
        const y = CONVOY_PATH[i].y + (CONVOY_PATH[i + 1].y - CONVOY_PATH[i].y) * seg;
        if (Math.floor(t * 100) % 3 === 0) {
          graphics.fillStyle(0x1a4a7a, 0.15);
          graphics.fillRect(x - 1, y - 1, 2, 2);
        }
      }
    }
    graphics.setDepth(2);
  }

  private createConvoy(): void {
    const shipTypes = this.mission.convoyComposition;
    const spacing = 96;
    const startOffset = -((shipTypes.length - 1) * spacing) / 2;

    shipTypes.forEach((type, i) => {
      const config = SHIP_CONFIGS[type];
      const offset = startOffset + i * spacing;
      const ship = new ConvoyShip(this, config, CONVOY_PATH, offset);
      // In defend mode, ships don't move
      if (this.mission.mode === 'defend') {
        ship.pathProgress = 0.5; // parked in middle
      }
      this.convoyShips.push(ship);
    });
  }

  private createSupportAssets(): void {
    const state = this.gameState;
    let supportIndex = 0;
    const offsets = [
      { x: 0, y: -168 },
      { x: 0, y: 168 },
      { x: -192, y: 0 },
    ];

    for (const [type, config] of Object.entries(SUPPORT_CONFIGS)) {
      if (state.supportUnlocks[type]) {
        const offset = offsets[supportIndex % offsets.length];
        const startPos = CONVOY_PATH[0];
        const asset = new SupportAsset(this, config, startPos.x + offset.x, startPos.y + offset.y);
        this.supportAssets.push(asset);
        supportIndex++;
      }
    }
  }

  private createInput(): void {
    this.joystick = new VirtualJoystick(this, 160, GAME_HEIGHT - 180);

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    const btnY = GAME_HEIGHT - 140;
    this.rocketButton = new AbilityButton(
      this, GAME_WIDTH - 140, btnY, 'RKT', this.apache.rocketCooldown, this.apache.rocketCount
    );
    this.rocketButton.onActivate = () => this.fireRocket();

    this.flareButton = new AbilityButton(
      this, GAME_WIDTH - 260, btnY, 'FLR', this.apache.flareCooldown
    );
    this.flareButton.onActivate = () => this.deployFlare();
  }

  private createHUD(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '22px',
      color: '#00ff88',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4,
    };

    this.hpText = this.add.text(20, 20, '', style).setScrollFactor(0).setDepth(1100);
    this.scoreText = this.add.text(20, 52, '', style).setScrollFactor(0).setDepth(1100);
    this.waveText = this.add.text(GAME_WIDTH - 300, 20, '', { ...style, align: 'right' })
      .setOrigin(0, 0).setScrollFactor(0).setDepth(1100);
    this.timerText = this.add.text(GAME_WIDTH / 2, 20, '', { ...style, fontSize: '26px' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(1100);
    this.modeText = this.add.text(20, 84, '', { ...style, fontSize: '18px', color: '#ffcc00' })
      .setScrollFactor(0).setDepth(1100);

    // Mission name flash
    const missionTitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, this.mission.name, {
      fontSize: '52px', color: '#ffffff', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1200);

    const missionDesc = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, this.mission.description, {
      fontSize: '24px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1200);

    // Mode indicator
    let modeLabel = '';
    if (this.mission.mode === 'defend') modeLabel = 'DEFEND MODE — Hold position!';
    else if (this.mission.mode === 'mineField') modeLabel = 'MINE CORRIDOR — Clear the path!';
    else if (this.mission.mode === 'survive') modeLabel = 'SURVIVE — Get the convoy through!';
    else if (this.mission.mode === 'boss') modeLabel = 'BOSS ENCOUNTER';
    else if (this.mission.mode === 'endless') modeLabel = 'ENDLESS MODE — How long can you last?';

    const modeFlash = modeLabel ? this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, modeLabel, {
      fontSize: '28px', color: '#ffcc00', fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1200) : null;

    this.tweens.add({
      targets: [missionTitle, missionDesc, modeFlash].filter(Boolean),
      alpha: 0,
      delay: 2500,
      duration: 500,
      onComplete: () => { missionTitle.destroy(); missionDesc.destroy(); modeFlash?.destroy(); },
    });

    if (this.mission.isBoss) {
      audio.playBossWarning();
    } else {
      audio.playWaveWarning();
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    if (this.gameOver || this.missionComplete) return;

    this.missionTime += dt;

    this.updateApacheMovement(dt);
    this.updateAutoFire(dt);
    this.updateConvoy(dt);
    this.updateSupportAssets(dt);

    if (this.isEndless) {
      this.updateEndlessSpawning(dt);
    } else {
      this.updateWaves();
    }
    this.updateSpawnQueue(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.checkCollisions();
    this.updateJammerEffect(dt);
    this.updateMinePulse(dt);

    this.rocketButton.update(dt);
    this.flareButton.update(dt);

    // Defend mode timer
    if (this.mission.mode === 'defend') {
      this.defendTimer += dt;
    }

    // Threat indicators & minimap
    this.threatIndicator.update(
      this.cameras.main.scrollX,
      this.cameras.main.scrollY,
      this.enemies
    );
    this.miniMap.update(
      this.cameras.main.scrollX,
      this.cameras.main.scrollY,
      this.apache,
      this.convoyShips,
      this.enemies
    );

    this.updateHUD();
    this.checkMissionEnd();
  }

  private updateApacheMovement(dt: number): void {
    let moveX = this.joystick.forceX;
    let moveY = this.joystick.forceY;

    if (this.cursors && moveX === 0 && moveY === 0) {
      const kb = this.joystick.getKeyboardForce(this.cursors, this.wasd);
      moveX = kb.x;
      moveY = kb.y;
    }

    this.apache.x += moveX * this.apache.speed * dt;
    this.apache.y += moveY * this.apache.speed * dt;

    // Clamp to combat radius
    const convoyCenter = this.getConvoyCenter();
    const dx = this.apache.x - convoyCenter.x;
    const dy = this.apache.y - convoyCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.apache.combatRadius) {
      const ratio = this.apache.combatRadius / dist;
      this.apache.x = convoyCenter.x + dx * ratio;
      this.apache.y = convoyCenter.y + dy * ratio;
    }

    this.apache.x = clamp(this.apache.x, 30, WORLD_WIDTH - 30);
    this.apache.y = clamp(this.apache.y, 60, WORLD_HEIGHT - 60);

    this.apache.update(dt);

    // Engine exhaust & rotor wash effects
    this.effects.engineExhaust(this.apache.x, this.apache.y, this.apache.rotation);
    this.effects.rotorWash(this.apache.x, this.apache.y);
  }

  private updateAutoFire(_dt: number): void {
    if (!this.apache.canFire()) return;
    if (this.jammerActive) return; // Jammer disables auto-aim

    let nearest: Enemy | null = null;
    let nearestDist = this.apache.autocannonRange;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const d = distance(this.apache, enemy);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = enemy;
      }
    }

    if (nearest) {
      this.apache.rotation = angleBetween(this.apache, nearest);
      const dir = direction(this.apache, nearest);
      const proj = this.getInactiveProjectile();
      if (proj) {
        const fx = this.apache.x + dir.x * 52;
        const fy = this.apache.y + dir.y * 52;
        proj.fire(fx, fy, dir.x, dir.y, 'autocannon',
          this.apache.autocannonDamage, APACHE_BASE.autocannon.speed,
          this.apache.autocannonRange, APACHE_BASE.autocannon.color,
          APACHE_BASE.autocannon.projectileSize, true);
        this.effects.muzzleFlash(fx, fy);
        audio.playAutocannon();
      }
      this.apache.resetFireCooldown();
    }
  }

  private fireRocket(): boolean {
    let target: Enemy | null = null;
    let bestScore = -1;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const d = distance(this.apache, enemy);
      if (d < this.apache.autocannonRange * 1.8) {
        const score = enemy.hp * 2 + (1000 - d) + (enemy.config.isBoss ? 2000 : 0);
        if (score > bestScore) { bestScore = score; target = enemy; }
      }
    }

    if (!target) {
      let nearestDist = Infinity;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const d = distance(this.apache, enemy);
        if (d < nearestDist) { nearestDist = d; target = enemy; }
      }
    }

    if (!target) return false;

    const dir = direction(this.apache, target);
    const proj = this.getInactiveProjectile();
    if (proj) {
      proj.fire(this.apache.x + dir.x * 52, this.apache.y + dir.y * 52,
        dir.x, dir.y, 'rocket', this.apache.rocketDamage, 1200, 1440,
        COLORS.rocketTrail, 14, true);
    }
    this.cameras.main.shake(120, 0.006);
    audio.playRocket();
    return true;
  }

  private deployFlare(): boolean {
    const flareRange = 528;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if ((enemy.config.type === 'suicideDrone' || enemy.config.type === 'jammerDrone')
        && distance(this.apache, enemy) < flareRange) {
        enemy.takeDamage(enemy.hp);
        this.effects.explosion(enemy.x, enemy.y, 15, 0xffcc00);
      }
    }
    this.effects.flareBurst(this.apache.x, this.apache.y);
    audio.playFlare();
    return true;
  }

  private updateConvoy(dt: number): void {
    for (const ship of this.convoyShips) {
      if (this.mission.mode === 'defend' && ship.alive) {
        // Ships stationary in defend mode
        ship.updateStationary();
      } else {
        ship.update(dt);
      }
      // Ship wake effect
      if (ship.alive && this.mission.mode !== 'defend') {
        this.effects.shipWake(ship.x, ship.y, ship.config.width, ship.config.speed);
      }
    }
  }

  private updateSupportAssets(dt: number): void {
    const convoyCenter = this.getConvoyCenter();
    const offsets = [
      { x: 0, y: -168 },
      { x: 0, y: 168 },
      { x: -192, y: 0 },
    ];

    this.supportAssets.forEach((asset, i) => {
      const offset = offsets[i % offsets.length];
      asset.followPosition(convoyCenter.x, convoyCenter.y, offset.x, offset.y, dt);

      const result = asset.findTarget(this.enemies, dt);
      if (result) {
        if (asset.config.type === 'ciws') {
          this.effects.ciwsBurst(asset.x, asset.y, result.targetX, result.targetY);
          audio.playCIWS();
        } else {
          // Escort fires bullet
          const dir = direction(asset, { x: result.targetX, y: result.targetY });
          const proj = this.getInactiveProjectile();
          if (proj) {
            proj.fire(asset.x + dir.x * 36, asset.y + dir.y * 36,
              dir.x, dir.y, 'autocannon', result.damage, 1440,
              asset.config.range, 0x88ccff, 5, true);
          }
        }

        // CIWS direct damage (hitscan)
        if (asset.config.type === 'ciws') {
          for (const enemy of this.enemies) {
            if (!enemy.alive || enemy.id !== asset.targetId) continue;
            enemy.takeDamage(result.damage);
            if (!enemy.alive) {
              this.enemiesKilled++;
              this.score += enemy.config.scoreValue;
              this.effects.explosion(enemy.x, enemy.y, 15);
            }
            break;
          }
        }
      }
    });
  }

  private updateEndlessSpawning(dt: number): void {
    this.endlessWaveTimer += dt;
    if (this.endlessWaveTimer >= this.endlessSpawnInterval) {
      this.endlessWaveTimer = 0;
      this.endlessWaveNum++;
      this.endlessSpawnInterval = Math.max(
        ENDLESS_CONFIG.minSpawnInterval,
        this.endlessSpawnInterval * ENDLESS_CONFIG.spawnAcceleration
      );

      // Scale enemy count with wave number
      const baseCount = 2 + Math.floor(this.endlessWaveNum / 3);
      const types: EnemyType[] = ['fastAttack', 'droneBoat', 'suicideDrone', 'mine'];
      if (this.endlessWaveNum > 5) types.push('missileSkiff');
      if (this.endlessWaveNum > 10) types.push('armoredPatrol');

      for (let i = 0; i < baseCount; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        this.spawnQueue.push({
          type,
          spawnSide: 'random',
          delay: i * 0.5,
          timer: i * 0.5,
        });
      }

      this.score += ENDLESS_CONFIG.scorePerWave;
      if (this.endlessWaveNum % 5 === 0) audio.playWaveWarning();
    }
  }

  private updateWaves(): void {
    if (this.waveIndex >= this.mission.waves.length) return;

    let triggerProgress: number;

    if (this.mission.mode === 'defend') {
      triggerProgress = this.defendTimer / (this.mission.holdTime || 90);
    } else {
      const aliveShips = this.convoyShips.filter(s => s.alive);
      if (aliveShips.length === 0) return;
      triggerProgress = aliveShips.reduce((sum, s) => sum + s.pathProgress, 0) / aliveShips.length;
    }

    const wave = this.mission.waves[this.waveIndex];
    if (triggerProgress >= wave.triggerAt) {
      for (const group of wave.enemies) {
        for (let i = 0; i < group.count; i++) {
          this.spawnQueue.push({
            type: group.type,
            spawnSide: group.spawnSide,
            delay: group.startDelay + i * group.delay,
            timer: group.startDelay + i * group.delay,
          });
        }
      }
      this.waveIndex++;
      if (this.waveIndex > 1) audio.playWaveWarning();
    }
  }

  private updateSpawnQueue(dt: number): void {
    const toSpawn: typeof this.spawnQueue = [];
    this.spawnQueue = this.spawnQueue.filter(item => {
      item.timer -= dt;
      if (item.timer <= 0) { toSpawn.push(item); return false; }
      return true;
    });
    for (const item of toSpawn) {
      this.spawnEnemy(item.type, item.spawnSide);
    }
  }

  private spawnEnemy(type: EnemyType, spawnSide: string): void {
    const config = { ...ENEMY_CONFIGS[type] };
    if (!config) return;

    // Endless mode scaling
    if (this.isEndless && this.endlessWaveNum > 0) {
      config.hp = Math.floor(config.hp * Math.pow(ENDLESS_CONFIG.enemyHpScale, this.endlessWaveNum));
      config.speed = Math.floor(config.speed * Math.pow(ENDLESS_CONFIG.enemySpeedScale, this.endlessWaveNum));
    }

    const convoyCenter = this.getConvoyCenter();
    let x: number, y: number;

    const side = spawnSide === 'random'
      ? ['top', 'bottom', 'left', 'right'][Math.floor(Math.random() * 4)]
      : spawnSide;

    const margin = 192;
    switch (side) {
      case 'top':
        x = convoyCenter.x + randomRange(-720, 720);
        y = convoyCenter.y - 840 - randomRange(0, margin);
        break;
      case 'bottom':
        x = convoyCenter.x + randomRange(-720, 720);
        y = convoyCenter.y + 840 + randomRange(0, margin);
        break;
      case 'right':
        x = convoyCenter.x + 960 + randomRange(0, 480);
        y = convoyCenter.y + randomRange(-480, 480);
        break;
      case 'left':
        x = convoyCenter.x - 960 - randomRange(0, 480);
        y = convoyCenter.y + randomRange(-480, 480);
        break;
      default:
        x = convoyCenter.x + 960;
        y = convoyCenter.y;
    }

    if (type === 'mine') {
      const aliveShips = this.convoyShips.filter(s => s.alive);
      if (aliveShips.length > 0) {
        const leadShip = aliveShips.reduce((best, s) => s.pathProgress > best.pathProgress ? s : best, aliveShips[0]);
        x = leadShip.x + randomRange(480, 1200);
        y = leadShip.y + randomRange(-288, 288);
      }
    }

    const enemy = new Enemy(this, config, x, y);
    this.enemies.push(enemy);
  }

  private updateEnemies(dt: number): void {
    const targets: Vector2[] = this.convoyShips.filter(s => s.alive).map(s => ({ x: s.x, y: s.y }));

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      // Strafe behavior: maintain distance while circling
      if (enemy.config.behavior === 'strafe') {
        enemy.updateStrafe(dt, targets, this.getConvoyCenter());
      } else {
        enemy.update(dt, targets);
      }

      // Enemy shooting
      if (enemy.canAttack() && enemy.targetPosition) {
        const d = distance(enemy, enemy.targetPosition);
        if (d < enemy.config.attackRange) {
          const eDir = direction(enemy, enemy.targetPosition);
          const projType = enemy.config.type === 'missileSkiff' ? 'missile' as const : 'enemyBullet' as const;
          const projSpeed = enemy.config.type === 'missileSkiff' ? 720 : 960;
          const projSize = enemy.config.type === 'missileSkiff' ? 12 : 7;
          const proj = this.getInactiveProjectile();
          if (proj) {
            proj.fire(enemy.x + eDir.x * 24, enemy.y + eDir.y * 24,
              eDir.x, eDir.y, projType, enemy.config.damage,
              projSpeed, enemy.config.attackRange + 50,
              enemy.config.type === 'missileSkiff' ? 0xbb4488 : 0xff4444,
              projSize, false);
          }
          enemy.resetFireCooldown();
          audio.playEnemyShoot();
        }
      }
    }

    this.enemies = this.enemies.filter(e => {
      if (!e.alive) { e.destroy(); return false; }
      return true;
    });
  }

  private updateJammerEffect(dt: number): void {
    // Check if any jammer drones are in range
    this.jammerActive = false;
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.config.type !== 'jammerDrone') continue;
      if (distance(this.apache, enemy) < enemy.config.attackRange) {
        this.jammerActive = true;
        break;
      }
    }

    if (this.jammerActive) {
      this.jammerTimer += dt;
      // Visual static effect
      if (Math.random() > 0.7) {
        const sx = this.apache.x + randomRange(-72, 72);
        const sy = this.apache.y + randomRange(-72, 72);
        const glitch = this.add.rectangle(sx, sy, randomRange(4, 18), 2, 0x8844bb, 0.5).setDepth(700);
        this.tweens.add({
          targets: glitch, alpha: 0, duration: 100,
          onComplete: () => glitch.destroy(),
        });
      }
    }
  }

  private updateMinePulse(dt: number): void {
    this.minePulseTimer += dt;
    if (this.minePulseTimer >= 1.5) {
      this.minePulseTimer = 0;
      for (const enemy of this.enemies) {
        if (enemy.alive && enemy.config.type === 'mine') {
          this.effects.minePulse(enemy.x, enemy.y);
          // Beep if near player
          if (distance(this.apache, enemy) < 480) {
            audio.playMineBeep();
          }
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      proj.update(dt);
      // Trail effects
      if (proj.active && proj.fromPlayer) {
        if (proj.type === 'rocket') {
          this.effects.rocketTrail(proj.sprite.x, proj.sprite.y);
        } else {
          this.effects.tracerTrail(proj.sprite.x, proj.sprite.y, proj.sprite.fillColor);
        }
      }
    }
  }

  private checkCollisions(): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;

      if (proj.fromPlayer) {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          const d = distance(proj.sprite, enemy);
          const hitRadius = Math.max(enemy.config.width, enemy.config.height) / 2 + proj.sprite.width;
          if (d < hitRadius) {
            // Rocket blast radius
            if (proj.type === 'rocket') {
              const blastRadius = APACHE_BASE.rocketBlastRadius;
              for (const e2 of this.enemies) {
                if (!e2.alive) continue;
                if (distance(proj.sprite, e2) < blastRadius) {
                  const blastDmg = distance(proj.sprite, e2) < blastRadius / 2 ? proj.damage : proj.damage * 0.5;
                  e2.takeDamage(blastDmg);
                  if (!e2.alive) {
                    this.enemiesKilled++;
                    this.score += e2.config.scoreValue;
                    this.effects.explosion(e2.x, e2.y, 20);
                  }
                }
              }
              this.effects.explosion(proj.sprite.x, proj.sprite.y, 35, COLORS.rocketTrail);
              audio.playExplosionLarge();
              this.cameras.main.shake(100, 0.006);
            } else {
              enemy.takeDamage(proj.damage);
              this.effects.damageFlash(enemy.x, enemy.y);
              audio.playHit();
            }
            proj.deactivate();
            this.shotsHit++;

            if (!enemy.alive) {
              this.enemiesKilled++;
              this.score += enemy.config.scoreValue;
              const size = enemy.config.isBoss ? 50 : 20;
              this.effects.explosion(enemy.x, enemy.y, size);
              audio.playExplosionSmall();
              this.cameras.main.shake(80, 0.003);
            }
            break;
          }
        }
      } else {
        // Enemy projectiles hit Apache
        const dApache = distance(proj.sprite, this.apache);
        if (dApache < 48) {
          this.apache.takeDamage(proj.damage);
          proj.deactivate();
          this.effects.damageFlash(this.apache.x, this.apache.y);
          audio.playApacheHit();
          this.cameras.main.shake(100, 0.008);
          continue;
        }

        // Enemy projectiles hit convoy ships
        for (const ship of this.convoyShips) {
          if (!ship.alive) continue;
          const d = distance(proj.sprite, ship);
          if (d < Math.max(ship.config.width, ship.config.height) / 2) {
            ship.takeDamage(proj.damage);
            proj.deactivate();
            this.effects.damageFlash(ship.x, ship.y);
            audio.playShipHit();
            if (!ship.alive) {
              this.effects.shipDestruction(ship.x, ship.y, ship.config.width);
              audio.playExplosionLarge();
              this.cameras.main.shake(200, 0.012);
            }
            break;
          }
        }
      }
    }

    // Suicide / mine collisions
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      if (enemy.config.behavior === 'suicide') {
        for (const ship of this.convoyShips) {
          if (!ship.alive) continue;
          if (enemy.isInContactRange(ship, 72)) {
            ship.takeDamage(enemy.config.damage);
            enemy.takeDamage(enemy.hp);
            this.effects.explosion(enemy.x, enemy.y, 25);
            audio.playExplosionSmall();
            this.cameras.main.shake(150, 0.008);
            if (!ship.alive) {
              this.effects.shipDestruction(ship.x, ship.y, ship.config.width);
              audio.playExplosionLarge();
            }
            break;
          }
        }
        if (enemy.alive && enemy.isInContactRange(this.apache, 60)) {
          this.apache.takeDamage(enemy.config.damage);
          enemy.takeDamage(enemy.hp);
          this.effects.explosion(enemy.x, enemy.y, 20);
          audio.playApacheHit();
          this.cameras.main.shake(150, 0.01);
        }
      }

      if (enemy.config.behavior === 'static') {
        for (const ship of this.convoyShips) {
          if (!ship.alive) continue;
          if (enemy.isInProximity(ship)) {
            ship.takeDamage(enemy.config.damage);
            enemy.takeDamage(enemy.hp);
            this.effects.explosion(enemy.x, enemy.y, 35);
            audio.playExplosionLarge();
            this.cameras.main.shake(200, 0.012);
            if (!ship.alive) {
              this.effects.shipDestruction(ship.x, ship.y, ship.config.width);
            }
            break;
          }
        }
        if (enemy.alive && distance(this.apache, enemy) < enemy.config.attackRange) {
          this.apache.takeDamage(enemy.config.damage * 0.5);
          enemy.takeDamage(enemy.hp);
          this.effects.explosion(enemy.x, enemy.y, 35);
          audio.playExplosionLarge();
          this.cameras.main.shake(200, 0.012);
        }
      }
    }
  }

  private checkMissionEnd(): void {
    if (!this.apache.isAlive()) {
      this.endMission(false, 'Apache destroyed');
      return;
    }

    const aliveShips = this.convoyShips.filter(s => s.alive);
    if (aliveShips.length === 0) {
      this.endMission(false, 'Convoy lost');
      return;
    }

    // Endless: never wins, plays until failure
    if (this.isEndless) return;

    // Defend mode: survive until timer
    if (this.mission.mode === 'defend') {
      if (this.defendTimer >= (this.mission.holdTime || 90)) {
        const allWavesDone = this.waveIndex >= this.mission.waves.length;
        const noEnemies = this.enemies.filter(e => e.alive).length === 0;
        const noSpawns = this.spawnQueue.length === 0;
        if (allWavesDone && noEnemies && noSpawns) {
          this.endMission(true);
        } else if (allWavesDone && noSpawns) {
          // Still enemies alive but timer done — keep fighting until cleared
        }
      }
      return;
    }

    // Standard escort / mine / survive / boss: convoy reaches end
    const allReached = aliveShips.every(s => s.hasReachedEnd());
    const allWavesTriggered = this.waveIndex >= this.mission.waves.length;
    const noActiveEnemies = this.enemies.filter(e => e.alive).length === 0;
    const noSpawnsPending = this.spawnQueue.length === 0;

    if (allReached && allWavesTriggered && noActiveEnemies && noSpawnsPending) {
      this.endMission(true);
    }
  }

  private endMission(success: boolean, reason?: string): void {
    if (this.gameOver || this.missionComplete) return;

    if (success) {
      this.missionComplete = true;
      audio.playMissionComplete();
    } else {
      this.gameOver = true;
      audio.playMissionFailed();
    }

    const aliveShips = this.convoyShips.filter(s => s.alive).length;
    const totalShips = this.convoyShips.length;
    const shipsLost = totalShips - aliveShips;

    let stars = 0;
    if (success) {
      stars = 1;
      if (shipsLost === 0) stars = 2;
      if (shipsLost === 0 && this.apache.hp > this.apache.maxHp * 0.5 && this.missionTime < this.mission.parTime) {
        stars = 3;
      }
    }

    let credits: number;
    if (this.isEndless) {
      credits = Math.floor(this.score / 100) * ENDLESS_CONFIG.creditsPer100Score;
      this.saveManager.setEndlessHighScore(this.score);
    } else {
      credits = success ? this.mission.baseReward : Math.floor(this.mission.baseReward * 0.25);
      credits += aliveShips * SCORING.shipSurvivalBonus;
      credits += SCORING.starBonuses[stars];
      if (this.apache.shotsFired > 0 && (this.shotsHit / this.apache.shotsFired) >= SCORING.accuracyBonusThreshold) {
        credits += SCORING.accuracyBonus;
      }
    }

    this.saveManager.addCredits(credits);
    if (success && !this.isEndless) {
      this.saveManager.unlockNextMission(this.missionIndex);
      this.saveManager.saveMissionResult(this.mission.id, {
        stars, time: this.missionTime, shipsLost,
        shipsSurvived: aliveShips, enemiesKilled: this.enemiesKilled, credits,
      });
    }

    this.showResults(success, stars, credits, aliveShips, totalShips, reason);
  }

  private showResults(success: boolean, stars: number, credits: number, alive: number, total: number, reason?: string): void {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(2000);

    const titleColor = success ? '#00ff88' : '#ff4444';
    const titleText = this.isEndless ? 'PATROL ENDED' : (success ? 'MISSION COMPLETE' : 'MISSION FAILED');

    this.add.text(GAME_WIDTH / 2, 160, titleText, {
      fontSize: '56px', color: titleColor, fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    if (reason) {
      this.add.text(GAME_WIDTH / 2, 230, reason, {
        fontSize: '24px', color: '#ff8888', fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);
    }

    if (!this.isEndless) {
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      this.add.text(GAME_WIDTH / 2, 290, starStr, {
        fontSize: '60px', color: '#ffcc00', fontFamily: 'serif',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);
    }

    const stats = [
      `Ships Survived: ${alive}/${total}`,
      `Enemies Destroyed: ${this.enemiesKilled}`,
      `Time: ${Math.floor(this.missionTime)}s`,
      ...(this.isEndless ? [`Waves Survived: ${this.endlessWaveNum}`, `Score: ${this.score}`] : []),
      `Credits Earned: +${credits}`,
    ];
    stats.forEach((line, i) => {
      this.add.text(GAME_WIDTH / 2, 380 + i * 44, line, {
        fontSize: '26px', color: '#cccccc', fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);
    });

    const btnY = 380 + stats.length * 44 + 60;
    const continueBtn = this.add.text(GAME_WIDTH / 2, btnY, '[ CONTINUE ]', {
      fontSize: '32px', color: '#00ff88', fontFamily: 'monospace',
      backgroundColor: '#1a3322', padding: { x: 36, y: 16 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive();

    continueBtn.on('pointerdown', () => {
      this.cleanUp();
      this.scene.start('MissionSelectScene');
    });

    const retryBtn = this.add.text(GAME_WIDTH / 2, btnY + 80, '[ RETRY ]', {
      fontSize: '26px', color: '#aaaaaa', fontFamily: 'monospace',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001).setInteractive();

    retryBtn.on('pointerdown', () => {
      this.cleanUp();
      this.scene.restart({ missionIndex: this.missionIndex, endless: this.isEndless });
    });
  }

  private getConvoyCenter(): Vector2 {
    const aliveShips = this.convoyShips.filter(s => s.alive);
    if (aliveShips.length === 0) return { x: this.apache.x, y: this.apache.y };
    const cx = aliveShips.reduce((sum, s) => sum + s.x, 0) / aliveShips.length;
    const cy = aliveShips.reduce((sum, s) => sum + s.y, 0) / aliveShips.length;
    return { x: cx, y: cy };
  }

  private getInactiveProjectile(): Projectile | null {
    for (const proj of this.projectiles) {
      if (!proj.active) return proj;
    }
    return null;
  }

  private updateHUD(): void {
    const hpPct = Math.ceil((this.apache.hp / this.apache.maxHp) * 100);
    const hpColor = hpPct > 60 ? '#00ff88' : hpPct > 30 ? '#dddd00' : '#ff4444';
    this.hpText.setText(`HP: ${Math.ceil(this.apache.hp)}/${this.apache.maxHp}`);
    this.hpText.setColor(hpColor);
    this.scoreText.setText(`Score: ${this.score}  Kills: ${this.enemiesKilled}`);

    const aliveShips = this.convoyShips.filter(s => s.alive).length;
    const totalShips = this.convoyShips.length;
    this.waveText.setText(`Ships: ${aliveShips}/${totalShips}`);

    const mins = Math.floor(this.missionTime / 60);
    const secs = Math.floor(this.missionTime % 60);
    this.timerText.setText(`${mins}:${secs.toString().padStart(2, '0')}`);

    // Mode-specific HUD
    if (this.mission.mode === 'defend') {
      const remaining = Math.max(0, (this.mission.holdTime || 90) - this.defendTimer);
      this.modeText.setText(`HOLD: ${Math.ceil(remaining)}s remaining`);
    } else if (this.isEndless) {
      this.modeText.setText(`Wave: ${this.endlessWaveNum}  |  Best: ${this.saveManager.getEndlessHighScore()}`);
    } else if (this.mission.mode === 'boss') {
      const bossCount = this.enemies.filter(e => e.alive && (e.config.isBoss || e.config.type === 'armoredPatrol')).length;
      if (bossCount > 0) this.modeText.setText(`BOSS: ${bossCount} heavy units active`);
      else this.modeText.setText('');
    } else {
      this.modeText.setText('');
    }

    // Jammer warning
    if (this.jammerActive) {
      this.modeText.setText('!! JAMMING — AUTO-AIM DISABLED !!');
      this.modeText.setColor('#bb44ff');
    } else {
      this.modeText.setColor('#ffcc00');
    }
  }

  private cleanUp(): void {
    this.apache?.destroy();
    this.convoyShips.forEach(s => s.destroy());
    this.enemies.forEach(e => e.destroy());
    this.projectiles.forEach(p => p.sprite.destroy());
    this.supportAssets.forEach(s => s.destroy());
    this.joystick?.destroy();
    this.rocketButton?.destroy();
    this.flareButton?.destroy();
    this.threatIndicator?.destroy();
    this.miniMap?.destroy();
  }
}
