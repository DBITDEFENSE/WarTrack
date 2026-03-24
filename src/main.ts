import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.ts';
import { MainMenuScene } from './scenes/MainMenuScene.ts';
import { MissionSelectScene } from './scenes/MissionSelectScene.ts';
import { GameScene } from './scenes/GameScene.ts';
import { UpgradeScene } from './scenes/UpgradeScene.ts';
import { GAME_WIDTH, GAME_HEIGHT } from './config/game.config.ts';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: document.body,
  backgroundColor: '#0a0e1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainMenuScene, MissionSelectScene, GameScene, UpgradeScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  input: {
    activePointers: 3, // Support multi-touch for joystick + buttons
  },
};

new Phaser.Game(config);
