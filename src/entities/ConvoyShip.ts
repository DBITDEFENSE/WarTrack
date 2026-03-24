import Phaser from 'phaser';
import type { ShipConfig, Vector2 } from '../types/index.ts';
import { HealthBar } from '../ui/HealthBar.ts';
import { getPointOnPath, getAngleOnPath } from '../utils/math.ts';

const SHIP_TEXTURE_MAP: Record<string, string> = {
  container: 'ship_container',
  tanker: 'ship_tanker',
  patrol: 'ship_patrol',
};

export class ConvoyShip {
  public sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  public config: ShipConfig;
  public hp: number;
  public maxHp: number;
  public pathProgress: number = 0;
  public alive: boolean = true;
  public x: number = 0;
  public y: number = 0;

  private healthBar: HealthBar;
  private path: Vector2[];
  private pathOffset: number;
  private shadow: Phaser.GameObjects.Ellipse | null = null;

  constructor(scene: Phaser.Scene, config: ShipConfig, path: Vector2[], pathOffset: number) {
    this.config = config;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.path = path;
    this.pathOffset = pathOffset;

    const texKey = SHIP_TEXTURE_MAP[config.type];
    if (texKey && scene.textures.exists(texKey)) {
      // Shadow
      this.shadow = scene.add.ellipse(0, 0, config.width * 0.9, config.height * 0.6, 0x000000, 0.2)
        .setDepth(299);
      this.sprite = scene.add.image(0, 0, texKey).setDepth(300);
    } else {
      this.sprite = scene.add.rectangle(0, 0, config.width, config.height, config.color, 1)
        .setDepth(300);
    }

    this.healthBar = new HealthBar(scene, config.width, 3, -(config.height / 2 + 8));
  }

  update(dt: number): void {
    if (!this.alive) return;

    const pathLength = this.estimatePathLength();
    this.pathProgress += (this.config.speed * dt) / pathLength;
    this.pathProgress = Math.min(this.pathProgress, 1);

    const pos = getPointOnPath(this.path, this.pathProgress);
    const angle = getAngleOnPath(this.path, this.pathProgress);
    this.x = pos.x;
    this.y = pos.y + this.pathOffset;
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setRotation(angle);

    if (this.shadow) {
      this.shadow.setPosition(this.x + 3, this.y + 3);
      this.shadow.setRotation(angle);
    }

    this.healthBar.update(this.x, this.y, this.hp / this.maxHp);
  }

  private estimatePathLength(): number {
    let length = 0;
    for (let i = 1; i < this.path.length; i++) {
      const dx = this.path[i].x - this.path[i - 1].x;
      const dy = this.path[i].y - this.path[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length || 1;
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.die();
    }
  }

  die(): void {
    this.alive = false;
    this.sprite.setAlpha(0.3);
    if (this.shadow) this.shadow.setAlpha(0.1);
    this.healthBar.setVisible(false);
  }

  updateStationary(): void {
    if (!this.alive) return;
    const pos = getPointOnPath(this.path, this.pathProgress);
    this.x = pos.x;
    this.y = pos.y + this.pathOffset;
    this.sprite.setPosition(this.x, this.y);
    if (this.shadow) this.shadow.setPosition(this.x + 3, this.y + 3);
    this.healthBar.update(this.x, this.y, this.hp / this.maxHp);
  }

  hasReachedEnd(): boolean {
    return this.pathProgress >= 1;
  }

  destroy(): void {
    this.sprite.destroy();
    if (this.shadow) this.shadow.destroy();
    this.healthBar.destroy();
  }
}
