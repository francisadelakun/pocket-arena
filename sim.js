/**
 * POCKET ARENA — "Fight for Survival" Simulation Engine (`sim.js`)
 *
 * Marathon Field Layout (2400x3600):
 * - 4 Home Base Vaults SIDE-BY-SIDE along the BOTTOM edge (y ≈ 3400)
 *   House 0: x=350  House 1: x=850  House 2: x=1350  House 3: x=1850
 * - Central Key Vault at the far TOP (y ≈ 200)
 * - Players sprint UP through choke-point corridors, grab keys, sprint back DOWN
 * - Win: First to deposit 2 keys into their bottom vault wins!
 * - Speed Protection, 4s respawn, 10s dropped-key expiry all retained
 * - Smart AI Bots navigate marathon field to key vault and back
 */

(function (window) {
  'use strict';

  const WORLD_WIDTH = 2400;
  const WORLD_HEIGHT = 3600;
  const PLAYER_RADIUS = 20;

  // === MARATHON FIELD ===
  // 4 Home Base Vaults SIDE-BY-SIDE at the BOTTOM edge — players start here, see each other!
  const HOME_VAULTS = [
    { index: 0, x: 350,  y: 3400, radius: 90, color: '#00F0FF', name: 'Blue Vault',  corner: 'Bottom-1' },
    { index: 1, x: 850,  y: 3400, radius: 90, color: '#FF2A6D', name: 'Pink Vault',  corner: 'Bottom-2' },
    { index: 2, x: 1350, y: 3400, radius: 90, color: '#FFDF00', name: 'Gold Vault',  corner: 'Bottom-3' },
    { index: 3, x: 1850, y: 3400, radius: 90, color: '#05D9E8', name: 'Cyan Vault',  corner: 'Bottom-4' }
  ];

  // Central Key Vault at the FAR TOP of the marathon field
  const CENTRAL_VAULT_X = 1200;
  const CENTRAL_VAULT_Y = 200;

  const CENTRAL_KEY_PEDESTALS = [
    { x: CENTRAL_VAULT_X - 60, y: CENTRAL_VAULT_Y - 50 },
    { x: CENTRAL_VAULT_X + 60, y: CENTRAL_VAULT_Y - 50 },
    { x: CENTRAL_VAULT_X - 60, y: CENTRAL_VAULT_Y + 50 },
    { x: CENTRAL_VAULT_X + 60, y: CENTRAL_VAULT_Y + 50 }
  ];

  // Weapon Specifications
  const WEAPONS = {
    pistol: {
      name: 'Pistol',
      icon: '🔫',
      fireRate: 280,
      damage: 24,
      speed: 1100,
      spread: 0.04,
      pellets: 1,
      magSize: Infinity,
      reserve: Infinity,
      reloadTime: 0,
      isAuto: false,
      color: '#FFDF00'
    },
    rifle: {
      name: 'Assault Rifle',
      icon: '⚡',
      fireRate: 120,
      damage: 18,
      speed: 1350,
      spread: 0.06,
      pellets: 1,
      magSize: 30,
      reserve: 90,
      reloadTime: 1600,
      isAuto: true,
      color: '#00F0FF'
    },
    shotgun: {
      name: 'Shotgun',
      icon: '💥',
      fireRate: 700,
      damage: 16,
      speed: 950,
      spread: 0.22,
      pellets: 5,
      magSize: 6,
      reserve: 24,
      reloadTime: 2200,
      isAuto: false,
      color: '#FF2A6D'
    },
    rocket: {
      name: 'Rocket Launcher',
      icon: '🚀',
      fireRate: 1100,
      damage: 95,
      speed: 550,
      spread: 0.02,
      pellets: 1,
      magSize: 3,
      reserve: 9,
      reloadTime: 2800,
      isAuto: false,
      isExplosive: true,
      splashRadius: 170,
      color: '#FF6B00'
    }
  };

  /**
   * Marathon Field Obstacles — choke-points along the vertical 2400×3600 run.
   * Players sprint UP from bottom vaults through these corridors to reach the top key vault.
   */
  function createInitialObstacles() {
    return [
      // ===== TOP KEY VAULT CHAMBER (x≈1200, y≈200) — guarded entry =====
      { id: 'cv_w1',  x: 940,  y: 100, w: 120, h: 200, type: 'stone' },
      { id: 'cv_w2',  x: 1360, y: 100, w: 120, h: 200, type: 'stone' },
      { id: 'cv_e1',  x: 940,  y: 340, w: 120, h: 120, type: 'stone' },
      { id: 'cv_e2',  x: 1360, y: 340, w: 120, h: 120, type: 'stone' },
      { id: 'cv_ww',  x: 1100, y: 100, w: 120, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'cv_ew',  x: 1220, y: 340, w: 120, h: 120, type: 'wood', hp: 100, maxHp: 100 },

      // ===== ZONE 1: TOP SECTION (y 500–1100) — wide 3-lane approach =====
      { id: 'z1_l1',  x: 160,  y: 520, w: 200, h: 120, type: 'stone' },
      { id: 'z1_l2',  x: 160,  y: 800, w: 200, h: 120, type: 'stone' },
      { id: 'z1_wl',  x: 160,  y: 660, w: 200, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'z1_c1',  x: 720,  y: 580, w: 120, h: 240, type: 'stone' },
      { id: 'z1_c2',  x: 1080, y: 680, w: 240, h: 120, type: 'stone' },
      { id: 'z1_cw',  x: 880,  y: 580, w: 120, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'z1_r1',  x: 1680, y: 520, w: 200, h: 120, type: 'stone' },
      { id: 'z1_r2',  x: 1680, y: 800, w: 200, h: 120, type: 'stone' },
      { id: 'z1_wr',  x: 1680, y: 660, w: 200, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'z1_rc1', x: 1400, y: 580, w: 120, h: 240, type: 'stone' },
      { id: 'z1_rc2', x: 2000, y: 640, w: 200, h: 120, type: 'stone' },
      { id: 'z1_rcw', x: 1560, y: 780, w: 120, h: 120, type: 'wood', hp: 100, maxHp: 100 },

      // ===== ZONE 2: MID SECTION (y 1300–2000) — tight choke-points =====
      { id: 'z2_la',  x: 120,  y: 1320, w: 160, h: 320, type: 'stone' },
      { id: 'z2_lb',  x: 480,  y: 1440, w: 240, h: 120, type: 'stone' },
      { id: 'z2_lw',  x: 320,  y: 1520, w: 120, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'z2_ca',  x: 880,  y: 1360, w: 120, h: 280, type: 'stone' },
      { id: 'z2_cb',  x: 1200, y: 1480, w: 300, h: 120, type: 'stone' },
      { id: 'z2_cw',  x: 1040, y: 1680, w: 120, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'z2_ra',  x: 1680, y: 1360, w: 120, h: 280, type: 'stone' },
      { id: 'z2_rb',  x: 1920, y: 1440, w: 240, h: 120, type: 'stone' },
      { id: 'z2_rw',  x: 2040, y: 1600, w: 120, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'z2_rc',  x: 2200, y: 1320, w: 160, h: 320, type: 'stone' },

      // ===== ZONE 3: LOWER SECTION (y 2200–3000) — ambush zone near houses =====
      { id: 'z3_l1',  x: 160,  y: 2240, w: 200, h: 120, type: 'stone' },
      { id: 'z3_l2',  x: 160,  y: 2560, w: 200, h: 120, type: 'stone' },
      { id: 'z3_lw',  x: 160,  y: 2400, w: 200, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'z3_c1',  x: 680,  y: 2300, w: 120, h: 240, type: 'stone' },
      { id: 'z3_c2',  x: 1040, y: 2500, w: 280, h: 120, type: 'stone' },
      { id: 'z3_cw',  x: 840,  y: 2620, w: 120, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'z3_r1',  x: 1640, y: 2300, w: 120, h: 240, type: 'stone' },
      { id: 'z3_r2',  x: 1880, y: 2500, w: 280, h: 120, type: 'stone' },
      { id: 'z3_rw',  x: 1760, y: 2640, w: 120, h: 120, type: 'wood', hp: 100, maxHp: 100 },
      { id: 'z3_rr',  x: 2160, y: 2240, w: 200, h: 120, type: 'stone' },
      { id: 'z3_rr2', x: 2160, y: 2560, w: 200, h: 120, type: 'stone' },
      { id: 'z3_rrw', x: 2160, y: 2400, w: 200, h: 120, type: 'wood', hp: 100, maxHp: 100 },

      // ===== HOME VAULT AREA BARRIERS — dividers between the 4 side-by-side houses =====
      { id: 'hv_div1', x: 580,  y: 3180, w: 60, h: 280, type: 'stone' },
      { id: 'hv_div2', x: 1080, y: 3180, w: 60, h: 280, type: 'stone' },
      { id: 'hv_div3', x: 1580, y: 3180, w: 60, h: 280, type: 'stone' },

      // ===== GRASS AMBUSH BUSHES (scattered along marathon path) =====
      { id: 'g_1', x: 400,  y: 960,  w: 200, h: 160, type: 'bush' },
      { id: 'g_2', x: 1680, y: 960,  w: 200, h: 160, type: 'bush' },
      { id: 'g_3', x: 640,  y: 1760, w: 200, h: 180, type: 'bush' },
      { id: 'g_4', x: 1480, y: 1760, w: 200, h: 180, type: 'bush' },
      { id: 'g_5', x: 320,  y: 2720, w: 180, h: 200, type: 'bush' },
      { id: 'g_6', x: 1880, y: 2720, w: 180, h: 200, type: 'bush' },
      { id: 'g_7', x: 1000, y: 1060, w: 200, h: 160, type: 'bush' },
      { id: 'g_8', x: 1240, y: 2100, w: 200, h: 160, type: 'bush' }
    ];
  }

  // Weapon & Supply Pickups scattered along the marathon path
  const WEAPON_PICKUP_SPOTS = [
    { x: 1200, y: 460,  type: 'rifle' },
    { x: 400,  y: 1200, type: 'shotgun' },
    { x: 1900, y: 1200, type: 'shotgun' },
    { x: 1200, y: 1800, type: 'rifle' },
    { x: 700,  y: 700,  type: 'healthpack' },
    { x: 1700, y: 700,  type: 'shield' },
    { x: 700,  y: 2000, type: 'shield' },
    { x: 1700, y: 2000, type: 'healthpack' },
    { x: 400,  y: 1600, type: 'rocket' },
    { x: 1900, y: 1600, type: 'rocket' }
  ];

  const KILL_TEMPLATES = [
    "🎯 {killer} eliminated {victim} with {weapon}!",
    "💥 {killer} intercepted {victim} ({weapon})!",
    "⚡ {killer} tactical-fragged {victim}!",
    "💀 {victim} dropped all keys to {killer}!",
    "🚀 {killer} blasted {victim} with heavy ordnance!"
  ];

  class ArenaSimulation {
    constructor(netManager) {
      this.net = netManager;
      this.tickInterval = null;
      this.snapshotInterval = null;

      this.state = 'idle';
      this.roundDurationSec = 180;
      this.roundTimeRemaining = 180;
      this.roundStartTime = 0;
      this.lastTickTime = 0;

      this.players = {};
      this.projectiles = [];
      this.bombs = [];
      this.pickups = [];
      this.obstacles = createInitialObstacles();

      this.nextProjId = 1;
      this.nextBombId = 1;
      this.nextPickupId = 1;

      this.onTick = null;
      this.onRoundEnd = null;
    }

    startNewRound(initialPlayers) {
      this.stop();
      this.obstacles = createInitialObstacles();
      this.initPlayers(initialPlayers);
      this.initHeistItems();
      this.projectiles = [];
      this.bombs = [];
      this.roundTimeRemaining = this.roundDurationSec;

      this.state = 'countdown';
      this.roundStartTime = Date.now();
      this.lastTickTime = Date.now();

      if (this.net.isHost) {
        this.net.setRoomState('countdown', {
          countdownSec: 3,
          roundDuration: this.roundDurationSec
        });
      }

      this.tickInterval = setInterval(() => this.tick(), 50);

      if (this.net.isHost) {
        this.snapshotInterval = setInterval(() => this.broadcastSnapshot(), 100);
      }
    }

    initPlayers(playerDict) {
      this.players = {};
      const playerIds = Object.keys(playerDict || {});

      playerIds.forEach((id, index) => {
        const vaultIdx = index % HOME_VAULTS.length;
        const vault = HOME_VAULTS[vaultIdx];
        const original = playerDict[id] || {};

        // All players spawn INSIDE their bottom vault — clustered together, visible at start!
        const spawnX = vault.x + (Math.random() - 0.5) * 40;
        const spawnY = vault.y + (Math.random() - 0.5) * 40;

        this.players[id] = {
          id: id,
          name: original.name || `Operative ${index + 1}`,
          avatar: original.avatar || '🪖',
          color: original.color || vault.color,
          vaultIndex: vaultIdx,
          keysCarried: 0,
          depositedKeys: 0,
          vaultStandingTime: 0,
          x: spawnX,
          y: spawnY,
          vx: 0,
          vy: 0,
          angle: -Math.PI / 2, // Face UP (toward key vault)
          alive: true,
          hp: 100,
          shield: 50,
          lastDamageTime: 0,
          weapon: 'pistol',
          ammo: Infinity,
          reserveAmmo: Infinity,
          lastShotTime: 0,
          lastBombTime: 0,
          lastBombCount: 0,
          isReloading: false,
          reloadEndTime: 0,
          kills: 0,
          deaths: 0,
          shotsFired: 0,
          shotsHit: 0,
          damageTaken: 0,
          respawnAt: 0,
          invulnerableUntil: Date.now() + 3000,
          isBot: original.isBot || false,
          botNextDecision: 0
        };
      });
    }

    initHeistItems() {
      this.pickups = [];

      // 1. Four Central Glowing Keys in the Central Vault Room
      CENTRAL_KEY_PEDESTALS.forEach((ped, idx) => {
        this.pickups.push({
          id: `key_central_${idx + 1}`,
          x: ped.x,
          y: ped.y,
          type: 'key',
          isKey: true,
          respawnAt: 0,
          pedestalIndex: idx
        });
      });

      // 2. Weapon and Supply Pickups
      WEAPON_PICKUP_SPOTS.forEach((spot, idx) => {
        this.pickups.push({
          id: `pk_${idx + 1}`,
          x: spot.x,
          y: spot.y,
          type: spot.type,
          respawnAt: 0
        });
      });
    }

    tick() {
      const now = Date.now();
      const dt = Math.min((now - this.lastTickTime) / 1000, 0.1);
      this.lastTickTime = now;

      if (this.state === 'countdown') {
        const elapsed = (now - this.roundStartTime) / 1000;
        if (elapsed >= 3.0) {
          this.state = 'playing';
          this.roundStartTime = now;
          if (this.net.isHost) {
            this.net.setRoomState('playing', { startedAt: now });
            this.net.broadcastEvent('news', '🗝️ HEIST ACTIVE! SECURE 2 KEYS TO WIN!');
          }
        }
        return;
      }

      if (this.state !== 'playing') return;

      const elapsedRound = (now - this.roundStartTime) / 1000;
      this.roundTimeRemaining = Math.max(0, this.roundDurationSec - elapsedRound);

      // 1. Process Bots AI
      this.updateBots(now);

      // 2. Process Player Movement, Auto-Fire, Shield Regen, Vault Deposit
      this.updatePlayers(dt, now);

      // 3. Process Bombs & Timers (2.5s fuses)
      this.updateBombs(now);

      // 4. Process Projectiles & Continuous Bullet Damage
      this.updateProjectiles(dt, now);

      // 5. Update Pickups & Key Expirations (10s decay on dropped keys)
      this.updatePickups(now, dt);

      // 6. Check Time Expiration
      if (this.roundTimeRemaining <= 0) {
        this.endMatch(null, 'TIME EXPIRED');
      }

      if (this.onTick) this.onTick(this.getWorldData());
    }

    /**
     * Player movement physics with smooth 8-directional sliding
     * Speed Protection: Key carriers retain 100% full movement speed (330 px/s).
     */
    updatePlayers(dt, now) {
      const inputs = this.net.isHost ? (this.net.currentWorld?.inputs || {}) : {};

      Object.values(this.players).forEach(p => {
        if (!p.alive) {
          if (now >= p.respawnAt && p.respawnAt > 0) {
            this.respawnPlayer(p);
          }
          return;
        }

        const input = p.isBot ? (p.botInput || {}) : (inputs[p.id] || {});

        // Speed Protection: FULL speed (330 px/s), regardless of keys carried!
        const moveSpeed = 330;
        let vx = (typeof input.vx === 'number' ? input.vx : 0) * moveSpeed;
        let vy = (typeof input.vy === 'number' ? input.vy : 0) * moveSpeed;

        const mag = Math.hypot(vx, vy);
        if (mag > moveSpeed) {
          vx = (vx / mag) * moveSpeed;
          vy = (vy / mag) * moveSpeed;
        }

        p.vx = vx;
        p.vy = vy;

        if (typeof input.aimAngle === 'number') {
          p.angle = input.aimAngle;
        }

        // Apply Position with independent X and Y collision (smooth obstacle sliding)
        const nextX = p.x + vx * dt;
        const nextY = p.y + vy * dt;

        // Try X move independently
        if (!this.checkObstacleCollision(nextX, p.y, PLAYER_RADIUS)) {
          p.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, nextX));
        }

        // Try Y move independently — clamp to marathon field (0..WORLD_HEIGHT)
        if (!this.checkObstacleCollision(p.x, nextY, PLAYER_RADIUS)) {
          p.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, nextY));
        }

        // Shield Regeneration
        if (now - p.lastDamageTime >= 4000 && p.shield < 50) {
          p.shield = Math.min(50, p.shield + 15 * dt);
        }

        // Home Base Vault Standing & Deposit Logic
        const myVault = HOME_VAULTS[p.vaultIndex % HOME_VAULTS.length];
        const distToVault = Math.hypot(p.x - myVault.x, p.y - myVault.y);
        const isInsideVault = distToVault <= myVault.radius;

        if (isInsideVault && p.keysCarried > 0) {
          p.vaultStandingTime = (p.vaultStandingTime || 0) + dt;
          if (p.vaultStandingTime >= 2.0) {
            // Successfully deposit key!
            p.keysCarried = Math.max(0, p.keysCarried - 1);
            p.depositedKeys = (p.depositedKeys || 0) + 1;
            p.vaultStandingTime = 0;

            if (this.net.isHost) {
              this.net.broadcastEvent('news', `🏛️ ${p.name} SECURED A KEY IN THEIR VAULT! (${p.depositedKeys}/2)`);
            }

            // Check Win Condition: First to 2 keys wins!
            if (p.depositedKeys >= 2) {
              this.endMatch(p, 'VAULT_SECURED');
              return;
            }
          }
        } else {
          p.vaultStandingTime = 0;
        }

        // Handle Reloading
        if (p.isReloading && now >= p.reloadEndTime) {
          p.isReloading = false;
          const weaponSpec = WEAPONS[p.weapon];
          const needed = weaponSpec.magSize - p.ammo;
          const loaded = Math.min(needed, p.reserveAmmo);
          p.ammo += loaded;
          p.reserveAmmo -= loaded;
        }

        if (input.reload && !p.isReloading && p.ammo < WEAPONS[p.weapon].magSize && p.reserveAmmo > 0) {
          p.isReloading = true;
          p.reloadEndTime = now + WEAPONS[p.weapon].reloadTime;
        }

        // Handle BOMB / LANDMINE action
        const currentBombCount = input.dropBomb || 0;
        if (currentBombCount > (p.lastBombCount || 0)) {
          p.lastBombCount = currentBombCount;
          if (now - p.lastBombTime >= 1000) {
            p.lastBombTime = now;
            this.dropBomb(p, now);
          }
        }

        // Handle AUTO-FIRE
        const wantsToShoot = input.firing || (input.shootCount && input.shootCount > (p.lastShootCount || 0));
        p.lastShootCount = input.shootCount || 0;

        if (wantsToShoot && !p.isReloading) {
          const weaponSpec = WEAPONS[p.weapon];
          if (now - p.lastShotTime >= weaponSpec.fireRate) {
            if (p.ammo > 0 || p.ammo === Infinity) {
              this.fireWeapon(p, now);
            } else if (p.reserveAmmo > 0) {
              p.isReloading = true;
              p.reloadEndTime = now + weaponSpec.reloadTime;
            }
          }
        }
      });
    }

    dropBomb(player, now) {
      const bomb = {
        id: `bm_${this.nextBombId++}`,
        ownerId: player.id,
        x: player.x,
        y: player.y,
        plantedAt: now,
        fuseMs: 2500,
        damage: 95,
        radius: 170
      };

      this.bombs.push(bomb);

      if (this.net.isHost) {
        this.net.broadcastEvent('news', `💣 ${player.name} deployed a Landmine! (2.5s fuse)`);
      }
    }

    updateBombs(now) {
      const remainingBombs = [];

      this.bombs.forEach(b => {
        if (now - b.plantedAt >= b.fuseMs) {
          this.detonateBomb(b);
        } else {
          remainingBombs.push(b);
        }
      });

      this.bombs = remainingBombs;
    }

    detonateBomb(bomb) {
      if (this.net.isHost) {
        this.net.broadcastEvent('news', `💥 LANDMINE DETONATED!`);
      }

      // Detonate nearby bombs in chain
      this.bombs.forEach(other => {
        if (other.id !== bomb.id) {
          const dist = Math.hypot(other.x - bomb.x, other.y - bomb.y);
          if (dist <= bomb.radius) {
            other.plantedAt = 0;
          }
        }
      });

      // Damage players
      Object.values(this.players).forEach(p => {
        if (!p.alive) return;
        const dist = Math.hypot(p.x - bomb.x, p.y - bomb.y);
        if (dist <= bomb.radius) {
          const falloff = 1 - (dist / bomb.radius);
          const dmg = Math.round(bomb.damage * Math.max(0.25, falloff));
          this.applyDamage(p, dmg, bomb.ownerId, 'Landmine Bomb');
        }
      });

      // Damage destructible wooden walls
      this.damageNearbyDestructibleWalls(bomb.x, bomb.y, bomb.radius, bomb.damage);
    }

    damageNearbyDestructibleWalls(cx, cy, radius, damage) {
      this.obstacles.forEach(ob => {
        if (ob.type !== 'wood') return;
        const closestX = Math.max(ob.x, Math.min(cx, ob.x + ob.w));
        const closestY = Math.max(ob.y, Math.min(cy, ob.y + ob.h));
        const dist = Math.hypot(cx - closestX, cy - closestY);
        if (dist <= radius) {
          ob.hp = Math.max(0, (ob.hp || 100) - damage);
        }
      });
      // Filter out destroyed wooden walls
      this.obstacles = this.obstacles.filter(ob => ob.type !== 'wood' || ob.hp > 0);
    }

    fireWeapon(player, now) {
      const spec = WEAPONS[player.weapon];
      player.lastShotTime = now;

      if (player.ammo !== Infinity) {
        player.ammo--;
      }

      player.shotsFired += spec.pellets;

      const muzzleDist = PLAYER_RADIUS + 10;
      const muzzleX = player.x + Math.cos(player.angle) * muzzleDist;
      const muzzleY = player.y + Math.sin(player.angle) * muzzleDist;

      for (let i = 0; i < spec.pellets; i++) {
        const spreadOffset = (Math.random() - 0.5) * spec.spread;
        const fireAngle = player.angle + spreadOffset;

        const proj = {
          id: `p_${this.nextProjId++}`,
          ownerId: player.id,
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(fireAngle) * spec.speed,
          vy: Math.sin(fireAngle) * spec.speed,
          angle: fireAngle,
          damage: spec.damage,
          radius: spec.isExplosive ? 6 : 3,
          isExplosive: !!spec.isExplosive,
          splashRadius: spec.splashRadius || 0,
          color: spec.color,
          created: now,
          life: 2.2
        };

        this.projectiles.push(proj);
      }
    }

    updateProjectiles(dt, now) {
      const remainingProjectiles = [];

      this.projectiles.forEach(proj => {
        proj.life -= dt;
        if (proj.life <= 0) return;

        const nextX = proj.x + proj.vx * dt;
        const nextY = proj.y + proj.vy * dt;

        if (nextX < 0 || nextX > WORLD_WIDTH || nextY < 0 || nextY > WORLD_HEIGHT) {
          if (proj.isExplosive) this.detonateRocket(proj.x, proj.y, proj.ownerId, proj.damage, proj.splashRadius);
          return;
        }

        // Obstacle collision check
        let hitWall = null;
        for (let i = 0; i < this.obstacles.length; i++) {
          const ob = this.obstacles[i];
          if (ob.type === 'bush') continue;
          if (nextX >= ob.x && nextX <= ob.x + ob.w && nextY >= ob.y && nextY <= ob.y + ob.h) {
            hitWall = ob;
            break;
          }
        }

        if (hitWall) {
          if (hitWall.type === 'wood') {
            hitWall.hp = Math.max(0, (hitWall.hp || 100) - proj.damage);
            if (hitWall.hp <= 0) {
              this.obstacles = this.obstacles.filter(o => o.id !== hitWall.id);
            }
          }
          if (proj.isExplosive) {
            this.detonateRocket(proj.x, proj.y, proj.ownerId, proj.damage, proj.splashRadius);
          }
          return;
        }

        // Player collision check
        let hitPlayer = null;
        Object.values(this.players).forEach(p => {
          if (!p.alive || p.id === proj.ownerId) return;
          const dist = Math.hypot(p.x - nextX, p.y - nextY);
          if (dist <= PLAYER_RADIUS + proj.radius) {
            hitPlayer = p;
          }
        });

        if (hitPlayer) {
          const owner = this.players[proj.ownerId];
          if (owner) owner.shotsHit++;

          if (proj.isExplosive) {
            this.detonateRocket(proj.x, proj.y, proj.ownerId, proj.damage, proj.splashRadius);
          } else {
            this.applyDamage(hitPlayer, proj.damage, proj.ownerId, WEAPONS[owner?.weapon || 'pistol'].name);
          }
          return;
        }

        proj.x = nextX;
        proj.y = nextY;
        remainingProjectiles.push(proj);
      });

      this.projectiles = remainingProjectiles;
    }

    detonateRocket(x, y, ownerId, maxDamage, radius) {
      if (this.net.isHost) {
        this.net.broadcastEvent('news', `💥 ROCKET BLAST!`);
      }

      Object.values(this.players).forEach(p => {
        if (!p.alive) return;
        const dist = Math.hypot(p.x - x, p.y - y);
        if (dist <= radius) {
          const falloff = 1 - (dist / radius);
          const dmg = Math.round(maxDamage * Math.max(0.25, falloff));
          this.applyDamage(p, dmg, ownerId, 'Rocket Launcher');
        }
      });

      this.damageNearbyDestructibleWalls(x, y, radius, maxDamage);
    }

    applyDamage(player, amount, killerId, weaponName) {
      if (!player.alive) return;
      if (player.invulnerableUntil && Date.now() < player.invulnerableUntil) return;

      player.lastDamageTime = Date.now();
      player.damageTaken += amount;

      let remainingDmg = amount;
      if (player.shield > 0) {
        if (player.shield >= remainingDmg) {
          player.shield -= remainingDmg;
          remainingDmg = 0;
        } else {
          remainingDmg -= player.shield;
          player.shield = 0;
        }
      }

      player.hp = Math.max(0, player.hp - remainingDmg);

      if (player.hp <= 0) {
        this.eliminatePlayer(player, killerId, weaponName);
      }
    }

    eliminatePlayer(victim, killerId, weaponName) {
      victim.alive = false;
      victim.deaths++;
      // 4-second respawn timer
      victim.respawnAt = Date.now() + 4000;
      victim.vaultStandingTime = 0;

      // Drop all carried keys at exact death location with 10s expiration
      const carriedKeys = victim.keysCarried || 0;
      victim.keysCarried = 0;

      for (let k = 0; k < carriedKeys; k++) {
        const angle = (Math.PI * 2 / Math.max(1, carriedKeys)) * k;
        const dropX = Math.max(PLAYER_RADIUS + 30, Math.min(WORLD_WIDTH - PLAYER_RADIUS - 30, victim.x + Math.cos(angle) * 35));
        const dropY = Math.max(PLAYER_RADIUS + 30, Math.min(WORLD_HEIGHT - PLAYER_RADIUS - 30, victim.y + Math.sin(angle) * 35));

        this.pickups.push({
          id: `key_drop_${this.nextPickupId++}`,
          x: dropX,
          y: dropY,
          type: 'key',
          isKey: true,
          isDropped: true,
          droppedAt: Date.now(),
          decayTimeMs: 10000,
          respawnAt: 0
        });
      }

      // Always drop a Health Pack (+50 HP)
      this.pickups.push({
        id: `pk_health_${this.nextPickupId++}`,
        x: victim.x,
        y: victim.y,
        type: 'healthpack',
        respawnAt: 0,
        isDrop: true
      });

      if (victim.weapon !== 'pistol') {
        this.pickups.push({
          id: `pk_drop_${this.nextPickupId++}`,
          x: victim.x + 25,
          y: victim.y,
          type: victim.weapon,
          respawnAt: 0,
          isDrop: true
        });
      }

      victim.weapon = 'pistol';
      victim.ammo = Infinity;
      victim.reserveAmmo = Infinity;

      const killer = this.players[killerId];
      if (killer && killer.id !== victim.id) {
        killer.kills++;
        const tmpl = KILL_TEMPLATES[Math.floor(Math.random() * KILL_TEMPLATES.length)];
        const text = tmpl
          .replace('{killer}', killer.name)
          .replace('{victim}', victim.name)
          .replace('{weapon}', weaponName || 'Combat Fire');
        if (this.net.isHost) this.net.broadcastEvent('kill', text);
      } else {
        if (this.net.isHost) this.net.broadcastEvent('kill', `💀 ${victim.name} fell in battle!`);
      }
    }

    respawnPlayer(player) {
      // Respawn at their assigned bottom Home Base Vault
      const vault = HOME_VAULTS[player.vaultIndex % HOME_VAULTS.length];
      player.x = vault.x + (Math.random() - 0.5) * 40;
      player.y = vault.y + (Math.random() - 0.5) * 40;
      player.hp = 100;
      player.shield = 50;
      player.alive = true;
      player.respawnAt = 0;
      player.vaultStandingTime = 0;
      player.angle = -Math.PI / 2; // Face UP toward key vault
      player.invulnerableUntil = Date.now() + 3000;
      player.lastDamageTime = Date.now();
    }

    updatePickups(now, dt) {
      const remainingPickups = [];

      this.pickups.forEach(pk => {
        // 1. Check Dropped Key Expiration (10-second timer)
        if (pk.isKey && pk.isDropped) {
          const age = now - pk.droppedAt;
          if (age >= (pk.decayTimeMs || 10000)) {
            // Dissolve and respawn in central vault!
            this.respawnKeyInCentralVault();
            if (this.net.isHost) {
              this.net.broadcastEvent('news', `✨ An abandoned key dissolved & returned to the Central Vault!`);
            }
            return; // Dropped key removed
          }
        }

        // 2. Normal pickup respawn timer check
        if (pk.respawnAt > 0) {
          if (now >= pk.respawnAt) {
            pk.respawnAt = 0;
          }
          remainingPickups.push(pk);
          return;
        }

        // 3. Collection by alive players
        let collected = false;
        const playerList = Object.values(this.players);
        for (let i = 0; i < playerList.length; i++) {
          const p = playerList[i];
          if (!p.alive) continue;
          const dist = Math.hypot(p.x - pk.x, p.y - pk.y);
          if (dist <= PLAYER_RADIUS + 20) {
            this.handlePickupCollect(p, pk);
            collected = true;
            break;
          }
        }

        // If not collected or non-drop pickup respawning later
        if (!collected) {
          remainingPickups.push(pk);
        } else if (!pk.isDrop && !pk.isKey) {
          remainingPickups.push(pk);
        }
      });

      this.pickups = remainingPickups;
    }

    respawnKeyInCentralVault() {
      // Respawn key near the TOP vault area
      const ped = CENTRAL_KEY_PEDESTALS[Math.floor(Math.random() * CENTRAL_KEY_PEDESTALS.length)];
      this.pickups.push({
        id: `key_central_${this.nextPickupId++}`,
        x: ped.x + (Math.random() - 0.5) * 40,
        y: ped.y + (Math.random() - 0.5) * 40,
        type: 'key',
        isKey: true,
        respawnAt: 0
      });
    }

    handlePickupCollect(player, pk) {
      if (pk.isKey) {
        player.keysCarried = (player.keysCarried || 0) + 1;
        if (this.net.isHost) {
          this.net.broadcastEvent('news', `🗝️ ${player.name} grabbed a GLOWING KEY! Return to your vault!`);
        }
        return;
      }

      if (pk.type === 'healthpack') {
        if (player.hp < 100) {
          player.hp = Math.min(100, player.hp + 50);
          pk.respawnAt = pk.isDrop ? -1 : (Date.now() + 15000);
          if (this.net.isHost) this.net.broadcastEvent('news', `💚 ${player.name} recovered +50 HP!`);
        }
      } else if (pk.type === 'shield') {
        if (player.shield < 50) {
          player.shield = 50;
          pk.respawnAt = Date.now() + 18000;
          if (this.net.isHost) this.net.broadcastEvent('news', `🛡️ ${player.name} charged their Shield!`);
        }
      } else {
        const spec = WEAPONS[pk.type];
        if (spec) {
          player.weapon = pk.type;
          player.ammo = spec.magSize;
          player.reserveAmmo = spec.reserve;
          player.isReloading = false;
          pk.respawnAt = pk.isDrop ? -1 : (Date.now() + 25000);
          if (this.net.isHost) this.net.broadcastEvent('news', `🔫 ${player.name} obtained a ${spec.name}!`);
        }
      }
    }

    checkObstacleCollision(px, py, radius) {
      for (let i = 0; i < this.obstacles.length; i++) {
        const ob = this.obstacles[i];
        if (ob.type === 'bush') continue;
        const closestX = Math.max(ob.x, Math.min(px, ob.x + ob.w));
        const closestY = Math.max(ob.y, Math.min(py, ob.y + ob.h));
        const distanceX = px - closestX;
        const distanceY = py - closestY;
        if ((distanceX * distanceX + distanceY * distanceY) < (radius * radius)) {
          return true;
        }
      }
      return false;
    }

    /**
     * Smart Bot Navigation for "Fight for Survival":
     * - If Bot carries 0 keys: Moves towards Central Vault or nearest dropped key.
     * - If Bot carries >= 1 key: Navigates back towards their own designated Home Base Vault to deposit!
     * - Attacks nearby enemies and drops landmines defensively.
     */
    updateBots(now) {
      Object.values(this.players).forEach(p => {
        if (!p.isBot || !p.alive) return;

        if (!p.botNextDecision || now >= p.botNextDecision) {
          p.botNextDecision = now + 140 + Math.random() * 120;

          // Target acquisition for shooting
          let shootTarget = null;
          let minEnemyDist = 650;

          Object.values(this.players).forEach(other => {
            if (other.id === p.id || !other.alive) return;
            const dist = Math.hypot(other.x - p.x, other.y - p.y);
            if (dist < minEnemyDist) {
              minEnemyDist = dist;
              shootTarget = other;
            }
          });

          // Navigation Destination — Marathon field: top vault at (CENTRAL_VAULT_X, CENTRAL_VAULT_Y)
          let destX = CENTRAL_VAULT_X;
          let destY = CENTRAL_VAULT_Y;

          if ((p.keysCarried || 0) > 0) {
            // Carry key -> SPRINT BACK DOWN to Home Base Vault!
            const myVault = HOME_VAULTS[p.vaultIndex % HOME_VAULTS.length];
            destX = myVault.x;
            destY = myVault.y;
          } else {
            // No keys -> SEEK NEAREST UNCOLLECTED KEY (top of map)
            let nearestKey = null;
            let minKeyDist = 99999;
            this.pickups.forEach(pk => {
              if (pk.isKey && pk.respawnAt === 0) {
                const d = Math.hypot(pk.x - p.x, pk.y - p.y);
                if (d < minKeyDist) {
                  minKeyDist = d;
                  nearestKey = pk;
                }
              }
            });

            if (nearestKey) {
              destX = nearestKey.x;
              destY = nearestKey.y;
            } else {
              destX = CENTRAL_VAULT_X;
              destY = CENTRAL_VAULT_Y;
            }
          }

          // Move direction towards destination
          const moveAngle = Math.atan2(destY - p.y, destX - p.x);
          let aimAngle = moveAngle;
          let firing = false;
          let dropBomb = p.botInput?.dropBomb || 0;

          if (shootTarget) {
            aimAngle = Math.atan2(shootTarget.y - p.y, shootTarget.x - p.x);
            firing = true;
            // Drop defensive landmine if pursued closely
            if (minEnemyDist < 160 && (p.keysCarried || 0) > 0 && Math.random() < 0.3) {
              dropBomb++;
            }
          }

          p.botInput = {
            vx: Math.cos(moveAngle),
            vy: Math.sin(moveAngle),
            aimAngle: aimAngle,
            firing: firing,
            dropBomb: dropBomb,
            shootCount: (p.botInput?.shootCount || 0) + (firing ? 1 : 0)
          };
        }
      });
    }

    endMatch(winnerPlayer, reason) {
      if (this.state === 'ended') return;
      this.state = 'ended';

      let winner = winnerPlayer;
      if (!winner) {
        // If timed out, pick player with most deposited keys, then kills
        const list = Object.values(this.players);
        list.sort((a, b) => (b.depositedKeys || 0) - (a.depositedKeys || 0) || b.kills - a.kills);
        winner = list[0];
      }

      const awards = this.computeAwards();

      if (this.net.isHost) {
        this.net.setRoomState('ended', {
          winnerId: winner ? winner.id : null,
          winnerName: winner ? winner.name : 'Nobody',
          reason: reason || 'VAULT_SECURED',
          awards: awards
        });

        const victoryMsg = winner
          ? `🏆 ${winner.name} SECURED EXTRACTION WITH ${winner.depositedKeys || 0} KEYS DEPOSITED!`
          : `OPERATION COMPLETE!`;
        this.net.broadcastEvent('kill', victoryMsg);
      }

      if (this.onRoundEnd) this.onRoundEnd(winner, awards);
    }

    computeAwards() {
      const list = Object.values(this.players);
      if (list.length === 0) return {};

      // Master Thief (most deposited keys)
      const mvp = list.reduce((best, p) => ((p.depositedKeys || 0) > (best?.depositedKeys || 0) ? p : best), list[0]);

      // Sharpshooter
      const sharpshooter = list.reduce((best, p) => {
        const acc = p.shotsFired >= 5 ? (p.shotsHit / p.shotsFired) : 0;
        const bestAcc = best.shotsFired >= 5 ? (best.shotsHit / best.shotsFired) : 0;
        return acc > bestAcc ? p : best;
      }, list[0]);

      const sharpshooterPct = sharpshooter.shotsFired > 0 
        ? Math.round((sharpshooter.shotsHit / sharpshooter.shotsFired) * 100) 
        : 0;

      // Eliminator
      const spray = list.reduce((max, p) => (p.kills > (max?.kills || 0) ? p : max), list[0]);
      // Combat Tank
      const tank = list.reduce((max, p) => (p.damageTaken > (max?.damageTaken || 0) ? p : max), list[0]);

      return {
        mvp: { id: mvp.id, name: mvp.name, deposits: mvp.depositedKeys || 0, kills: mvp.kills },
        sharpshooter: { id: sharpshooter.id, name: sharpshooter.name, accuracy: sharpshooterPct },
        spray: { id: spray.id, name: spray.name, kills: spray.kills },
        tank: { id: tank.id, name: tank.name, damage: Math.round(tank.damageTaken) }
      };
    }

    broadcastSnapshot() {
      if (!this.net.isHost) return;
      this.net.publishWorldSnapshot(this.getWorldData());
    }

    getWorldData() {
      const safePlayers = {};
      Object.values(this.players).forEach(p => {
        safePlayers[p.id] = {
          ...p,
          ammo: p.ammo === Infinity ? -1 : p.ammo,
          reserveAmmo: p.reserveAmmo === Infinity ? -1 : p.reserveAmmo
        };
      });

      return {
        players: safePlayers,
        projectiles: this.projectiles,
        bombs: this.bombs,
        pickups: this.pickups,
        obstacles: this.obstacles,
        homeVaults: HOME_VAULTS,
        centralVaultX: CENTRAL_VAULT_X,
        centralVaultY: CENTRAL_VAULT_Y,
        roundTimeRemaining: this.roundTimeRemaining
      };
    }

    stop() {
      if (this.tickInterval) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
      }
      if (this.snapshotInterval) {
        clearInterval(this.snapshotInterval);
        this.snapshotInterval = null;
      }
      this.state = 'idle';
    }
  }

  window.ArenaSimulation = ArenaSimulation;
  window.HOME_VAULTS = HOME_VAULTS;
})(window);
