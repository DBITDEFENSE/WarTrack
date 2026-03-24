import Phaser from 'phaser';

/**
 * Procedurally draws HD detailed military vehicle sprites as textures.
 * All sprites are drawn once and cached as Phaser textures for reuse.
 * Designed for 1920x1080 resolution with high detail.
 * Uses top-left lighting with pre-baked drop shadows.
 */
export class SpriteFactory {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  generateAll(): void {
    this.generateApache();
    this.generateApacheRotor();
    this.generateContainerShip();
    this.generateTankerShip();
    this.generatePatrolShip();
    this.generateFastAttack();
    this.generateDroneBoat();
    this.generateSuicideDrone();
    this.generateMine();
    this.generateMissileSkiff();
    this.generateArmoredPatrol();
    this.generateJammerDrone();
    this.generateEscortShip();
    this.generateCIWSShip();
    this.generateReconDrone();
    this.generateBossShip();
  }

  // ── APACHE HELICOPTER (124x58) ─────────────────────────────

  private generateApache(): void {
    if (this.scene.textures.exists('apache_body')) return;
    const w = 124, h = 58;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Drop shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(w / 2 + 5, cy + 5, 110, 38);

    // Tail boom
    g.fillStyle(0x3a6e2a, 1);
    g.fillRect(4, cy - 4, 40, 8);
    // Tail boom panel lines
    g.lineStyle(1, 0x2d5a1e, 0.3);
    g.lineBetween(10, cy - 3, 40, cy - 3);
    g.lineBetween(10, cy + 3, 40, cy + 3);

    // Tail fin (vertical stabilizer)
    g.fillStyle(0x2d5a1e, 1);
    g.beginPath();
    g.moveTo(4, cy - 12);
    g.lineTo(4, cy + 12);
    g.lineTo(16, cy + 4);
    g.lineTo(16, cy - 4);
    g.closePath();
    g.fillPath();
    // Tail rotor
    g.fillStyle(0x666655, 0.7);
    g.fillRect(2, cy - 14, 3, 28);
    g.fillStyle(0x555544, 0.5);
    g.fillCircle(3, cy, 3);

    // Main fuselage
    g.fillStyle(0x3a7a28, 1);
    g.beginPath();
    g.moveTo(32, cy - 10);
    g.lineTo(90, cy - 14);
    g.lineTo(108, cy - 10);
    g.lineTo(118, cy - 5);
    g.lineTo(122, cy);
    g.lineTo(118, cy + 5);
    g.lineTo(108, cy + 10);
    g.lineTo(90, cy + 14);
    g.lineTo(32, cy + 10);
    g.closePath();
    g.fillPath();

    // Fuselage panel lines
    g.lineStyle(1, 0x2d5a1e, 0.25);
    g.lineBetween(40, cy - 9, 100, cy - 12);
    g.lineBetween(40, cy + 9, 100, cy + 12);
    g.lineBetween(65, cy - 13, 65, cy + 13);
    g.lineBetween(85, cy - 14, 85, cy + 14);

    // Fuselage top highlight (light from top-left)
    g.fillStyle(0x4a9a38, 0.45);
    g.beginPath();
    g.moveTo(34, cy - 9);
    g.lineTo(88, cy - 13);
    g.lineTo(106, cy - 9);
    g.lineTo(88, cy - 4);
    g.lineTo(34, cy - 3);
    g.closePath();
    g.fillPath();

    // Engine nacelles (two dark bumps on sides)
    g.fillStyle(0x333333, 0.8);
    g.fillEllipse(42, cy - 8, 14, 7);
    g.fillEllipse(42, cy + 8, 14, 7);
    // Engine intake grilles
    g.fillStyle(0x222222, 0.6);
    g.fillRect(46, cy - 10, 4, 5);
    g.fillRect(46, cy + 5, 4, 5);
    // Exhaust ports
    g.fillStyle(0x444444, 0.7);
    g.fillRect(35, cy - 9, 5, 4);
    g.fillRect(35, cy + 5, 5, 4);

    // Cockpit glass (tandem two-seat)
    g.fillStyle(0x44aadd, 0.5);
    g.beginPath();
    g.moveTo(95, cy - 8);
    g.lineTo(112, cy - 5);
    g.lineTo(118, cy - 2);
    g.lineTo(120, cy);
    g.lineTo(118, cy + 2);
    g.lineTo(112, cy + 5);
    g.lineTo(95, cy + 8);
    g.lineTo(98, cy);
    g.closePath();
    g.fillPath();

    // Cockpit frame divider
    g.lineStyle(1, 0x2d5a1e, 0.6);
    g.lineBetween(105, cy - 7, 105, cy + 7);

    // Cockpit glare
    g.fillStyle(0x88ddff, 0.35);
    g.beginPath();
    g.moveTo(100, cy - 6);
    g.lineTo(112, cy - 4);
    g.lineTo(108, cy - 1);
    g.lineTo(100, cy - 2);
    g.closePath();
    g.fillPath();

    // Stub wings with weapon pylons
    g.fillStyle(0x2d5a1e, 1);
    // Top wing
    g.fillRect(56, cy - 22, 28, 7);
    // Bottom wing
    g.fillRect(56, cy + 15, 28, 7);
    // Wing tips
    g.fillStyle(0x336622, 0.8);
    g.fillTriangle(56, cy - 22, 56, cy - 15, 50, cy - 18);
    g.fillTriangle(56, cy + 15, 56, cy + 22, 50, cy + 18);

    // Rocket pods (4 total, 2 per wing)
    g.fillStyle(0x555544, 1);
    g.fillRect(58, cy - 25, 10, 5);
    g.fillRect(72, cy - 25, 10, 5);
    g.fillRect(58, cy + 20, 10, 5);
    g.fillRect(72, cy + 20, 10, 5);
    // Pod detail (tube openings)
    g.fillStyle(0x333322, 0.8);
    g.fillCircle(68, cy - 23, 2);
    g.fillCircle(82, cy - 23, 2);
    g.fillCircle(68, cy + 23, 2);
    g.fillCircle(82, cy + 23, 2);

    // Hellfire rail (under wing)
    g.fillStyle(0x444433, 0.9);
    g.fillRect(60, cy - 20, 3, 3);
    g.fillRect(75, cy - 20, 3, 3);
    g.fillRect(60, cy + 17, 3, 3);
    g.fillRect(75, cy + 17, 3, 3);

    // Chain gun turret under nose
    g.fillStyle(0x3a3a3a, 1);
    g.fillEllipse(112, cy + 5, 10, 6);
    g.fillStyle(0x333333, 1);
    g.fillRect(112, cy + 3, 12, 3);
    // Gun barrel
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(118, cy + 3, 6, 2);

    // Sensor dome under nose
    g.fillStyle(0x555566, 0.7);
    g.fillCircle(116, cy - 4, 4);
    g.fillStyle(0x333344, 0.5);
    g.fillCircle(116, cy - 4, 2);

    // Pitot tube
    g.fillStyle(0x666666, 0.6);
    g.fillRect(120, cy - 1, 4, 1);

    g.generateTexture('apache_body', w, h);
    g.destroy();
  }

