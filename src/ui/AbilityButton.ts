import Phaser from 'phaser';

/**
 * Cooldown-based ability button for the HUD. Scaled for 1920x1080.
 */
export class AbilityButton {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Arc;
  private icon: Phaser.GameObjects.Text;
  private cooldownOverlay: Phaser.GameObjects.Arc;
  private countText: Phaser.GameObjects.Text;

  private cooldownTotal: number;
  private cooldownRemaining: number = 0;
  private uses: number = -1;

  public onActivate: (() => boolean) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    cooldown: number,
    maxUses: number = -1
  ) {
    this.scene = scene;
    this.cooldownTotal = cooldown;
    this.uses = maxUses;

    this.bg = scene.add.circle(x, y, 48, 0x334455, 0.6)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive();

    this.icon = scene.add.text(x, y, label, {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

    this.cooldownOverlay = scene.add.circle(x, y, 48, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.countText = scene.add.text(x + 28, y + 28, '', {
      fontSize: '18px',
      color: '#ffcc00',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

    this.bg.on('pointerdown', () => this.tryActivate());
    this.updateCountDisplay();
  }

  tryActivate(): boolean {
    if (this.cooldownRemaining > 0) return false;
    if (this.uses === 0) return false;
    if (this.onActivate && !this.onActivate()) return false;
    if (this.uses > 0) this.uses--;
    this.cooldownRemaining = this.cooldownTotal;
    this.updateCountDisplay();
    return true;
  }

  update(dt: number): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
      const pct = this.cooldownRemaining / this.cooldownTotal;
      this.cooldownOverlay.setAlpha(pct * 0.6);
      this.bg.setAlpha(0.3);
    } else {
      this.cooldownOverlay.setAlpha(0);
      this.bg.setAlpha(this.uses === 0 ? 0.2 : 0.6);
    }
  }

  private updateCountDisplay(): void {
    if (this.uses >= 0) {
      this.countText.setText(`${this.uses}`);
    }
  }

  setUses(n: number): void {
    this.uses = n;
    this.updateCountDisplay();
  }

  getUses(): number {
    return this.uses;
  }

  isReady(): boolean {
    return this.cooldownRemaining <= 0 && this.uses !== 0;
  }

  destroy(): void {
    this.bg.destroy();
    this.icon.destroy();
    this.cooldownOverlay.destroy();
    this.countText.destroy();
  }
}
