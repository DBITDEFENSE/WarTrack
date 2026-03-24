import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/game.config.ts';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0e1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 220, 'APACHE', {
      fontSize: '96px',
      color: '#00ff88',
      fontFamily: 'monospace',
      stroke: '#003311',
      strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 320, 'STRAIT RUNNER', {
      fontSize: '52px',
      color: '#44aa66',
      fontFamily: 'monospace',
      stroke: '#002211',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(GAME_WIDTH / 2, 400, 'Defend the Convoy. Control the Strait.', {
      fontSize: '24px',
      color: '#668877',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Play button
    const playBtn = this.add.text(GAME_WIDTH / 2, 560, '[ START MISSION ]', {
      fontSize: '38px',
      color: '#00ff88',
      fontFamily: 'monospace',
      backgroundColor: '#1a3322',
      padding: { x: 50, y: 22 },
    }).setOrigin(0.5).setInteractive();

    playBtn.on('pointerover', () => playBtn.setColor('#44ffaa'));
    playBtn.on('pointerout', () => playBtn.setColor('#00ff88'));
    playBtn.on('pointerdown', () => {
      this.scene.start('MissionSelectScene');
    });

    // Upgrades button
    const upgradeBtn = this.add.text(GAME_WIDTH / 2, 660, '[ UPGRADES ]', {
      fontSize: '30px',
      color: '#44aaff',
      fontFamily: 'monospace',
      backgroundColor: '#1a2233',
      padding: { x: 40, y: 16 },
    }).setOrigin(0.5).setInteractive();

    upgradeBtn.on('pointerover', () => upgradeBtn.setColor('#88ccff'));
    upgradeBtn.on('pointerout', () => upgradeBtn.setColor('#44aaff'));
    upgradeBtn.on('pointerdown', () => {
      this.scene.start('UpgradeScene');
    });

    // WarTrack button
    const wartrackBtn = this.add.text(GAME_WIDTH / 2, 750, '[ WARTRACK ]', {
      fontSize: '30px',
      color: '#ffaa00',
      fontFamily: 'monospace',
      backgroundColor: '#2a2210',
      padding: { x: 40, y: 16 },
    }).setOrigin(0.5).setInteractive();

    wartrackBtn.on('pointerover', () => wartrackBtn.setColor('#ffcc44'));
    wartrackBtn.on('pointerout', () => wartrackBtn.setColor('#ffaa00'));
    wartrackBtn.on('pointerdown', () => {
      // Switch to WarTrack DOM overlay
      if (typeof (window as any).showWarTrack === 'function') {
        (window as any).showWarTrack();
      }
    });

    this.add.text(GAME_WIDTH / 2, 800, 'Global Situational Awareness', {
      fontSize: '14px',
      color: '#665522',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Version
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, 'v0.4 — WarTrack Integration', {
      fontSize: '16px',
      color: '#334444',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Decorative: animated scan line
    const scanLine = this.add.rectangle(GAME_WIDTH / 2, 0, GAME_WIDTH, 3, 0x00ff88, 0.1);
    this.tweens.add({
      targets: scanLine,
      y: GAME_HEIGHT,
      duration: 3000,
      repeat: -1,
    });
  }
}
