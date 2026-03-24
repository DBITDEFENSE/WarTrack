import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, UPGRADE_CONFIGS, SUPPORT_UNLOCK_COSTS } from '../config/game.config.ts';
import { SUPPORT_CONFIGS } from '../entities/SupportAsset.ts';
import { SaveManager } from '../managers/SaveManager.ts';
import type { UpgradeTrack } from '../types/index.ts';

export class UpgradeScene extends Phaser.Scene {
  private save!: SaveManager;
  private creditsText!: Phaser.GameObjects.Text;
  private cards: Array<{
    track: UpgradeTrack;
    levelText: Phaser.GameObjects.Text;
    costText: Phaser.GameObjects.Text;
    btn: Phaser.GameObjects.Text;
    effectText: Phaser.GameObjects.Text;
  }> = [];
  private supportCards: Array<{
    type: string;
    statusText: Phaser.GameObjects.Text;
    btn: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('UpgradeScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0e1a);
    this.save = new SaveManager();
    this.cards = [];
    this.supportCards = [];

    // Title
    this.add.text(GAME_WIDTH / 2, 45, 'UPGRADES', {
      fontSize: '42px', color: '#44aaff', fontFamily: 'monospace',
      stroke: '#001133', strokeThickness: 4,
    }).setOrigin(0.5);

    this.creditsText = this.add.text(GAME_WIDTH / 2, 95, '', {
      fontSize: '24px', color: '#ffcc00', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Apache upgrade cards
    this.add.text(60, 140, 'APACHE SYSTEMS', {
      fontSize: '18px', color: '#668888', fontFamily: 'monospace',
    });

    UPGRADE_CONFIGS.forEach((config, i) => {
      const y = 170 + i * 140;
      this.createUpgradeCard(config.track, config.name, config.description, y, i);
    });

    // Support assets section
    const supportY = 170 + UPGRADE_CONFIGS.length * 140 + 20;
    this.add.text(60, supportY, 'SUPPORT ASSETS', {
      fontSize: '18px', color: '#668888', fontFamily: 'monospace',
    });

    const supportTypes = Object.entries(SUPPORT_CONFIGS);
    supportTypes.forEach(([type, config], i) => {
      const y = supportY + 36 + i * 100;
      this.createSupportCard(type, config.name, y);
    });

    // Back button
    const backBtn = this.add.text(60, GAME_HEIGHT - 50, '< BACK', {
      fontSize: '26px', color: '#888888', fontFamily: 'monospace',
    }).setInteractive();
    backBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));

    this.refreshAll();
  }

  private createUpgradeCard(track: UpgradeTrack, name: string, desc: string, y: number, configIndex: number): void {
    this.add.rectangle(GAME_WIDTH / 2, y + 48, GAME_WIDTH - 100, 120, 0x1a2a3a, 0.6)
      .setStrokeStyle(1, 0x334455);

    this.add.text(80, y, name, { fontSize: '26px', color: '#ffffff', fontFamily: 'monospace' });
    this.add.text(80, y + 34, desc, { fontSize: '16px', color: '#888888', fontFamily: 'monospace' });

    const levelText = this.add.text(80, y + 60, '', { fontSize: '16px', color: '#44aaff', fontFamily: 'monospace' });
    const effectText = this.add.text(80, y + 82, '', { fontSize: '16px', color: '#66cc88', fontFamily: 'monospace' });
    const costText = this.add.text(GAME_WIDTH - 320, y + 24, '', { fontSize: '20px', color: '#ffcc00', fontFamily: 'monospace' });
    const btn = this.add.text(GAME_WIDTH - 140, y + 66, '', {
      fontSize: '22px', color: '#00ff88', fontFamily: 'monospace',
      backgroundColor: '#1a3322', padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setInteractive();

    btn.on('pointerdown', () => this.tryUpgrade(track, configIndex));
    this.cards.push({ track, levelText, costText, btn, effectText });
  }

  private createSupportCard(type: string, name: string, y: number): void {
    this.add.rectangle(GAME_WIDTH / 2, y + 32, GAME_WIDTH - 100, 80, 0x1a2a2a, 0.6)
      .setStrokeStyle(1, 0x334455);

    this.add.text(80, y, name, { fontSize: '24px', color: '#ffffff', fontFamily: 'monospace' });

    const cost = SUPPORT_UNLOCK_COSTS[type] || 500;
    const statusText = this.add.text(80, y + 36, '', { fontSize: '16px', color: '#888888', fontFamily: 'monospace' });
    const btn = this.add.text(GAME_WIDTH - 140, y + 28, '', {
      fontSize: '20px', color: '#00ff88', fontFamily: 'monospace',
      backgroundColor: '#1a3322', padding: { x: 16, y: 6 },
    }).setOrigin(0.5).setInteractive();

    btn.on('pointerdown', () => {
      if (!this.save.isSupportUnlocked(type) && this.save.spendCredits(cost)) {
        this.save.unlockSupport(type);
        this.refreshAll();
      }
    });

    this.supportCards.push({ type, statusText, btn });
  }

  private tryUpgrade(track: UpgradeTrack, configIndex: number): void {
    const currentLevel = this.save.getUpgradeLevel(track);
    const config = UPGRADE_CONFIGS[configIndex];
    if (currentLevel >= config.levels.length) return;
    const cost = config.levels[currentLevel].cost;
    if (this.save.spendCredits(cost)) {
      this.save.setUpgradeLevel(track, currentLevel + 1);
      this.refreshAll();
    }
  }

  private refreshAll(): void {
    const state = this.save.getState();
    this.creditsText.setText(`Credits: ${state.credits}`);

    this.cards.forEach((card, i) => {
      const config = UPGRADE_CONFIGS[i];
      const level = state.upgrades[card.track];
      const maxLevel = config.levels.length;
      const maxed = level >= maxLevel;

      const pips = '■'.repeat(level) + '□'.repeat(maxLevel - level);
      card.levelText.setText(`Lv ${level}/${maxLevel}  ${pips}`);

      if (level > 0) {
        const effect = config.levels[level - 1].effect;
        if (card.track === 'rockets') card.effectText.setText(`${effect} rockets`);
        else if (card.track === 'armor') card.effectText.setText(`${effect} HP`);
        else card.effectText.setText(`${Math.round(effect * 100)}% base`);
      } else {
        card.effectText.setText('Not upgraded');
      }

      if (maxed) {
        card.costText.setText('');
        card.btn.setText('MAX');
        card.btn.setColor('#666666');
        card.btn.setBackgroundColor('#222222');
      } else {
        const cost = config.levels[level].cost;
        card.costText.setText(`${cost}cr`);
        const canAfford = state.credits >= cost;
        card.btn.setText('BUY');
        card.btn.setColor(canAfford ? '#00ff88' : '#664444');
        card.btn.setBackgroundColor(canAfford ? '#1a3322' : '#221111');
      }
    });

    this.supportCards.forEach(card => {
      const unlocked = this.save.isSupportUnlocked(card.type);
      const cost = SUPPORT_UNLOCK_COSTS[card.type] || 500;
      if (unlocked) {
        card.statusText.setText('DEPLOYED — Active in missions');
        card.statusText.setColor('#66cc88');
        card.btn.setText('ACTIVE');
        card.btn.setColor('#666666');
        card.btn.setBackgroundColor('#222222');
      } else {
        card.statusText.setText(`Unlock for ${cost}cr`);
        card.statusText.setColor('#888888');
        const canAfford = state.credits >= cost;
        card.btn.setText('UNLOCK');
        card.btn.setColor(canAfford ? '#00ff88' : '#664444');
        card.btn.setBackgroundColor(canAfford ? '#1a3322' : '#221111');
      }
    });
  }
}
