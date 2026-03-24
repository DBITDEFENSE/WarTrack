import Phaser from 'phaser';
import type { EnemyConfig, Vector2 } from '../types/index.ts';
import { HealthBar } from '../ui/HealthBar.ts';
import { distance, direction, angleBetween } from '../utils/math.ts';

const ENEMY_TEXTURE_MAP: Record<string, string> = {
  fastAttack: 'enemy_fastAttack',
  droneBoat: 'enemy_droneBoat',
  suicideDrone: 'enemy_suicideDrone',
  mine: 'enemy_mine',
  missileSkiff: 'enemy_missileSkiff',
  armoredPatrol: 'enemy_armoredPatrol',
  jammerDrone: 'enemy_jammerDrone',
};

export class Enemy {
  public sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  public config: EnemyConfig;
  public hp: number;
  public x: number;
  public y: number;
  public alive: boolean = true;
  public active: boolean = true;
  public targetPosition: Vector2 | null = null;
  public fireCooldown: number = 0;
  public id: string;

  private healthBar: HealthBar;
  private scene: Phaser.Scene;
  private shadow: Phaser.GameObjects.Ellipse | null = null;
  private usingTexture: boolean = false;

  private static nextId = 0;

  constructor(scene: Phaser.Scene, config: EnemyConfig, x: number, y: number) {
    this.scene = scene;
    this.config = config;
    this.hp = config.hp;
    this.x = x;
    this.y = y;
    this.id = `enemy_${Enemy.nextId++}`;

    // Try textured sprite first
    const texKey = config.isBoss ? 'enemy_boss' : ENEMY_TEXTURE_MAP[config.type];
    if (texKey && scene.textures.exists(texKey)) {
      this.usingTexture = true;
      const isAirborne = config.type === 'suicideDrone' || config.type === 'jammerDrone';
      const depth = config.type === 'mine' ? 250 : isAirborne ? 350 : 290;

      // Shadow
      this.shadow = scene.add.ellipse(x + 2, y + 2, config.width * 0.8, config.height * 0.6, 0x000000, 0.2)
        .setDepth(depth - 1);

      this.sprite = scene.add.image(x, y, texKey).setDepth(depth);
    } else {
      // Fallback to primitives
      if (config.type === 'mine') {
        const circle = scene.add.circle(x, y, config.width / 2, config.color, 1).setDepth(250);
        this.sprite = circle as unknown as Phaser.GameObjects.Rectangle;
      } else if (config.type === 'suicideDrone') {
        this.sprite = scene.add.rectangle(x, y, config.width, config.height, config.color, 1)
          .setDepth(350).setRotation(Math.PI / 4) as Phaser.GameObjects.Rectangle;
      } else {
        this.sprite = scene.add.rectangle(x, y, config.width, config.height, config.color, 1)
          .setDepth(290) as Phaser.GameObjects.Rectangle;
      }
    }

    this.healthBar = new HealthBar(scene, config.width + 4, 3, -(config.height / 2 + 6));
  }

  update(dt: number, targets: Vector2[]): void {
    if (!this.alive) return;

    if (targets.length > 0) {
      let nearest = targets[0];
      let nearestDist = distance(this, nearest);
      for (let i = 1; i < targets.length; i++) {
        const d = distance(this, targets[i]);
        if (d < nearestDist) {
          nearest = targets[i];
          nearestDist = d;
        }
      }
      this.targetPosition = nearest;
    }

    if (this.config.behavior === 'static') {
      // Mines don't move
    } else if (this.targetPosition) {
      const dir = direction(this, this.targetPosition);
      this.x += dir.x * this.config.speed * dt;
      this.y += dir.y * this.config.speed * dt;

      const angle = angleBetween(this, this.targetPosition);
      if (this.usingTexture) {
        // Delta-wing drones have nose pointing up (-Y), need rotation offset
        const isDeltaWing = this.config.type === 'suicideDrone' || this.config.type === 'jammerDrone';
        this.sprite.setRotation(isDeltaWing ? angle + Math.PI / 2 : angle);
      } else if (this.config.type !== 'suicideDrone') {
        this.sprite.setRotation(angle);
      } else {
        this.sprite.setRotation(angle + Math.PI / 4);
      }
    }

    this.sprite.setPosition(this.x, this.y);
    if (this.shadow) this.shadow.setPosition(this.x + 2, this.y + 2);
    this.healthBar.update(this.x, this.y, this.hp / this.config.hp);

    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);

    // Hit flash
    if (this.usingTexture) {
      (this.sprite as Phaser.GameObjects.Image).setTint(0xffffff);
      this.scene.time.delayedCall(60, () => {
        if (this.alive) (this.sprite as Phaser.GameObjects.Image).clearTint();
      });
    } else {
      (this.sprite as Phaser.GameObjects.Rectangle).setFillStyle(0xffffff);
      this.scene.time.delayedCall(60, () => {
        if (this.alive) (this.sprite as Phaser.GameObjects.Rectangle).setFillStyle(this.config.color);
      });
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  die(): void {
    this.alive = false;
    this.active = false;
    this.sprite.setVisible(false);
    if (this.shadow) this.shadow.setVisible(false);
    this.healthBar.setVisible(false);
  }

  canAttack(): boolean {
    return this.alive && this.fireCooldown <= 0 && this.config.attackRate > 0;
  }

  resetFireCooldown(): void {
    this.fireCooldown = 1 / this.config.attackRate;
  }

  isInContactRange(target: Vector2, range: number = 25): boolean {
    return this.config.behavior === 'suicide' && distance(this, target) < range;
  }

  isInProximity(target: Vector2): boolean {
    return this.config.behavior === 'static' && distance(this, target) < this.config.attackRange;
  }

  updateStrafe(dt: number, targets: Vector2[], center: Vector2): void {
    if (!this.alive) return;

    if (targets.length > 0) {
      let nearest = targets[0];
      let nearestDist = distance(this, nearest);
      for (let i = 1; i < targets.length; i++) {
        const d = distance(this, targets[i]);
        if (d < nearestDist) { nearest = targets[i]; nearestDist = d; }
      }
      this.targetPosition = nearest;
    }

    if (this.targetPosition) {
      const d = distance(this, this.targetPosition);
      const desiredDist = this.config.attackRange * 0.8;

      if (d > desiredDist + 30) {
        const dir = direction(this, this.targetPosition);
        this.x += dir.x * this.config.speed * dt;
        this.y += dir.y * this.config.speed * dt;
      } else if (d < desiredDist - 30) {
        const dir = direction(this.targetPosition, this);
        this.x += dir.x * this.config.speed * 0.5 * dt;
        this.y += dir.y * this.config.speed * 0.5 * dt;
      } else {
        const dir = direction(this, this.targetPosition);
        this.x += -dir.y * this.config.speed * 0.6 * dt;
        this.y += dir.x * this.config.speed * 0.6 * dt;
      }

      const angle = angleBetween(this, this.targetPosition);
      const isDeltaWing = this.usingTexture && (this.config.type === 'suicideDrone' || this.config.type === 'jammerDrone');
      this.sprite.setRotation(isDeltaWing ? angle + Math.PI / 2 : angle);
    }

    this.sprite.setPosition(this.x, this.y);
    if (this.shadow) this.shadow.setPosition(this.x + 2, this.y + 2);
    this.healthBar.update(this.x, this.y, this.hp / this.config.hp);

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
  }

  destroy(): void {
    this.sprite.destroy();
    if (this.shadow) this.shadow.destroy();
    this.healthBar.destroy();
  }
}
