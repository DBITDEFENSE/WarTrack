import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT } from '../config/game.config.ts';
import type { Vector2 } from '../types/index.ts';

const MAP_WIDTH = 320;
const MAP_HEIGHT = 80;
const MAP_X = GAME_WIDTH - MAP_WIDTH - 20;
const MAP_Y = 80;

/**
 * Tactical minimap in top-right corner. Scaled for 1920x1080.
 */
export class MiniMap {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle;
  private viewRect: Phaser.GameObjects.Rectangle;
  private dots: Phaser.GameObjects.Rectangle[] = [];
  private maxDots = 60;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.bg = scene.add.rectangle(MAP_X + MAP_WIDTH / 2, MAP_Y + MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT, 0x0a1a2a, 0.7)
      .setScrollFactor(0).setDepth(1060);

    this.border = scene.add.rectangle(MAP_X + MAP_WIDTH / 2, MAP_Y + MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT)
      .setStrokeStyle(2, 0x334455, 0.8)
      .setFillStyle(0x000000, 0)
      .setScrollFactor(0).setDepth(1061);

    this.viewRect = scene.add.rectangle(0, 0, 10, 5)
      .setStrokeStyle(1, 0x00ff88, 0.5)
      .setFillStyle(0x000000, 0)
      .setScrollFactor(0).setDepth(1062);

    for (let i = 0; i < this.maxDots; i++) {
      const dot = scene.add.rectangle(0, 0, 4, 4, 0xffffff, 1)
        .setScrollFactor(0).setDepth(1063).setVisible(false);
      this.dots.push(dot);
    }
  }

  private worldToMap(wx: number, wy: number): { x: number; y: number } {
    return {
      x: MAP_X + (wx / WORLD_WIDTH) * MAP_WIDTH,
      y: MAP_Y + (wy / WORLD_HEIGHT) * MAP_HEIGHT,
    };
  }

  update(
    cameraX: number,
    cameraY: number,
    player: Vector2,
    ships: Array<{ x: number; y: number; alive: boolean }>,
    enemies: Array<{ x: number; y: number; alive: boolean; config: { color: number } }>
  ): void {
    const vp = this.worldToMap(cameraX, cameraY);
    const vpW = (GAME_WIDTH / WORLD_WIDTH) * MAP_WIDTH;
    const vpH = (GAME_HEIGHT / WORLD_HEIGHT) * MAP_HEIGHT;
    this.viewRect.setPosition(vp.x + vpW / 2, vp.y + vpH / 2);
    this.viewRect.setSize(vpW, vpH);

    let dotIndex = 0;

    if (dotIndex < this.maxDots) {
      const pp = this.worldToMap(player.x, player.y);
      this.dots[dotIndex].setPosition(pp.x, pp.y).setFillStyle(0x00ff88).setSize(5, 5).setVisible(true);
      dotIndex++;
    }

    for (const ship of ships) {
      if (dotIndex >= this.maxDots) break;
      if (!ship.alive) continue;
      const sp = this.worldToMap(ship.x, ship.y);
      this.dots[dotIndex].setPosition(sp.x, sp.y).setFillStyle(0x4488cc).setSize(6, 3).setVisible(true);
      dotIndex++;
    }

    for (const enemy of enemies) {
      if (dotIndex >= this.maxDots) break;
      if (!enemy.alive) continue;
      const ep = this.worldToMap(enemy.x, enemy.y);
      this.dots[dotIndex].setPosition(ep.x, ep.y).setFillStyle(enemy.config.color).setSize(3, 3).setVisible(true);
      dotIndex++;
    }

    for (let i = dotIndex; i < this.maxDots; i++) {
      this.dots[i].setVisible(false);
    }
  }

  destroy(): void {
    this.bg.destroy();
    this.border.destroy();
    this.viewRect.destroy();
    this.dots.forEach(d => d.destroy());
  }
}
