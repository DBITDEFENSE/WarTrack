import Phaser from 'phaser';
import { COLORS } from '../config/game.config.ts';

/**
 * Simple health bar that follows a game object.
 */
export class HealthBar {
  private bg: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private width: number;
  private height: number;
  private offsetY: number;

  constructor(scene: Phaser.Scene, width: number, height: number = 4, offsetY: number = -20) {
    this.width = width;
    this.height = height;
    this.offsetY = offsetY;

    this.bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.5)
      .setDepth(500)
      .setOrigin(0.5, 0.5);

    this.fill = scene.add.rectangle(0, 0, width, height, COLORS.healthGreen, 1)
      .setDepth(501)
      .setOrigin(0, 0.5);
  }

  update(x: number, y: number, hpPercent: number): void {
    const barY = y + this.offsetY;
    this.bg.setPosition(x, barY);
    this.fill.setPosition(x - this.width / 2, barY);
    this.fill.width = this.width * Math.max(0, hpPercent);

    if (hpPercent > 0.6) {
      this.fill.setFillStyle(COLORS.healthGreen);
    } else if (hpPercent > 0.3) {
      this.fill.setFillStyle(COLORS.healthYellow);
    } else {
      this.fill.setFillStyle(COLORS.healthRed);
    }
  }

  setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.fill.setVisible(visible);
  }

  destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
  }
}