  private generateApacheRotor(): void {
    if (this.scene.textures.exists('apache_rotor')) return;
    const size = 96;
    const g = this.scene.add.graphics();
    const c = size / 2;

    // Rotor disc (motion blur)
    g.fillStyle(0x88aa77, 0.08);
    g.fillCircle(c, c, 44);
    g.fillStyle(0x88aa77, 0.05);
    g.fillCircle(c, c, 40);

    // Blade streaks (4 blades with motion blur)
    g.lineStyle(3, 0x667755, 0.35);
    g.lineBetween(4, c, size - 4, c);
    g.lineBetween(c, 4, c, size - 4);
    // Diagonal blades (showing rotation)
    g.lineStyle(2, 0x667755, 0.2);
    g.lineBetween(10, 10, size - 10, size - 10);
    g.lineBetween(size - 10, 10, 10, size - 10);

    // Hub
    g.fillStyle(0x555555, 0.8);
    g.fillCircle(c, c, 4);
    g.fillStyle(0x666666, 0.6);
    g.fillCircle(c, c, 2);

    g.generateTexture('apache_rotor', size, size);
    g.destroy();
  }

  // ── CONVOY SHIPS ───────────────────────────────────────────

  private generateContainerShip(): void {
    if (this.scene.textures.exists('ship_container')) return;
    const w = 200, h = 62;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(w / 2 + 5, cy + 5, 190, 48);

    // Hull
    g.fillStyle(0x2a3a55, 1);
    g.beginPath();
    g.moveTo(8, cy - 24);
    g.lineTo(170, cy - 26);
    g.lineTo(194, cy - 10);
    g.lineTo(196, cy);
    g.lineTo(194, cy + 10);
    g.lineTo(170, cy + 26);
    g.lineTo(8, cy + 24);
    g.lineTo(4, cy + 16);
    g.lineTo(4, cy - 16);
    g.closePath();
    g.fillPath();

    // Hull waterline (red anti-fouling)
    g.fillStyle(0x882222, 0.6);
    g.beginPath();
    g.moveTo(8, cy + 10);
    g.lineTo(170, cy + 12);
    g.lineTo(194, cy + 6);
    g.lineTo(194, cy + 10);
    g.lineTo(170, cy + 26);
    g.lineTo(8, cy + 24);
    g.lineTo(4, cy + 16);
    g.closePath();
    g.fillPath();

    // Deck
    g.fillStyle(0x445566, 0.5);
    g.fillRect(30, cy - 22, 145, 44);

    // Container stacks (multiple rows, colorful)
    const containerColors = [
      [0x3388cc, 0xcc5533, 0x44aa55, 0x6644aa, 0xcc8833, 0x33aa88, 0xaa3355, 0x5588aa],
      [0xaa6633, 0x4488cc, 0x55aa44, 0x8844aa, 0xcc7733, 0x3399aa, 0xcc4455, 0x4477bb],
      [0x3377bb, 0xbb5544, 0x55bb55, 0x7755aa, 0xbb8844, 0x44aabb, 0xbb3366, 0x5599bb],
    ];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        const cx = 38 + col * 16;
        const ccy = cy - 18 + row * 13;
        g.fillStyle(containerColors[row][col], 0.9);
        g.fillRect(cx, ccy, 14, 11);
        // Container highlight
        g.fillStyle(0xffffff, 0.12);
        g.fillRect(cx, ccy, 14, 3);
        // Container side shadow
        g.fillStyle(0x000000, 0.1);
        g.fillRect(cx + 12, ccy + 2, 2, 9);
      }
    }

    // Bridge/superstructure (rear)
    g.fillStyle(0x556677, 1);
    g.fillRect(10, cy - 19, 22, 38);
    // Bridge upper
    g.fillStyle(0x667788, 1);
    g.fillRect(12, cy - 24, 18, 10);
    // Bridge windows
    g.fillStyle(0x88ccff, 0.5);
    g.fillRect(14, cy - 22, 14, 4);
    g.fillStyle(0xaaddff, 0.3);
    g.fillRect(14, cy - 22, 14, 2);
    // Smokestack
    g.fillStyle(0x444444, 0.8);
    g.fillRect(16, cy - 28, 8, 6);
    g.fillStyle(0xaa2222, 0.5);
    g.fillRect(16, cy - 28, 8, 2);
    // Mast
    g.fillStyle(0x666666, 0.7);
    g.fillRect(20, cy - 32, 2, 8);
    g.fillRect(17, cy - 33, 8, 1);

    // Bow detail
    g.fillStyle(0x3a4a66, 0.6);
    g.fillRect(176, cy - 6, 12, 12);

    // Deck lines
    g.lineStyle(1, 0x334455, 0.2);
    g.lineBetween(32, cy - 22, 170, cy - 24);
    g.lineBetween(32, cy + 22, 170, cy + 24);

    g.generateTexture('ship_container', w, h);
    g.destroy();
  }

  private generateTankerShip(): void {
    if (this.scene.textures.exists('ship_tanker')) return;
    const w = 224, h = 70;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(w / 2 + 5, cy + 5, 210, 54);

    // Hull
    g.fillStyle(0x3a4a33, 1);
    g.beginPath();
    g.moveTo(8, cy - 28);
    g.lineTo(190, cy - 30);
    g.lineTo(218, cy - 12);
    g.lineTo(220, cy);
    g.lineTo(218, cy + 12);
    g.lineTo(190, cy + 30);
    g.lineTo(8, cy + 28);
    g.lineTo(4, cy + 18);
    g.lineTo(4, cy - 18);
    g.closePath();
    g.fillPath();

    // Waterline
    g.fillStyle(0x772222, 0.6);
    g.beginPath();
    g.moveTo(8, cy + 12);
    g.lineTo(190, cy + 14);
    g.lineTo(218, cy + 8);
    g.lineTo(218, cy + 12);
    g.lineTo(190, cy + 30);
    g.lineTo(8, cy + 28);
    g.lineTo(4, cy + 18);
    g.closePath();
    g.fillPath();

    // Deck
    g.fillStyle(0x4a5a44, 0.4);
    g.fillRect(30, cy - 24, 170, 48);

    // Tanker domes (6 cylindrical sections)
    for (let i = 0; i < 6; i++) {
      const tx = 42 + i * 24;
      g.fillStyle(0x556644, 1);
      g.fillEllipse(tx + 10, cy, 22, 20);
      // Dome highlight
      g.fillStyle(0x778866, 0.4);
      g.fillEllipse(tx + 8, cy - 4, 16, 10);
      // Dome shadow
      g.fillStyle(0x334422, 0.3);
      g.fillEllipse(tx + 12, cy + 4, 16, 8);
    }

    // Pipe catwalks along deck
    g.lineStyle(1, 0x888877, 0.4);
    g.lineBetween(36, cy, 190, cy);
    g.lineStyle(1, 0x777766, 0.3);
    g.lineBetween(36, cy - 6, 190, cy - 6);
    g.lineBetween(36, cy + 6, 190, cy + 6);

    // Bridge (rear)
    g.fillStyle(0x556655, 1);
    g.fillRect(10, cy - 22, 24, 44);
    g.fillStyle(0x667766, 1);
    g.fillRect(12, cy - 26, 18, 8);
    // Bridge windows
    g.fillStyle(0x88ccaa, 0.5);
    g.fillRect(14, cy - 24, 14, 4);
    // Smokestack
    g.fillStyle(0x444444, 0.8);
    g.fillRect(16, cy - 32, 10, 8);
    g.fillStyle(0x222222, 0.5);
    g.fillRect(16, cy - 32, 10, 2);
    // Mast
    g.fillStyle(0x666666, 0.7);
    g.fillRect(20, cy - 36, 2, 8);

    g.generateTexture('ship_tanker', w, h);
    g.destroy();
  }

  private generatePatrolShip(): void {
    if (this.scene.textures.exists('ship_patrol')) return;
    const w = 128, h = 42;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(w / 2 + 4, cy + 4, 118, 32);

    // Hull (sleek warship)
    g.fillStyle(0x667788, 1);
    g.beginPath();
    g.moveTo(8, cy - 14);
    g.lineTo(100, cy - 18);
    g.lineTo(122, cy - 6);
    g.lineTo(124, cy);
    g.lineTo(122, cy + 6);
    g.lineTo(100, cy + 18);
    g.lineTo(8, cy + 14);
    g.lineTo(4, cy + 8);
    g.lineTo(4, cy - 8);
    g.closePath();
    g.fillPath();

    // Waterline
    g.fillStyle(0x334455, 0.5);
    g.beginPath();
    g.moveTo(8, cy + 6);
    g.lineTo(100, cy + 8);
    g.lineTo(122, cy + 4);
    g.lineTo(122, cy + 6);
    g.lineTo(100, cy + 18);
    g.lineTo(8, cy + 14);
    g.closePath();
    g.fillPath();

    // Highlight
    g.fillStyle(0x8899aa, 0.35);
    g.fillRect(12, cy - 16, 90, 5);

    // Superstructure
    g.fillStyle(0x7788aa, 1);
    g.fillRect(30, cy - 12, 34, 24);
    g.fillStyle(0x8899bb, 1);
    g.fillRect(32, cy - 16, 28, 8);
    // Windows
    g.fillStyle(0x88ccff, 0.5);
    g.fillRect(34, cy - 14, 24, 4);
    g.fillStyle(0xaaddff, 0.3);
    g.fillRect(34, cy - 14, 24, 2);

    // Fore gun mount
    g.fillStyle(0x555566, 0.9);
    g.fillCircle(90, cy, 6);
    g.fillRect(90, cy - 2, 20, 4);
    // Gun barrel detail
    g.fillStyle(0x444455, 1);
    g.fillRect(106, cy - 1, 8, 2);

    // Aft gun
    g.fillStyle(0x555566, 0.8);
    g.fillCircle(18, cy, 4);
    g.fillRect(10, cy - 1, 8, 2);

    // Radar mast
    g.fillStyle(0x666677, 0.7);
    g.fillRect(44, cy - 20, 3, 8);
    g.fillRect(40, cy - 22, 11, 2);
    // Radar dish
    g.fillStyle(0x888899, 0.5);
    g.fillRect(39, cy - 23, 13, 2);

    // Antenna
    g.lineStyle(1, 0x777788, 0.5);
    g.lineBetween(48, cy - 20, 52, cy - 26);

    g.generateTexture('ship_patrol', w, h);
    g.destroy();
  }

  // ── ENEMIES ────────────────────────────────────────────────

  private generateFastAttack(): void {
    if (this.scene.textures.exists('enemy_fastAttack')) return;
    const w = 64, h = 34;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(w / 2 + 3, cy + 3, 56, 26);

    // Hull (aggressive wedge shape)
    g.fillStyle(0x992222, 1);
    g.beginPath();
    g.moveTo(4, cy - 8);
    g.lineTo(48, cy - 14);
    g.lineTo(60, cy - 4);
    g.lineTo(62, cy);
    g.lineTo(60, cy + 4);
    g.lineTo(48, cy + 14);
    g.lineTo(4, cy + 8);
    g.closePath();
    g.fillPath();

    // Highlight
    g.fillStyle(0xcc4444, 0.4);
    g.beginPath();
    g.moveTo(8, cy - 6);
    g.lineTo(44, cy - 12);
    g.lineTo(54, cy - 3);
    g.lineTo(8, cy - 2);
    g.closePath();
    g.fillPath();

    // Waterline
    g.fillStyle(0x661111, 0.5);
    g.fillRect(6, cy + 2, 50, 10);

    // Cabin
    g.fillStyle(0x772222, 1);
    g.fillRect(20, cy - 8, 16, 16);
    // Window
    g.fillStyle(0x88aacc, 0.4);
    g.fillRect(22, cy - 6, 12, 3);

    // Gun mount
    g.fillStyle(0x551111, 1);
    g.fillCircle(44, cy, 5);
    g.fillRect(44, cy - 2, 14, 4);

    // Engine detail
    g.fillStyle(0x771111, 0.6);
    g.fillRect(5, cy - 3, 6, 6);
    // Wake spray notch
    g.fillStyle(0x551111, 0.4);
    g.fillTriangle(4, cy - 8, 4, cy + 8, 8, cy);

    g.generateTexture('enemy_fastAttack', w, h);
    g.destroy();
  }

  private generateDroneBoat(): void {
    if (this.scene.textures.exists('enemy_droneBoat')) return;
    const w = 50, h = 28;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(w / 2 + 3, cy + 3, 44, 22);

    // Hull (torpedo/speedboat shape)
    g.fillStyle(0xcc5500, 1);
    g.beginPath();
    g.moveTo(4, cy);
    g.lineTo(10, cy - 10);
    g.lineTo(38, cy - 9);
    g.lineTo(48, cy);
    g.lineTo(38, cy + 9);
    g.lineTo(10, cy + 10);
    g.closePath();
    g.fillPath();

    // Highlight
    g.fillStyle(0xee7722, 0.45);
    g.fillRect(14, cy - 7, 24, 4);

    // Explosive payload (front section)
    g.fillStyle(0xff3300, 0.6);
    g.fillRect(34, cy - 7, 10, 14);
    g.fillStyle(0xffcc00, 0.5);
    g.fillRect(36, cy - 5, 6, 10);

    // Warning stripes
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0xff0000, 0.4);
      g.fillRect(36 + i * 3, cy - 5, 1, 10);
    }

    // Antenna
    g.fillStyle(0x886633, 0.7);
    g.fillRect(20, cy - 12, 2, 5);

    // Engine
    g.fillStyle(0x884400, 0.6);
    g.fillRect(6, cy - 3, 6, 6);

    g.generateTexture('enemy_droneBoat', w, h);
    g.destroy();
  }

  /** Shahed-style delta-wing loitering munition drone */
  private generateSuicideDrone(): void {
    if (this.scene.textures.exists('enemy_suicideDrone')) return;
    const w = 48, h = 48;
    const g = this.scene.add.graphics();
    const cx = w / 2, cy = h / 2;

    // Drop shadow (angled, showing flight altitude)
    g.fillStyle(0x000000, 0.25);
    g.beginPath();
    g.moveTo(cx - 16 + 4, cy + 10 + 4);
    g.lineTo(cx + 4, cy - 18 + 4);
    g.lineTo(cx + 16 + 4, cy + 10 + 4);
    g.closePath();
    g.fillPath();

    // Main delta-wing body — clean white/light grey
    g.fillStyle(0xddddcc, 1);
    g.beginPath();
    g.moveTo(cx, cy - 20);        // nose tip
    g.lineTo(cx + 18, cy + 12);   // right wingtip trailing
    g.lineTo(cx + 14, cy + 14);   // right wing notch
    g.lineTo(cx + 3, cy + 6);     // right body
    g.lineTo(cx, cy + 10);        // tail center
    g.lineTo(cx - 3, cy + 6);     // left body
    g.lineTo(cx - 14, cy + 14);   // left wing notch
    g.lineTo(cx - 18, cy + 12);   // left wingtip trailing
    g.closePath();
    g.fillPath();

    // Wing upper surface highlight (light from top-left)
    g.fillStyle(0xeeeedd, 0.5);
    g.beginPath();
    g.moveTo(cx, cy - 18);
    g.lineTo(cx - 14, cy + 10);
    g.lineTo(cx - 4, cy + 4);
    g.lineTo(cx, cy - 8);
    g.closePath();
    g.fillPath();

    // Fuselage center spine (raised ridge)
    g.fillStyle(0xccccbb, 0.8);
    g.beginPath();
    g.moveTo(cx, cy - 18);
    g.lineTo(cx + 3, cy + 5);
    g.lineTo(cx, cy + 8);
    g.lineTo(cx - 3, cy + 5);
    g.closePath();
    g.fillPath();

    // Dark wingtip sections
    g.fillStyle(0x444444, 0.85);
    // Right wingtip
    g.beginPath();
    g.moveTo(cx + 12, cy + 6);
    g.lineTo(cx + 18, cy + 12);
    g.lineTo(cx + 14, cy + 14);
    g.lineTo(cx + 10, cy + 10);
    g.closePath();
    g.fillPath();
    // Left wingtip
    g.beginPath();
    g.moveTo(cx - 12, cy + 6);
    g.lineTo(cx - 18, cy + 12);
    g.lineTo(cx - 14, cy + 14);
    g.lineTo(cx - 10, cy + 10);
    g.closePath();
    g.fillPath();

    // Panel lines on wings
    g.lineStyle(1, 0xaaaaaa, 0.2);
    g.lineBetween(cx - 2, cy - 14, cx - 14, cy + 12);
    g.lineBetween(cx + 2, cy - 14, cx + 14, cy + 12);
    // Mid-body panel
    g.lineStyle(1, 0x999988, 0.15);
    g.lineBetween(cx - 8, cy + 2, cx + 8, cy + 2);

    // Rear propeller disc (pusher prop — subtle blur)
    g.fillStyle(0x888877, 0.2);
    g.fillCircle(cx, cy + 10, 4);
    g.fillStyle(0x666655, 0.4);
    g.fillCircle(cx, cy + 10, 2);

    // Nose sensor (dark optic)
    g.fillStyle(0x333333, 0.7);
    g.fillCircle(cx, cy - 16, 2);

    // Warhead warning — subtle red marking near nose
    g.fillStyle(0xcc2222, 0.3);
    g.fillRect(cx - 2, cy - 12, 4, 3);

    g.generateTexture('enemy_suicideDrone', w, h);
    g.destroy();
  }

  private generateMine(): void {
    if (this.scene.textures.exists('enemy_mine')) return;
    const size = 42;
    const g = this.scene.add.graphics();
    const c = size / 2;

    // Shadow (underwater look)
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(c + 2, c + 2, 18);

    // Mine body (dark sphere)
    g.fillStyle(0x444444, 1);
    g.fillCircle(c, c, 16);

    // Sphere shading
    g.fillStyle(0x666666, 0.4);
    g.fillCircle(c - 3, c - 3, 12);
    g.fillStyle(0x333333, 0.3);
    g.fillCircle(c + 4, c + 4, 10);

    // Contact horns (8 spikes)
    g.fillStyle(0x555555, 1);
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const hx = c + Math.cos(angle) * 17;
      const hy = c + Math.sin(angle) * 17;
      g.fillCircle(hx, hy, 3);
      // Horn stem
      g.lineStyle(2, 0x555555, 0.8);
      g.lineBetween(c + Math.cos(angle) * 14, c + Math.sin(angle) * 14, hx, hy);
    }

    // Red warning indicator
    g.fillStyle(0xff2200, 0.8);
    g.fillCircle(c, c, 4);
    g.fillStyle(0xff6644, 0.4);
    g.fillCircle(c - 1, c - 1, 2);

    // Chain anchor point at bottom
    g.fillStyle(0x333333, 0.6);
    g.fillCircle(c, c + 16, 2);

    g.generateTexture('enemy_mine', size, size);
    g.destroy();
  }

  private generateMissileSkiff(): void {
    if (this.scene.textures.exists('enemy_missileSkiff')) return;
    const w = 60, h = 32;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(w / 2 + 3, cy + 3, 52, 26);

    // Hull
    g.fillStyle(0x883366, 1);
    g.beginPath();
    g.moveTo(4, cy - 8);
    g.lineTo(44, cy - 13);
    g.lineTo(56, cy - 4);
    g.lineTo(58, cy);
    g.lineTo(56, cy + 4);
    g.lineTo(44, cy + 13);
    g.lineTo(4, cy + 8);
    g.closePath();
    g.fillPath();

    // Highlight
    g.fillStyle(0xaa5588, 0.35);
    g.fillRect(8, cy - 10, 38, 5);

    // Waterline
    g.fillStyle(0x552244, 0.5);
    g.fillRect(6, cy + 2, 46, 10);

    // Missile tubes (2 angled launchers per side)
    g.fillStyle(0x664455, 1);
    g.fillRect(20, cy - 17, 20, 5);
    g.fillRect(20, cy + 12, 20, 5);
    // Missile tips
    g.fillStyle(0xaa3366, 0.9);
    g.fillRect(38, cy - 17, 6, 5);
    g.fillRect(38, cy + 12, 6, 5);
    // Inner tubes
    g.fillStyle(0x553344, 0.7);
    g.fillRect(22, cy - 16, 16, 1);
    g.fillRect(22, cy + 15, 16, 1);

    // Cabin
    g.fillStyle(0x773355, 0.9);
    g.fillRect(12, cy - 7, 14, 14);
    g.fillStyle(0x88aacc, 0.3);
    g.fillRect(14, cy - 5, 10, 3);

    g.generateTexture('enemy_missileSkiff', w, h);
    g.destroy();
  }

  private generateArmoredPatrol(): void {
    if (this.scene.textures.exists('enemy_armoredPatrol')) return;
    const w = 92, h = 42;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(w / 2 + 4, cy + 4, 84, 34);

    // Heavy hull
    g.fillStyle(0x664422, 1);
    g.beginPath();
    g.moveTo(8, cy - 16);
    g.lineTo(70, cy - 18);
    g.lineTo(86, cy - 8);
    g.lineTo(88, cy);
    g.lineTo(86, cy + 8);
    g.lineTo(70, cy + 18);
    g.lineTo(8, cy + 16);
    g.lineTo(4, cy + 10);
    g.lineTo(4, cy - 10);
    g.closePath();
    g.fillPath();

    // Armor plate highlight
    g.fillStyle(0x886633, 0.35);
    g.fillRect(12, cy - 15, 62, 5);

    // Waterline
    g.fillStyle(0x442211, 0.5);
    g.fillRect(8, cy + 4, 76, 14);

    // Armor rivets along hull
    g.fillStyle(0x998855, 0.4);
    for (let i = 0; i < 8; i++) {
      g.fillCircle(14 + i * 9, cy - 14, 1.5);
      g.fillCircle(14 + i * 9, cy + 14, 1.5);
    }

    // Superstructure (armored bridge)
    g.fillStyle(0x776633, 1);
    g.fillRect(22, cy - 13, 28, 26);
    g.fillStyle(0x887744, 1);
    g.fillRect(24, cy - 17, 22, 8);
    // Bridge windows (narrow armored slits)
    g.fillStyle(0x88aaaa, 0.4);
    g.fillRect(26, cy - 15, 18, 3);

    // Main turret (rotatable)
    g.fillStyle(0x555533, 1);
    g.fillCircle(66, cy, 8);
    g.fillRect(66, cy - 3, 22, 6);
    // Gun barrel
    g.fillStyle(0x444422, 1);
    g.fillRect(82, cy - 2, 8, 4);

    // Secondary guns
    g.fillStyle(0x665533, 0.9);
    g.fillCircle(16, cy - 10, 5);
    g.fillRect(8, cy - 11, 8, 3);
    g.fillCircle(16, cy + 10, 5);
    g.fillRect(8, cy + 10, 8, 3);

    // Radar
    g.fillStyle(0x666644, 0.7);
    g.fillRect(34, cy - 20, 3, 6);
    g.fillRect(30, cy - 22, 11, 2);

    g.generateTexture('enemy_armoredPatrol', w, h);
    g.destroy();
  }

  /** Delta-wing EW/jammer drone — similar silhouette to suicide drone but with purple tint and antenna pods */
  private generateJammerDrone(): void {
    if (this.scene.textures.exists('enemy_jammerDrone')) return;
    const w = 48, h = 48;
    const g = this.scene.add.graphics();
    const cx = w / 2, cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.beginPath();
    g.moveTo(cx - 17 + 4, cy + 11 + 4);
    g.lineTo(cx + 4, cy - 19 + 4);
    g.lineTo(cx + 17 + 4, cy + 11 + 4);
    g.closePath();
    g.fillPath();

    // Main delta-wing body — light grey with purple tint
    g.fillStyle(0xccbbdd, 1);
    g.beginPath();
    g.moveTo(cx, cy - 19);
    g.lineTo(cx + 19, cy + 12);
    g.lineTo(cx + 15, cy + 14);
    g.lineTo(cx + 3, cy + 6);
    g.lineTo(cx, cy + 10);
    g.lineTo(cx - 3, cy + 6);
    g.lineTo(cx - 15, cy + 14);
    g.lineTo(cx - 19, cy + 12);
    g.closePath();
    g.fillPath();

    // Upper surface highlight
    g.fillStyle(0xddccee, 0.45);
    g.beginPath();
    g.moveTo(cx, cy - 16);
    g.lineTo(cx - 12, cy + 8);
    g.lineTo(cx - 3, cy + 3);
    g.lineTo(cx, cy - 6);
    g.closePath();
    g.fillPath();

    // Fuselage spine
    g.fillStyle(0xbbaacc, 0.7);
    g.beginPath();
    g.moveTo(cx, cy - 17);
    g.lineTo(cx + 3, cy + 4);
    g.lineTo(cx, cy + 8);
    g.lineTo(cx - 3, cy + 4);
    g.closePath();
    g.fillPath();

    // Dark wingtips with purple tint
    g.fillStyle(0x553377, 0.8);
    g.beginPath();
    g.moveTo(cx + 13, cy + 6);
    g.lineTo(cx + 19, cy + 12);
    g.lineTo(cx + 15, cy + 14);
    g.lineTo(cx + 11, cy + 10);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(cx - 13, cy + 6);
    g.lineTo(cx - 19, cy + 12);
    g.lineTo(cx - 15, cy + 14);
    g.lineTo(cx - 11, cy + 10);
    g.closePath();
    g.fillPath();

    // Jamming antenna pods on wingtips
    g.fillStyle(0x7744aa, 0.9);
    g.fillCircle(cx - 16, cy + 11, 3);
    g.fillCircle(cx + 16, cy + 11, 3);

    // EW emitter rings (signature visual — distinguishes from suicide drone)
    g.lineStyle(1, 0xbb66ff, 0.25);
    g.strokeCircle(cx - 16, cy + 11, 6);
    g.strokeCircle(cx + 16, cy + 11, 6);
    g.lineStyle(1, 0x9944dd, 0.15);
    g.strokeCircle(cx, cy, 14);

    // Center jamming emitter
    g.fillStyle(0xcc88ff, 0.7);
    g.fillCircle(cx, cy - 2, 3);
    g.fillStyle(0xeeccff, 0.4);
    g.fillCircle(cx - 1, cy - 3, 1.5);

    // Panel lines
    g.lineStyle(1, 0x9988aa, 0.15);
    g.lineBetween(cx - 2, cy - 14, cx - 15, cy + 12);
    g.lineBetween(cx + 2, cy - 14, cx + 15, cy + 12);

    g.generateTexture('enemy_jammerDrone', w, h);
    g.destroy();
  }

  // ── SUPPORT ASSETS ─────────────────────────────────────────

  private generateEscortShip(): void {
    if (this.scene.textures.exists('support_escort')) return;
    const w = 104, h = 38;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(w / 2 + 4, cy + 4, 96, 30);

    // Hull (warship)
    g.fillStyle(0x5577aa, 1);
    g.beginPath();
    g.moveTo(8, cy - 12);
    g.lineTo(82, cy - 16);
    g.lineTo(98, cy - 5);
    g.lineTo(100, cy);
    g.lineTo(98, cy + 5);
    g.lineTo(82, cy + 16);
    g.lineTo(8, cy + 12);
    g.lineTo(4, cy + 7);
    g.lineTo(4, cy - 7);
    g.closePath();
    g.fillPath();

    // Highlight
    g.fillStyle(0x7799cc, 0.35);
    g.fillRect(12, cy - 14, 72, 5);

    // Superstructure
    g.fillStyle(0x6688bb, 1);
    g.fillRect(28, cy - 10, 26, 20);
    g.fillStyle(0x7799cc, 1);
    g.fillRect(30, cy - 14, 20, 7);
    g.fillStyle(0x88ccff, 0.4);
    g.fillRect(32, cy - 12, 16, 4);

    // Forward gun
    g.fillStyle(0x445566, 1);
    g.fillCircle(76, cy, 6);
    g.fillRect(76, cy - 2, 18, 4);

    // Radar
    g.fillStyle(0x667788, 0.7);
    g.fillRect(38, cy - 18, 2, 6);
    g.fillRect(34, cy - 20, 10, 2);

    g.generateTexture('support_escort', w, h);
    g.destroy();
  }

  private generateCIWSShip(): void {
    if (this.scene.textures.exists('support_ciws')) return;
    const w = 78, h = 32;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(w / 2 + 3, cy + 3, 70, 26);

    // Hull
    g.fillStyle(0x778855, 1);
    g.beginPath();
    g.moveTo(8, cy - 10);
    g.lineTo(60, cy - 13);
    g.lineTo(74, cy - 4);
    g.lineTo(76, cy);
    g.lineTo(74, cy + 4);
    g.lineTo(60, cy + 13);
    g.lineTo(8, cy + 10);
    g.closePath();
    g.fillPath();

    // CIWS dome (white radome)
    g.fillStyle(0xaabb88, 1);
    g.fillCircle(44, cy, 10);
    g.fillStyle(0xccddaa, 0.4);
    g.fillCircle(42, cy - 2, 6);

    // Gatling barrels
    g.fillStyle(0x555544, 1);
    g.fillRect(52, cy - 4, 18, 2);
    g.fillRect(52, cy - 1, 18, 2);
    g.fillRect(52, cy + 2, 18, 2);

    // Bridge
    g.fillStyle(0x889966, 0.9);
    g.fillRect(16, cy - 8, 16, 16);
    g.fillStyle(0x88aacc, 0.3);
    g.fillRect(18, cy - 6, 12, 3);

    g.generateTexture('support_ciws', w, h);
    g.destroy();
  }

  /** Friendly recon drone — clean white delta-wing UAV with blue markings */
  private generateReconDrone(): void {
    if (this.scene.textures.exists('support_recon')) return;
    const w = 40, h = 40;
    const g = this.scene.add.graphics();
    const cx = w / 2, cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.beginPath();
    g.moveTo(cx - 14 + 3, cy + 10 + 3);
    g.lineTo(cx + 3, cy - 14 + 3);
    g.lineTo(cx + 14 + 3, cy + 10 + 3);
    g.closePath();
    g.fillPath();

    // Main delta body — clean white
    g.fillStyle(0xeeeedd, 1);
    g.beginPath();
    g.moveTo(cx, cy - 16);
    g.lineTo(cx + 16, cy + 10);
    g.lineTo(cx + 12, cy + 12);
    g.lineTo(cx + 2, cy + 5);
    g.lineTo(cx, cy + 8);
    g.lineTo(cx - 2, cy + 5);
    g.lineTo(cx - 12, cy + 12);
    g.lineTo(cx - 16, cy + 10);
    g.closePath();
    g.fillPath();

    // Upper highlight
    g.fillStyle(0xffffee, 0.4);
    g.beginPath();
    g.moveTo(cx, cy - 14);
    g.lineTo(cx - 10, cy + 6);
    g.lineTo(cx - 2, cy + 2);
    g.closePath();
    g.fillPath();

    // Fuselage spine
    g.fillStyle(0xddddcc, 0.7);
    g.beginPath();
    g.moveTo(cx, cy - 14);
    g.lineTo(cx + 2, cy + 4);
    g.lineTo(cx, cy + 6);
    g.lineTo(cx - 2, cy + 4);
    g.closePath();
    g.fillPath();

    // Blue wingtip markers (friendly identification)
    g.fillStyle(0x3366aa, 0.7);
    g.beginPath();
    g.moveTo(cx + 11, cy + 5);
    g.lineTo(cx + 16, cy + 10);
    g.lineTo(cx + 12, cy + 12);
    g.lineTo(cx + 9, cy + 9);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(cx - 11, cy + 5);
    g.lineTo(cx - 16, cy + 10);
    g.lineTo(cx - 12, cy + 12);
    g.lineTo(cx - 9, cy + 9);
    g.closePath();
    g.fillPath();

    // Sensor turret (yellow optic)
    g.fillStyle(0xccaa33, 0.8);
    g.fillCircle(cx, cy - 8, 3);
    g.fillStyle(0xffdd44, 0.5);
    g.fillCircle(cx - 0.5, cy - 9, 1.5);

    // Pusher prop
    g.fillStyle(0x888877, 0.2);
    g.fillCircle(cx, cy + 8, 3);

    g.generateTexture('support_recon', w, h);
    g.destroy();
  }

  // ── BOSS ───────────────────────────────────────────────────

  private generateBossShip(): void {
    if (this.scene.textures.exists('enemy_boss')) return;
    const w = 128, h = 56;
    const g = this.scene.add.graphics();
    const cy = h / 2;

    // Shadow
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(w / 2 + 5, cy + 5, 118, 44);

    // Heavy hull (dark red warship)
    g.fillStyle(0xaa1122, 1);
    g.beginPath();
    g.moveTo(8, cy - 20);
    g.lineTo(96, cy - 24);
    g.lineTo(120, cy - 10);
    g.lineTo(124, cy);
    g.lineTo(120, cy + 10);
    g.lineTo(96, cy + 24);
    g.lineTo(8, cy + 20);
    g.lineTo(4, cy + 12);
    g.lineTo(4, cy - 12);
    g.closePath();
    g.fillPath();

    // Armor highlight
    g.fillStyle(0xcc3344, 0.35);
    g.fillRect(12, cy - 22, 88, 6);

    // Waterline
    g.fillStyle(0x661111, 0.5);
    g.fillRect(8, cy + 6, 110, 18);

    // Armor rivets
    g.fillStyle(0xcc6655, 0.3);
    for (let i = 0; i < 12; i++) {
      g.fillCircle(14 + i * 8, cy - 18, 1.5);
      g.fillCircle(14 + i * 8, cy + 18, 1.5);
    }

    // Armored superstructure
    g.fillStyle(0xbb2233, 1);
    g.fillRect(28, cy - 18, 36, 36);
    g.fillStyle(0xcc3344, 1);
    g.fillRect(30, cy - 22, 28, 8);
    // Bridge slits
    g.fillStyle(0xddaaaa, 0.3);
    g.fillRect(32, cy - 20, 24, 4);

    // Main turret
    g.fillStyle(0x881122, 1);
    g.fillCircle(86, cy, 10);
    g.fillRect(86, cy - 4, 30, 8);
    g.fillStyle(0x771122, 1);
    g.fillRect(110, cy - 3, 12, 6);

    // Secondary turrets
    g.fillStyle(0x991133, 0.9);
    g.fillCircle(18, cy - 12, 6);
    g.fillRect(10, cy - 13, 8, 3);
    g.fillCircle(18, cy + 12, 6);
    g.fillRect(10, cy + 12, 8, 3);

    // Missile launchers (amidships)
    g.fillStyle(0x772233, 0.8);
    g.fillRect(68, cy - 16, 12, 6);
    g.fillRect(68, cy + 10, 12, 6);

    // Radar array
    g.fillStyle(0x666644, 0.8);
    g.fillRect(42, cy - 26, 3, 8);
    g.fillRect(37, cy - 28, 13, 2);

    // Warning stripes
    g.fillStyle(0xffcc00, 0.25);
    g.fillRect(102, cy - 18, 8, 36);

    // Hull detail lines
    g.lineStyle(1, 0x991133, 0.25);
    g.lineBetween(10, cy, 100, cy);

    g.generateTexture('enemy_boss', w, h);
    g.destroy();
  }
}
