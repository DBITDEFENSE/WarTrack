import Phaser from 'phaser';
import { SpriteFactory } from '../utils/SpriteFactory.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0e1a);

    const loadText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'GENERATING ASSETS...',
      {
        fontSize: '16px',
        color: '#00ff88',
        fontFamily: 'monospace',
      }
    ).setOrigin(0.5);

    // Progress bar
    const barBg = this.add.rectangle(
      this.cameras.main.centerX, this.cameras.main.centerY + 30,
      200, 6, 0x1a3322
    );
    const barFill = this.add.rectangle(
      this.cameras.main.centerX - 100, this.cameras.main.centerY + 30,
      0, 6, 0x00ff88
    ).setOrigin(0, 0.5);

    // Generate all procedural textures
    this.time.delayedCall(100, () => {
      const factory = new SpriteFactory(this);
      factory.generateAll();

      // Animate bar fill
      this.tweens.add({
        targets: barFill,
        width: 200,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => {
          loadText.setText('READY');
          this.time.delayedCall(300, () => {
            this.scene.start('MainMenuScene');
          });
        },
      });
    });
  }
}
