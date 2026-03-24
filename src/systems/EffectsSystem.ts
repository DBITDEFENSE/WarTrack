import Phaser from 'phaser';
import { COLORS } from '../config/game.config.ts';

/**
 * Handles all visual effects: explosions, trails, wakes, debris, screen flash.
 * Enhanced with multi-layer explosions, dynamic wakes, and particle effects.
 */
export class EffectsSystem {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (!scene.textures.exists('particle')) {
      const gfx = scene.add.graphics();
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(0, 0, 4, 4);
      gfx.generateTexture('particle', 4, 4);
      gfx.destroy();
    }
  }

  /** Multi-layer explosion with shockwave ring, fire core, and debris */
  explosion(x: number, y: number, size: number = 20, color: number = COLORS.explosion): void {
    // Shockwave ring
    const ring = this.scene.add.circle(x, y, 4, color, 0.8).setDepth(800);
    this.scene.tweens.add({
      targets: ring,
      radius: size * 1.2,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Secondary ring (delayed)
    this.scene.time.delayedCall(50, () => {
      const ring2 = this.scene.add.circle(x, y, 3, COLORS.explosionInner, 0.6).setDepth(801);
      this.scene.tweens.add({
        targets: ring2,
        radius: size * 0.8,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => ring2.destroy(),
      });
    });

    // Fire core with hot center
    const core = this.scene.add.circle(x, y, 3, 0xffee88, 1).setDepth(802);
    this.scene.tweens.add({
      targets: core,
      radius: size * 0.5,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => core.destroy(),
    });

    // Smoke puffs (darker, longer lasting)
    const smokeCount = Math.min(Math.floor(size / 6), 6);
    for (let i = 0; i < smokeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = size * 0.3 + Math.random() * size * 0.4;
      this.scene.time.delayedCall(100 + i * 40, () => {
        const smoke = this.scene.add.circle(
          x + Math.cos(angle) * dist * 0.3,
          y + Math.sin(angle) * dist * 0.3,
          3 + Math.random() * 4,
          0x333333,
          0.5
        ).setDepth(798);
        this.scene.tweens.add({
          targets: smoke,
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist - 10,
          radius: 8 + Math.random() * 6,
          alpha: 0,
          duration: 500 + Math.random() * 300,
          ease: 'Quad.easeOut',
          onComplete: () => smoke.destroy(),
        });
      });
    }

    // Flying debris
    const debrisCount = Math.min(Math.floor(size / 4), 12);
    for (let i = 0; i < debrisCount; i++) {
      const angle = (Math.PI * 2 * i) / debrisCount + Math.random() * 0.5;
      const speed = 40 + Math.random() * 80;
      const debrisColor = Math.random() > 0.5 ? color :
        Math.random() > 0.5 ? COLORS.explosionInner : 0x666666;
      const debris = this.scene.add.rectangle(
        x, y,
        2 + Math.random() * 3,
        1 + Math.random() * 2,
        debrisColor, 1
      ).setDepth(799).setRotation(Math.random() * Math.PI);

      this.scene.tweens.add({
        targets: debris,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        angle: Math.random() * 720 - 360,
        duration: 300 + Math.random() * 200,
        ease: 'Quad.easeOut',
        onComplete: () => debris.destroy(),
      });
    }

    // Screen flash for large explosions
    if (size >= 30) {
      const cam = this.scene.cameras.main;
      const screenFlash = this.scene.add.rectangle(
        cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2,
        cam.width, cam.height, 0xffffff, 0.2
      ).setDepth(900).setScrollFactor(0);
      this.scene.tweens.add({
        targets: screenFlash,
        alpha: 0,
        duration: 150,
        onComplete: () => screenFlash.destroy(),
      });
    }
  }

  /** Ship destruction: multi-stage explosion + smoke column + oil fire */
  shipDestruction(x: number, y: number, width: number): void {
    this.explosion(x, y, 50, COLORS.explosion);
    this.scene.time.delayedCall(120, () => this.explosion(x + 15, y - 10, 30, COLORS.explosionInner));
    this.scene.time.delayedCall(250, () => this.explosion(x - 20, y + 8, 35, 0x555555));
    this.scene.time.delayedCall(400, () => this.explosion(x + 8, y + 12, 20, 0x333333));

    // Rising smoke column
    for (let i = 0; i < 8; i++) {
      this.scene.time.delayedCall(i * 80, () => {
        const smoke = this.scene.add.circle(
          x + (Math.random() - 0.5) * width * 0.5,
          y,
          3 + Math.random() * 5,
          i < 3 ? 0x444444 : 0x222222,
          0.6
        ).setDepth(810);
        this.scene.tweens.add({
          targets: smoke,
          y: y - 50 - Math.random() * 40,
          radius: 14 + Math.random() * 10,
          alpha: 0,
          duration: 1000 + Math.random() * 500,
          onComplete: () => smoke.destroy(),
        });
      });
    }

    // Oil fire on water (larger, more vivid)
    const fire = this.scene.add.ellipse(x, y, width * 0.9, 14, 0xff4400, 0.5).setDepth(200);
    this.scene.tweens.add({
      targets: fire,
      alpha: 0,
      scaleX: 1.4,
      duration: 4000,
      onComplete: () => fire.destroy(),
    });

    // Fire flicker
    for (let i = 0; i < 5; i++) {
      this.scene.time.delayedCall(i * 300, () => {
        const flicker = this.scene.add.circle(
          x + (Math.random() - 0.5) * width * 0.4,
          y + (Math.random() - 0.5) * 8,
          2 + Math.random() * 3,
          Math.random() > 0.5 ? 0xff6600 : 0xffaa00,
          0.6
        ).setDepth(201);
        this.scene.tweens.add({
          targets: flicker,
          y: flicker.y - 8,
          alpha: 0,
          duration: 200 + Math.random() * 200,
          onComplete: () => flicker.destroy(),
        });
      });
    }
  }

  /** Tracer trail with glow */
  tracerTrail(x: number, y: number, color: number = COLORS.playerTracer): void {
    const t = this.scene.add.rectangle(x, y, 4, 2, color, 0.6).setDepth(390);
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      scaleX: 0.2,
      duration: 100,
      onComplete: () => t.destroy(),
    });
    // Subtle glow
    const glow = this.scene.add.circle(x, y, 3, color, 0.15).setDepth(389);
    this.scene.tweens.add({
      targets: glow,
      alpha: 0,
      radius: 1,
      duration: 80,
      onComplete: () => glow.destroy(),
    });
  }

  /** Rocket smoke trail with fire core */
  rocketTrail(x: number, y: number): void {
    const smoke = this.scene.add.circle(x, y, 2, 0x888888, 0.4).setDepth(385);
    this.scene.tweens.add({
      targets: smoke,
      radius: 6,
      alpha: 0,
      duration: 350,
      onComplete: () => smoke.destroy(),
    });
    const fire = this.scene.add.circle(x, y, 2, COLORS.rocketTrail, 0.8).setDepth(386);
    this.scene.tweens.add({
      targets: fire,
      alpha: 0,
      radius: 1,
      duration: 120,
      onComplete: () => fire.destroy(),
    });
    // Sparks
    if (Math.random() > 0.6) {
      const spark = this.scene.add.rectangle(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 1, 1, 0xffcc00, 0.8).setDepth(387);
      this.scene.tweens.add({
        targets: spark,
        alpha: 0,
        duration: 80,
        onComplete: () => spark.destroy(),
      });
    }
  }

  /** Water wake with V-shaped bow wave */
  shipWake(x: number, y: number, width: number, speed: number): void {
    if (Math.random() > 0.3) return;
    const wakeLength = Math.min(speed * 0.5, 30);

    // Main wake trail
    const wake = this.scene.add.ellipse(
      x - width * 0.6, y,
      wakeLength, 4 + Math.random() * 3,
      0x4488aa, 0.15
    ).setDepth(100);
    this.scene.tweens.add({
      targets: wake,
      alpha: 0,
      scaleX: 1.6,
      scaleY: 2.2,
      x: x - width - wakeLength,
      duration: 700,
      onComplete: () => wake.destroy(),
    });

    // Bow spray (V-shape)
    if (Math.random() > 0.5) {
      for (let side = -1; side <= 1; side += 2) {
        const spray = this.scene.add.ellipse(
          x + width * 0.4,
          y + side * 4,
          4, 2,
          0x88bbdd, 0.2
        ).setDepth(101);
        this.scene.tweens.add({
          targets: spray,
          x: x + width * 0.2,
          y: y + side * 12,
          alpha: 0,
          scaleX: 2,
          duration: 400,
          onComplete: () => spray.destroy(),
        });
      }
    }
  }

  /** Engine exhaust with heat shimmer */
  engineExhaust(x: number, y: number, rotation: number): void {
    if (Math.random() > 0.4) return;
    const ex = x - Math.cos(rotation) * 18;
    const ey = y - Math.sin(rotation) * 18;

    const exhaust = this.scene.add.circle(ex, ey, 2, 0x555555, 0.3).setDepth(590);
    this.scene.tweens.add({
      targets: exhaust,
      radius: 5,
      alpha: 0,
      x: ex - Math.cos(rotation) * 12,
      y: ey - Math.sin(rotation) * 12,
      duration: 280,
      onComplete: () => exhaust.destroy(),
    });

    // Hot exhaust core
    if (Math.random() > 0.6) {
      const hot = this.scene.add.circle(ex, ey, 1.5, 0xffaa44, 0.3).setDepth(591);
      this.scene.tweens.add({
        targets: hot,
        alpha: 0,
        x: ex - Math.cos(rotation) * 6,
        y: ey - Math.sin(rotation) * 6,
        duration: 120,
        onComplete: () => hot.destroy(),
      });
    }
  }

  /** Rotor downwash ripple on water */
  rotorWash(x: number, y: number): void {
    if (Math.random() > 0.08) return;
    const ring = this.scene.add.circle(x, y, 8, 0x2a5a8a, 0.06).setDepth(50);
    this.scene.tweens.add({
      targets: ring,
      radius: 28,
      alpha: 0,
      duration: 900,
      onComplete: () => ring.destroy(),
    });
    // Second ring (staggered)
    this.scene.time.delayedCall(200, () => {
      const ring2 = this.scene.add.circle(x, y, 6, 0x3a6a9a, 0.04).setDepth(50);
      this.scene.tweens.add({
        targets: ring2,
        radius: 22,
        alpha: 0,
        duration: 700,
        onComplete: () => ring2.destroy(),
      });
    });
  }

  /** Damage flash */
  damageFlash(x: number, y: number): void {
    const flash = this.scene.add.circle(x, y, 8, 0xffffff, 0.6).setDepth(820);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      radius: 14,
      duration: 80,
      onComplete: () => flash.destroy(),
    });
  }

  /** Water splash */
  waterSplash(x: number, y: number): void {
    const splash = this.scene.add.circle(x, y, 2, 0x6699bb, 0.4).setDepth(150);
    this.scene.tweens.add({
      targets: splash,
      radius: 8,
      alpha: 0,
      duration: 250,
      onComplete: () => splash.destroy(),
    });
    // Droplets
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const drop = this.scene.add.circle(x, y, 1, 0x88bbcc, 0.5).setDepth(151);
      this.scene.tweens.add({
        targets: drop,
        x: x + Math.cos(angle) * 10,
        y: y + Math.sin(angle) * 10 - 3,
        alpha: 0,
        duration: 200,
        onComplete: () => drop.destroy(),
      });
    }
  }

  /** Muzzle flash with bright core */
  muzzleFlash(x: number, y: number, color: number = 0xffdd44): void {
    const flash = this.scene.add.circle(x, y, 5, color, 0.7).setDepth(610);
    this.scene.tweens.add({
      targets: flash,
      radius: 1,
      alpha: 0,
      duration: 50,
      onComplete: () => flash.destroy(),
    });
    // White hot core
    const core = this.scene.add.circle(x, y, 2, 0xffffff, 0.9).setDepth(611);
    this.scene.tweens.add({
      targets: core,
      alpha: 0,
      duration: 30,
      onComplete: () => core.destroy(),
    });
  }

  /** Flare burst with starburst pattern */
  flareBurst(x: number, y: number): void {
    // Starburst rays
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const flare = this.scene.add.circle(x, y, 2, 0xffffff, 0.9).setDepth(850);
      this.scene.tweens.add({
        targets: flare,
        x: x + Math.cos(angle) * 70,
        y: y + Math.sin(angle) * 70,
        alpha: 0,
        radius: 1,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => flare.destroy(),
      });
    }
    // Expanding ring
    const ring = this.scene.add.circle(x, y, 10, 0xffffcc, 0.6).setDepth(849);
    this.scene.tweens.add({
      targets: ring,
      radius: 90,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy(),
    });
    // Central flash
    const central = this.scene.add.circle(x, y, 15, 0xffffff, 0.8).setDepth(851);
    this.scene.tweens.add({
      targets: central,
      radius: 5,
      alpha: 0,
      duration: 200,
      onComplete: () => central.destroy(),
    });
  }

  /** CIWS tracer stream with muzzle glow */
  ciwsBurst(fromX: number, fromY: number, toX: number, toY: number): void {
    // Muzzle glow at source
    const muzzle = this.scene.add.circle(fromX, fromY, 3, 0xffff44, 0.5).setDepth(400);
    this.scene.tweens.add({
      targets: muzzle,
      alpha: 0,
      duration: 80,
      onComplete: () => muzzle.destroy(),
    });

    const count = 8;
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * 20, () => {
        const t = i / count;
        const spread = 6;
        const tx = fromX + (toX - fromX) * t + (Math.random() - 0.5) * spread;
        const ty = fromY + (toY - fromY) * t + (Math.random() - 0.5) * spread;
        const tracer = this.scene.add.rectangle(tx, ty, 3, 1, 0xffff44, 0.8).setDepth(400);
        this.scene.tweens.add({
          targets: tracer,
          alpha: 0,
          duration: 80,
          onComplete: () => tracer.destroy(),
        });
      });
    }

    // Impact spark at target
    const spark = this.scene.add.circle(toX, toY, 3, 0xffcc00, 0.6).setDepth(401);
    this.scene.tweens.add({
      targets: spark,
      radius: 1,
      alpha: 0,
      duration: 100,
      onComplete: () => spark.destroy(),
    });
  }

  /** Mine pulse with danger ring */
  minePulse(x: number, y: number): void {
    const pulse = this.scene.add.circle(x, y, 10, 0xff2200, 0.15).setDepth(240);
    this.scene.tweens.add({
      targets: pulse,
      radius: 28,
      alpha: 0,
      duration: 700,
      onComplete: () => pulse.destroy(),
    });
    // Inner glow
    const glow = this.scene.add.circle(x, y, 3, 0xff4400, 0.3).setDepth(241);
    this.scene.tweens.add({
      targets: glow,
      radius: 1,
      alpha: 0,
      duration: 400,
      onComplete: () => glow.destroy(),
    });
  }
}
