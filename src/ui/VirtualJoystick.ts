import Phaser from 'phaser';

/**
 * Mobile-friendly virtual joystick. Scaled for 1920x1080.
 */
export class VirtualJoystick {
  private scene: Phaser.Scene;
  private base: Phaser.GameObjects.Arc;
  private stick: Phaser.GameObjects.Arc;
  private pointer: Phaser.Input.Pointer | null = null;

  public forceX: number = 0;
  public forceY: number = 0;
  public isActive: boolean = false;

  private baseX: number;
  private baseY: number;
  private radius: number = 100;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.baseX = x;
    this.baseY = y;

    this.base = scene.add.circle(x, y, this.radius, 0x334455, 0.3)
      .setScrollFactor(0)
      .setDepth(1000);

    this.stick = scene.add.circle(x, y, 40, 0x88aacc, 0.6)
      .setScrollFactor(0)
      .setDepth(1001);

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < scene.cameras.main.width * 0.4 && !this.pointer) {
        this.pointer = pointer;
        this.isActive = true;
        this.base.setPosition(pointer.x, pointer.y);
        this.baseX = pointer.x;
        this.baseY = pointer.y;
        this.base.setAlpha(0.5);
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.pointer && pointer.id === this.pointer.id) {
        this.updateStick(pointer.x, pointer.y);
      }
    });

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.pointer && pointer.id === this.pointer.id) {
        this.resetStick();
      }
    });
  }

  private updateStick(px: number, py: number): void {
    const dx = px - this.baseX;
    const dy = py - this.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.radius) {
      this.forceX = dx / dist;
      this.forceY = dy / dist;
      this.stick.setPosition(
        this.baseX + this.forceX * this.radius,
        this.baseY + this.forceY * this.radius
      );
    } else {
      this.forceX = dx / this.radius;
      this.forceY = dy / this.radius;
      this.stick.setPosition(px, py);
    }
  }

  private resetStick(): void {
    this.pointer = null;
    this.isActive = false;
    this.forceX = 0;
    this.forceY = 0;
    this.stick.setPosition(this.baseX, this.baseY);
    this.base.setAlpha(0.3);
  }

  getKeyboardForce(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key }): { x: number; y: number } {
    let kx = 0, ky = 0;
    if (cursors.left.isDown || wasd.A.isDown) kx -= 1;
    if (cursors.right.isDown || wasd.D.isDown) kx += 1;
    if (cursors.up.isDown || wasd.W.isDown) ky -= 1;
    if (cursors.down.isDown || wasd.S.isDown) ky += 1;
    if (kx !== 0 && ky !== 0) {
      const inv = 1 / Math.SQRT2;
      kx *= inv;
      ky *= inv;
    }
    return { x: kx, y: ky };
  }

  destroy(): void {
    this.base.destroy();
    this.stick.destroy();
  }
}
