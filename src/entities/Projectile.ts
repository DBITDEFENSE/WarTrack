import Phaser from 'phaser';
import type { ProjectileType } from '../types/index.ts';
// Note: 'missile' type added in types — functions identically to enemyBullet but
// with different visuals (larger, colored) handled at fire() call site

export class Projectile {
  public sprite: Phaser.GameObjects.Rectangle;
  public type: ProjectileType;
  public damage: number;
  public speed: number;
  public range: number;
  public dirX: number = 0;
  public dirY: number = 0;
  public startX: number = 0;
  public startY: number = 0;
  public active: boolean = false;
  public fromPlayer: boolean = true;

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.rectangle(0, 0, 4, 4, 0xffdd44)
      .setDepth(400)
      .setVisible(false);
    this.type = 'autocannon';
    this.damage = 0;
    this.speed = 0;
    this.range = 0;
  }

  fire(x: number, y: number, dirX: number, dirY: number, type: ProjectileType, damage: number, speed: number, range: number, color: number, size: number, fromPlayer: boolean): void {
    this.sprite.setPosition(x, y);
    this.sprite.setSize(size, size);
    this.sprite.setFillStyle(color);
    this.sprite.setVisible(true);
    this.startX = x;
    this.startY = y;
    this.dirX = dirX;
    this.dirY = dirY;
    this.type = type;
    this.damage = damage;
    this.speed = speed;
    this.range = range;
    this.active = true;
    this.fromPlayer = fromPlayer;
  }

  update(dt: number): void {
    if (!this.active) return;

    this.sprite.x += this.dirX * this.speed * dt;
    this.sprite.y += this.dirY * this.speed * dt;

    // Check range
    const dx = this.sprite.x - this.startX;
    const dy = this.sprite.y - this.startY;
    if (dx * dx + dy * dy > this.range * this.range) {
      this.deactivate();
    }
  }

  deactivate(): void {
    this.active = false;
    this.sprite.setVisible(false);
    this.sprite.setPosition(-1000, -1000);
  }
}
