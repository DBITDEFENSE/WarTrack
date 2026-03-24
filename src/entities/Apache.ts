import Phaser from 'phaser';
import { APACHE_BASE, COLORS } from '../config/game.config.ts';
import { HealthBar } from '../ui/HealthBar.ts';
import type { GameState } from '../types/index.ts';
import { UPGRADE_CONFIGS } from '../config/game.config.ts';

export class Apache {
  public sprite: Phaser.GameObjects.Container;
  public x: number;
  public y: number;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public autocannonDamage: number;
  public autocannonFireRate: number;
  public autocannonRange: number;
  public rocketDamage: number;
  public rocketCount: number;
  public rocketCooldown: number;
  public flareCooldown: number;
  public combatRadius: number;

  private healthBar: HealthBar;
  private body: Phaser.GameObjects.Image;
  private rotor: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  private rotorAngle: number = 0;
  public rotation: number = 0;

  // Combat state
  public fireCooldown: number = 0;
  public shotsFired: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, upgrades: GameState['upgrades']) {
    this.x = x;
    this.y = y;

    // Apply upgrades
    const fpLevel = upgrades.firepower;
    const frLevel = upgrades.fireRate;
    const rkLevel = upgrades.rockets;
    const arLevel = upgrades.armor;

    const fpMult = fpLevel > 0 ? UPGRADE_CONFIGS[0].levels[fpLevel - 1].effect : 1;
    const frMult = frLevel > 0 ? UPGRADE_CONFIGS[1].levels[frLevel - 1].effect : 1;
    const rkValue = rkLevel > 0 ? UPGRADE_CONFIGS[2].levels[rkLevel - 1].effect : APACHE_BASE.rocketCount;
    const arValue = arLevel > 0 ? UPGRADE_CONFIGS[3].levels[arLevel - 1].effect : APACHE_BASE.hp;

    this.maxHp = arValue;
    this.hp = this.maxHp;
    this.speed = APACHE_BASE.speed;
    this.autocannonDamage = APACHE_BASE.autocannon.damage * fpMult;
    this.autocannonFireRate = APACHE_BASE.autocannon.fireRate * frMult;
    this.autocannonRange = APACHE_BASE.autocannon.range;
    this.rocketDamage = APACHE_BASE.rocketDamage;
    this.rocketCount = rkValue;
    this.rocketCooldown = APACHE_BASE.rocketCooldown;
    this.flareCooldown = APACHE_BASE.flareCooldown;
    this.combatRadius = APACHE_BASE.combatRadius;

    // Shadow layer (offset for top-left lighting)
    this.shadow = scene.add.ellipse(8, 8, 100, 38, 0x000000, 0.25)
      .setDepth(0);

    // Body sprite (textured)
    if (scene.textures.exists('apache_body')) {
      this.body = scene.add.image(0, 0, 'apache_body').setDepth(600);
    } else {
      // Fallback: draw polygon like before
      const poly = scene.add.polygon(0, 0, [
        -43, 0, -24, -14, 19, -19, 48, -10, 53, 0, 48, 10, 19, 19, -24, 14,
      ], COLORS.apache, 1).setDepth(600);
      this.body = poly as unknown as Phaser.GameObjects.Image;
    }

    // Rotor sprite (textured)
    if (scene.textures.exists('apache_rotor')) {
      this.rotor = scene.add.image(0, 0, 'apache_rotor').setDepth(601);
    } else {
      const rotorFallback = scene.add.circle(0, 0, 16, 0x88aa77, 0.15).setDepth(601);
      this.rotor = rotorFallback as unknown as Phaser.GameObjects.Image;
    }

    this.sprite = scene.add.container(x, y, [this.shadow, this.body, this.rotor])
      .setDepth(600);

    this.healthBar = new HealthBar(scene, 80, 6, -40);
  }

  update(dt: number): void {
    this.sprite.setPosition(this.x, this.y);
    this.sprite.rotation = this.rotation;

    // Spin rotor
    this.rotorAngle += dt * 15;
    this.rotor.setAngle(Phaser.Math.RadToDeg(this.rotorAngle));

    // Update health bar
    this.healthBar.update(this.x, this.y, this.hp / this.maxHp);

    // Cooldowns
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  canFire(): boolean {
    return this.fireCooldown <= 0;
  }

  resetFireCooldown(): void {
    this.fireCooldown = 1 / this.autocannonFireRate;
    this.shotsFired++;
  }

  destroy(): void {
    this.sprite.destroy();
    this.healthBar.destroy();
  }
}
