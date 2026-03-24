import Phaser from 'phaser';
import type { Vector2 } from '../types/index.ts';
import { distance, direction, angleBetween } from '../utils/math.ts';

export type SupportType = 'escort' | 'ciws' | 'recon';

export interface SupportConfig {
  type: SupportType;
  name: string;
  color: number;
  range: number;
  fireRate: number;
  damage: number;
  width: number;
  height: number;
}

const SUPPORT_TEXTURE_MAP: Record<string, string> = {
  escort: 'support_escort',
  ciws: 'support_ciws',
  recon: 'support_recon',
};

export const SUPPORT_CONFIGS: Record<SupportType, SupportConfig> = {
  escort: {
    type: 'escort',
    name: 'Navy Escort',
    color: 0x6688aa,
    range: 480,
    fireRate: 1.0,
    damage: 12,
    width: 96,
    height: 34,
  },
  ciws: {
    type: 'ciws',
    name: 'CIWS Defense',
    color: 0x88aa66,
    range: 384,
    fireRate: 8.0,
    damage: 5,
    width: 72,
    height: 29,
  },
  recon: {
    type: 'recon',
    name: 'Recon Drone',
    color: 0xaaaa44,
    range: 840,
    fireRate: 0,
    damage: 0,
    width: 29,
    height: 29,
  },
};

export class SupportAsset {
  public sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  public config: SupportConfig;
  public x: number;
  public y: number;
  public active: boolean = true;
  public fireCooldown: number = 0;
  public targetId: string | null = null;

  private scene: Phaser.Scene;
  private rangeCircle: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private shadow: Phaser.GameObjects.Ellipse | null = null;

  constructor(scene: Phaser.Scene, config: SupportConfig, x: number, y: number) {
    this.scene = scene;
    this.config = config;
    this.x = x;
    this.y = y;

    const texKey = SUPPORT_TEXTURE_MAP[config.type];
    if (texKey && scene.textures.exists(texKey)) {
      this.shadow = scene.add.ellipse(x + 2, y + 2, config.width * 0.8, config.height * 0.6, 0x000000, 0.2)
        .setDepth(309);
      this.sprite = scene.add.image(x, y, texKey).setDepth(310);
    } else {
      this.sprite = scene.add.rectangle(x, y, config.width, config.height, config.color, 0.9)
        .setDepth(310);
    }

    this.rangeCircle = scene.add.circle(x, y, config.range, config.color, 0.03)
      .setDepth(100)
      .setStrokeStyle(1, config.color, 0.1);

    this.label = scene.add.text(x, y - config.height - 6, config.name, {
      fontSize: '8px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(311);
  }

  followPosition(targetX: number, targetY: number, offsetX: number, offsetY: number, dt: number): void {
    const goalX = targetX + offsetX;
    const goalY = targetY + offsetY;
    this.x += (goalX - this.x) * 3 * dt;
    this.y += (goalY - this.y) * 3 * dt;
    this.sprite.setPosition(this.x, this.y);
    if (this.shadow) this.shadow.setPosition(this.x + 2, this.y + 2);
    this.rangeCircle.setPosition(this.x, this.y);
    this.label.setPosition(this.x, this.y - this.config.height - 6);
  }

  findTarget(enemies: Array<{ x: number; y: number; alive: boolean; id: string; config: { type: string } }>, dt: number): { targetX: number; targetY: number; damage: number } | null {
    if (this.config.fireRate <= 0) return null;

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.fireCooldown > 0) return null;

    let nearest: typeof enemies[0] | null = null;
    let nearestDist = this.config.range;

    const priorityTypes = this.config.type === 'ciws' ? ['suicideDrone', 'droneBoat'] : [];

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const d = distance(this, enemy);
      if (d >= this.config.range) continue;

      if (priorityTypes.includes(enemy.config.type)) {
        nearest = enemy;
        nearestDist = d;
        break;
      }
      if (d < nearestDist) {
        nearest = enemy;
        nearestDist = d;
      }
    }

    if (!nearest) return null;

    this.fireCooldown = 1 / this.config.fireRate;
    this.targetId = nearest.id;

    const angle = angleBetween(this, nearest);
    this.sprite.setRotation(angle);

    return {
      targetX: nearest.x,
      targetY: nearest.y,
      damage: this.config.damage,
    };
  }

  getDetectionRange(): number {
    if (this.config.type === 'recon') return this.config.range;
    return 0;
  }

  destroy(): void {
    this.sprite.destroy();
    if (this.shadow) this.shadow.destroy();
    this.rangeCircle.destroy();
    this.label.destroy();
  }
}
