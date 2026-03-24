import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/game.config.ts';
import type { Vector2 } from '../types/index.ts';

interface ThreatArrow {
  arrow: Phaser.GameObjects.Triangle;
  label: Phaser.GameObjects.Text;
}

const MAX_INDICATORS = 12;
const EDGE_MARGIN = 80;

/**
 * Directional arrows at screen edges for off-screen enemies. Scaled for 1920x1080.
 */
export class ThreatIndicator {
  private scene: Phaser.Scene;
  private arrows: ThreatArrow[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    for (let i = 0; i < MAX_INDICATORS; i++) {
      const arrow = scene.add.triangle(0, 0, 0, -14, 10, 10, -10, 10, COLORS.hudWarning, 1)
        .setDepth(1050)
        .setScrollFactor(0)
        .setVisible(false);
      const label = scene.add.text(0, 0, '', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1051).setVisible(false);
      this.arrows.push({ arrow, label });
    }
  }

  update(cameraX: number, cameraY: number, enemies: Array<{ x: number; y: number; alive: boolean; config: { type: string; color: number } }>): void {
    const screenLeft = cameraX;
    const screenRight = cameraX + GAME_WIDTH;
    const screenTop = cameraY;
    const screenBottom = cameraY + GAME_HEIGHT;

    const offScreen: typeof enemies = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.x < screenLeft - 20 || e.x > screenRight + 20 ||
          e.y < screenTop - 20 || e.y > screenBottom + 20) {
        offScreen.push(e);
      }
    }

    const cx = cameraX + GAME_WIDTH / 2;
    const cy = cameraY + GAME_HEIGHT / 2;
    offScreen.sort((a, b) => {
      const da = (a.x - cx) ** 2 + (a.y - cy) ** 2;
      const db = (b.x - cx) ** 2 + (b.y - cy) ** 2;
      return da - db;
    });

    for (let i = 0; i < MAX_INDICATORS; i++) {
      const indicator = this.arrows[i];
      if (i >= offScreen.length) {
        indicator.arrow.setVisible(false);
        indicator.label.setVisible(false);
        continue;
      }

      const enemy = offScreen[i];
      const dx = enemy.x - cx;
      const dy = enemy.y - cy;
      const angle = Math.atan2(dy, dx);

      const halfW = GAME_WIDTH / 2 - EDGE_MARGIN;
      const halfH = GAME_HEIGHT / 2 - EDGE_MARGIN;

      let edgeX: number, edgeY: number;
      const absSlope = Math.abs(dy / (dx || 0.001));
      if (absSlope > halfH / halfW) {
        edgeY = dy > 0 ? GAME_HEIGHT - EDGE_MARGIN : EDGE_MARGIN;
        edgeX = GAME_WIDTH / 2 + (dx / Math.abs(dy)) * (halfH);
        edgeX = Math.max(EDGE_MARGIN, Math.min(GAME_WIDTH - EDGE_MARGIN, edgeX));
      } else {
        edgeX = dx > 0 ? GAME_WIDTH - EDGE_MARGIN : EDGE_MARGIN;
        edgeY = GAME_HEIGHT / 2 + (dy / Math.abs(dx)) * (halfW);
        edgeY = Math.max(EDGE_MARGIN, Math.min(GAME_HEIGHT - EDGE_MARGIN, edgeY));
      }

      indicator.arrow.setPosition(edgeX, edgeY);
      indicator.arrow.setRotation(angle + Math.PI / 2);
      indicator.arrow.setFillStyle(enemy.config.color);
      indicator.arrow.setVisible(true);

      const dist = Math.floor(Math.sqrt(dx * dx + dy * dy));
      indicator.label.setPosition(edgeX, edgeY + 18);
      indicator.label.setText(`${dist}`);
      indicator.label.setVisible(true);

      if (dist < 600) {
        indicator.arrow.setAlpha(0.5 + Math.sin(this.scene.time.now / 100) * 0.5);
      } else {
        indicator.arrow.setAlpha(0.7);
      }
    }
  }

  destroy(): void {
    this.arrows.forEach(a => {
      a.arrow.destroy();
      a.label.destroy();
    });
  }
}
