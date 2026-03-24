import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, MISSION_CONFIGS } from '../config/game.config.ts';
import { SaveManager } from '../managers/SaveManager.ts';

const MODE_LABELS: Record<string, string> = {
  escort: 'ESCORT',
  defend: 'DEFEND',
  mineField: 'MINES',
  survive: 'SURVIVE',
  boss: 'BOSS',
  endless: 'ENDLESS',
};

const MODE_COLORS: Record<string, string> = {
  escort: '#44aa66',
  defend: '#44aaff',
  mineField: '#aaaa44',
  survive: '#ff8844',
  boss: '#ff4444',
  endless: '#aa44ff',
};

export class MissionSelectScene extends Phaser.Scene {
  private scrollY: number = 0;
  private contentHeight: number = 0;
  private scrollContainer!: Phaser.GameObjects.Container;

  constructor() {
    super('MissionSelectScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0e1a);
    const save = new SaveManager();
    const state = save.getState();
    this.scrollY = 0;

    // Title (fixed)
    this.add.text(GAME_WIDTH / 2, 50, 'SELECT MISSION', {
      fontSize: '40px', color: '#00ff88', fontFamily: 'monospace',
      stroke: '#003311', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);

    this.add.text(GAME_WIDTH - 40, 50, `Credits: ${state.credits}`, {
      fontSize: '22px', color: '#ffcc00', fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setDepth(100);

    this.scrollContainer = this.add.container(0, 0);

    const cardHeight = 160;
    const cardSpacing = 12;

    MISSION_CONFIGS.forEach((mission, index) => {
      const y = 110 + index * (cardHeight + cardSpacing);
      const unlocked = index <= state.highestUnlockedMission;
      const result = state.missionResults[mission.id];

      const cardColor = unlocked ? 0x1a2a3a : 0x111111;
      const card = this.add.rectangle(GAME_WIDTH / 2, y + cardHeight / 2, GAME_WIDTH - 80, cardHeight, cardColor, 0.8)
        .setStrokeStyle(2, unlocked ? 0x334455 : 0x222222);
      this.scrollContainer.add(card);

      const modeLabel = MODE_LABELS[mission.mode] || 'ESCORT';
      const modeColor = MODE_COLORS[mission.mode] || '#44aa66';
      const badge = this.add.text(80, y + 12, modeLabel, {
        fontSize: '16px', color: modeColor, fontFamily: 'monospace',
        backgroundColor: '#111111', padding: { x: 8, y: 4 },
      });
      this.scrollContainer.add(badge);

      const nameColor = unlocked ? '#ffffff' : '#444444';
      this.scrollContainer.add(this.add.text(80 + (modeLabel.length * 11 + 30), y + 12, mission.name, {
        fontSize: '28px', color: nameColor, fontFamily: 'monospace',
      }));

      this.scrollContainer.add(this.add.text(80, y + 50, mission.description, {
        fontSize: '18px', color: unlocked ? '#888888' : '#333333', fontFamily: 'monospace',
      }));

      const diffStr = '◆'.repeat(mission.difficulty) + '◇'.repeat(3 - mission.difficulty);
      this.scrollContainer.add(this.add.text(80, y + 82, `Diff: ${diffStr}  |  Reward: ${mission.baseReward}cr`, {
        fontSize: '16px', color: unlocked ? '#aa8844' : '#333333', fontFamily: 'monospace',
      }));

      if (mission.isBoss) {
        this.scrollContainer.add(this.add.text(80, y + 110, 'BOSS ENCOUNTER', {
          fontSize: '15px', color: '#ff4444', fontFamily: 'monospace',
        }));
      }

      if (result) {
        const stars = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
        this.scrollContainer.add(this.add.text(GAME_WIDTH - 90, y + 18, stars, {
          fontSize: '36px', color: '#ffcc00', fontFamily: 'serif',
        }).setOrigin(1, 0));
        this.scrollContainer.add(this.add.text(GAME_WIDTH - 90, y + 70, `${Math.floor(result.bestTime)}s`, {
          fontSize: '16px', color: '#666666', fontFamily: 'monospace',
        }).setOrigin(1, 0));
      } else if (unlocked) {
        this.scrollContainer.add(this.add.text(GAME_WIDTH - 90, y + 30, 'NEW', {
          fontSize: '22px', color: '#00ff88', fontFamily: 'monospace',
        }).setOrigin(1, 0));
      } else {
        this.scrollContainer.add(this.add.text(GAME_WIDTH - 90, y + 30, 'LOCKED', {
          fontSize: '22px', color: '#444444', fontFamily: 'monospace',
        }).setOrigin(1, 0));
      }

      if (unlocked) {
        card.setInteractive();
        card.on('pointerover', () => card.setFillStyle(0x2a3a4a));
        card.on('pointerout', () => card.setFillStyle(cardColor));
        card.on('pointerdown', () => {
          this.scene.start('GameScene', { missionIndex: index });
        });
      }
    });

    this.contentHeight = 110 + MISSION_CONFIGS.length * (cardHeight + cardSpacing) + 140;

    // Endless mode button
    const endlessY = 110 + MISSION_CONFIGS.length * (cardHeight + cardSpacing) + 16;
    const endlessCard = this.add.rectangle(GAME_WIDTH / 2, endlessY + 50, GAME_WIDTH - 80, 100, 0x1a1a2a, 0.8)
      .setStrokeStyle(2, 0x4422aa);
    this.scrollContainer.add(endlessCard);

    this.scrollContainer.add(this.add.text(GAME_WIDTH / 2, endlessY + 24, 'ENDLESS PATROL', {
      fontSize: '32px', color: '#aa44ff', fontFamily: 'monospace',
    }).setOrigin(0.5));

    const highScore = save.getEndlessHighScore();
    this.scrollContainer.add(this.add.text(GAME_WIDTH / 2, endlessY + 66, `High Score: ${highScore}`, {
      fontSize: '18px', color: '#8866aa', fontFamily: 'monospace',
    }).setOrigin(0.5));

    endlessCard.setInteractive();
    endlessCard.on('pointerover', () => endlessCard.setFillStyle(0x2a2a3a));
    endlessCard.on('pointerout', () => endlessCard.setFillStyle(0x1a1a2a));
    endlessCard.on('pointerdown', () => {
      this.scene.start('GameScene', { missionIndex: 0, endless: true });
    });

    // Scroll handling
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[], deltaY: number) => {
      this.scrollY = Phaser.Math.Clamp(
        this.scrollY + deltaY * 0.5,
        0,
        Math.max(0, this.contentHeight - GAME_HEIGHT + 100)
      );
      this.scrollContainer.y = -this.scrollY;
    });

    let dragStartY = 0;
    let startScrollY = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragStartY = p.y;
      startScrollY = this.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        const dy = dragStartY - p.y;
        if (Math.abs(dy) > 5) {
          this.scrollY = Phaser.Math.Clamp(
            startScrollY + dy,
            0,
            Math.max(0, this.contentHeight - GAME_HEIGHT + 100)
          );
          this.scrollContainer.y = -this.scrollY;
        }
      }
    });

    // Back button (fixed)
    const backBtn = this.add.text(60, GAME_HEIGHT - 50, '< BACK', {
      fontSize: '26px', color: '#888888', fontFamily: 'monospace',
    }).setInteractive().setDepth(100);

    backBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }
}
