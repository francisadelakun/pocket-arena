/**
 * POCKET ARENA — "Fight for Survival" Game & Canvas Engine (`game.js`)
 * 
 * 4-Player Tactical Heist & Extraction:
 * - Locked Center Camera Viewport: Local player is ALWAYS locked to the exact screen center
 * - Off-Screen Directional Indicators: Radar pointers for Enemies, Central Key Vault, and Home Base
 * - Scaled 120x120px Tactical Blocks: Stone bunker pillars & destructible wooden crates with HP bars
 * - COD Mobile-style Dual Joysticks: Left Move (bottom-left), Right Aim & Auto-Fire (bottom-right)
 * - Dedicated BOMB / LANDMINE button above right stick + PC Space / B keys
 * - In-Game Top-Right "QUIT GAME" button with graceful disconnect and return to landing
 * - Prominent 4-letter Room Code display with 1-click "Copy Code" button
 * - Web Audio API SFX: gunshots, explosions, key pickup chimes, vault deposit clangs, victory fanfare
 * - Live HUD: Keys held, Vault deposits (0/2), 2.0s vault deposit progress overlay
 */

(function () {
  'use strict';

  const WORLD_WIDTH = 2400;
  const WORLD_HEIGHT = 3600;

  // Sound Synthesizer via Web Audio API
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.isMuted = false;
      this.initContext();
    }

    initContext() {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      } catch (e) {
        console.warn('Web Audio not supported');
      }
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      return this.isMuted;
    }

    playPistol() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(460, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    }

    playRifle() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(580, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, this.ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    }

    playShotgun() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.16);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.16);
    }

    playRocket() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.32);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.32);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.32);
    }

    playBombPlant() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    }

    playExplosion() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const bufferSize = this.ctx.sampleRate * 0.45;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.12));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.45);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.45);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
      noise.stop(this.ctx.currentTime + 0.45);
    }

    playKeyPickup() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, this.ctx.currentTime + 0.16);
      osc.frequency.setValueAtTime(1046.50, this.ctx.currentTime + 0.24);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    }

    playKeyDeposit() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.15);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(330, this.ctx.currentTime + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc1.stop(this.ctx.currentTime + 0.2);
      osc2.start(this.ctx.currentTime + 0.15);
      osc2.stop(this.ctx.currentTime + 0.5);
    }

    playVictory() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);

        gain.gain.setValueAtTime(0.35, this.ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + idx * 0.12);
        osc.stop(this.ctx.currentTime + idx * 0.12 + 0.35);
      });
    }

    playHit() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    }

    playTaunt() {
      if (this.isMuted || !this.ctx) return;
      this.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    }
  }

  // Floating Taunt Emojis
  class FloatingEmoji {
    constructor(x, y, emoji) {
      this.x = x;
      this.y = y;
      this.emoji = emoji;
      this.life = 1.0;
      this.vy = -35;
    }

    update(dt) {
      this.y += this.vy * dt;
      this.life -= dt * 0.65;
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.font = '22px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.emoji, this.x, this.y);
      ctx.restore();
    }
  }

  // Visual Particles (Splinters, Sparks, Smoke)
  class Particle {
    constructor(x, y, color, vx, vy, size, life) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.vx = vx;
      this.vy = vy;
      this.size = size;
      this.life = life;
      this.maxLife = life;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class PocketArenaGame {
    constructor() {
      this.net = new window.NetManager();
      this.sim = new window.ArenaSimulation(this.net);
      this.sfx = new SoundFX();

      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;

      // Camera coordinates (world space) — start near bottom vaults where players spawn
      this.camera = { x: 1100, y: 3400 };
      this.particles = [];
      this.floatingEmojis = [];
      this.muzzleFlashes = {};

      // Input State
      this.keyState = {
        w: false, s: false, a: false, d: false,
        shoot: false
      };
      this.mousePos = { x: this.viewportWidth / 2, y: this.viewportHeight / 2 };
      this.aimAngle = 0;
      this.isMouseDown = false;
      this.shootCount = 0;
      this.dropBombCount = 0;
      this.lastShotTimeLocal = 0;

      // Mobile Joysticks
      this.moveStick = { active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0, vx: 0, vy: 0 };
      this.aimStick = { active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0, angle: 0, firing: false };

      this.vibrationEnabled = false;
      this.lastLocalKeysCarried = 0;
      this.lastLocalDeposits = 0;
      this.lastLocalHp = 100;
      this.isRunning = true;

      this.init();
    }

    init() {
      this.setupCanvas();
      this.bindDOM();
      this.bindInputs();
      this.bindNetworkCallbacks();
      this.loadSavedConfig();

      requestAnimationFrame((t) => this.loop(t));
    }

    setupCanvas() {
      const resize = () => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);
        // On mobile, cap DPR to 1 for high frame-rate rendering and low GPU/battery load
        const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
        this.viewportWidth = window.innerWidth;
        this.viewportHeight = window.innerHeight;

        this.canvas.width = Math.round(this.viewportWidth * dpr);
        this.canvas.height = Math.round(this.viewportHeight * dpr);
        this.canvas.style.width = `${this.viewportWidth}px`;
        this.canvas.style.height = `${this.viewportHeight}px`;

        this.ctx.resetTransform?.();
        this.ctx.scale(dpr, dpr);
      };

      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', () => setTimeout(resize, 200));
      resize();
    }

    bindDOM() {
      // Landing screen buttons
      document.getElementById('btn-create-room')?.addEventListener('click', () => this.handleCreateRoom());
      document.getElementById('btn-join-room')?.addEventListener('click', () => this.handleJoinRoom());
      document.getElementById('btn-random-name')?.addEventListener('click', () => {
        const name = this.net.generateFunnyName();
        this.net.setPlayerName(name);
        const nameInput = document.getElementById('input-player-name');
        if (nameInput) nameInput.value = name;
      });

      const nameInput = document.getElementById('input-player-name');
      if (nameInput) {
        nameInput.value = this.net.playerName;
        nameInput.addEventListener('change', (e) => this.net.setPlayerName(e.target.value));
      }

      document.getElementById('btn-cycle-avatar')?.addEventListener('click', () => {
        const av = this.net.cycleAvatar();
        const avPreview = document.getElementById('player-avatar-preview');
        if (avPreview) avPreview.textContent = av;
      });

      // Lobby buttons
      document.getElementById('btn-start-game')?.addEventListener('click', () => {
        if (this.net.isHost) {
          this.sim.startNewRound(this.net.currentPlayers);
        }
      });

      document.getElementById('btn-add-dummy-bot')?.addEventListener('click', () => {
        this.net.addDummyBot();
      });

      // Easy Copy 4-Letter Code Button
      document.getElementById('btn-copy-room-code')?.addEventListener('click', () => {
        const code = this.net.roomCode || this.net.generateRoomCode();
        navigator.clipboard?.writeText(code).then(() => {
          const status = document.getElementById('copy-status-text');
          if (status) {
            status.textContent = `📋 Copied Room Code: [${code}]`;
            setTimeout(() => { status.textContent = 'Share this code with your squad!'; }, 2500);
          }
        });
      });

      // Copy Link Button (Intelligently resolves local IP when on localhost so phones can connect!)
      const getShareableInviteUrl = (code) => {
        let base = window.location.origin;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          base = 'http://10.135.161.61:8000';
        }
        return `${base}${window.location.pathname}?room=${code}`;
      };

      document.getElementById('btn-copy-room-link')?.addEventListener('click', () => {
        const code = this.net.roomCode || this.net.generateRoomCode();
        const url = getShareableInviteUrl(code);
        navigator.clipboard?.writeText(url).then(() => {
          const status = document.getElementById('copy-status-text');
          if (status) {
            status.textContent = '🔗 Copied invite link for Mobile / PC!';
            setTimeout(() => { status.textContent = 'Share this code with your squad!'; }, 2500);
          }
        });
      });

      document.getElementById('btn-copy-mobile-url')?.addEventListener('click', () => {
        const code = this.net.roomCode || this.net.generateRoomCode();
        const url = getShareableInviteUrl(code);
        navigator.clipboard?.writeText(url).then(() => {
          const btn = document.getElementById('btn-copy-mobile-url');
          if (btn) {
            btn.textContent = '✓ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
          }
        });
      });

      document.getElementById('btn-leave-lobby')?.addEventListener('click', () => {
        this.net.leaveRoom();
        this.showScreen('screen-landing');
      });

      document.getElementById('btn-back-to-landing')?.addEventListener('click', () => {
        this.showScreen('screen-landing');
      });

      // In-game QUIT GAME Button
      document.getElementById('btn-quit-game')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to abandon the heist and return to base?')) {
          this.quitMatch();
        }
      });

      // Dedicated Mobile Bomb / Mine button
      document.getElementById('btn-action-bomb')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerBombDrop();
      });

      document.getElementById('btn-mobile-reload')?.addEventListener('click', () => {
        this.sendShooterInput(null, true);
      });

      // Sound toggle
      document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
        const muted = this.sfx.toggleMute();
        const icon = document.getElementById('icon-sound');
        if (icon) icon.textContent = muted ? '🔇' : '🔊';
      });

      // Settings modal
      document.getElementById('btn-open-settings')?.addEventListener('click', () => {
        document.getElementById('modal-settings')?.classList.remove('hidden');
      });
      document.getElementById('btn-close-settings')?.addEventListener('click', () => {
        document.getElementById('modal-settings')?.classList.add('hidden');
      });

      document.getElementById('btn-save-settings')?.addEventListener('click', () => {
        this.saveFirebaseConfig();
      });

      document.getElementById('btn-demo-mode')?.addEventListener('click', () => {
        document.getElementById('modal-settings')?.classList.add('hidden');
        this.startOfflineSimulation();
      });

      document.getElementById('toggle-vibration')?.addEventListener('change', (e) => {
        this.vibrationEnabled = e.target.checked;
        localStorage.setItem('pa_vibrate', this.vibrationEnabled ? '1' : '0');
      });

      // Rematch & Awards buttons
      document.getElementById('btn-rematch')?.addEventListener('click', () => {
        document.getElementById('modal-awards')?.classList.add('hidden');
        if (this.net.isHost) {
          this.sim.startNewRound(this.net.currentPlayers);
        }
      });

      document.getElementById('btn-return-lobby')?.addEventListener('click', () => {
        document.getElementById('modal-awards')?.classList.add('hidden');
        this.showScreen('screen-lobby');
      });

      // Taunts
      document.getElementById('btn-toggle-taunt')?.addEventListener('click', () => {
        const menu = document.getElementById('taunt-menu');
        menu?.classList.toggle('hidden');
      });

      document.querySelectorAll('.btn-taunt').forEach(btn => {
        btn.addEventListener('click', () => {
          const emoji = btn.getAttribute('data-taunt');
          if (emoji) this.triggerTaunt(emoji);
          document.getElementById('taunt-menu')?.classList.add('hidden');
        });
      });

      // Check URL search params for instant room join
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        const roomInput = document.getElementById('input-room-code');
        if (roomInput) roomInput.value = roomParam.toUpperCase();
      }
    }

    bindInputs() {
      // 1. Keyboard Controls (Full 8-Directional WASD & Arrows, Space/J/K/F/Enter Shoot, B/Q/X Bomb)
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const key = e.key.toLowerCase();
        const code = e.code;

        // Movement (8-directional WASD + Arrow keys)
        if (key === 'w' || key === 'arrowup') this.keyState.w = true;
        if (key === 's' || key === 'arrowdown') this.keyState.s = true;
        if (key === 'a' || key === 'arrowleft') this.keyState.a = true;
        if (key === 'd' || key === 'arrowright') this.keyState.d = true;

        // Dedicated Shoot Keys for Laptop & PC (Space, J, K, F, Enter)
        // Works simultaneously and independently while movement keys are held down!
        if (key === ' ' || code === 'Space' || key === 'j' || key === 'k' || key === 'f' || key === 'enter') {
          e.preventDefault();
          if (!this.keyState.shoot) {
            this.shootCount++;
            this.playLocalWeaponSound();
          }
          this.keyState.shoot = true;
        }

        // Dedicated Bomb / Landmine Keys (B, Q, X)
        if (key === 'b' || key === 'q' || key === 'x') {
          e.preventDefault();
          this.triggerBombDrop();
        }

        // Reload
        if (key === 'r') {
          this.sendShooterInput(null, true);
        }
      });

      window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        const code = e.code;

        // Release movement keys
        if (key === 'w' || key === 'arrowup') this.keyState.w = false;
        if (key === 's' || key === 'arrowdown') this.keyState.s = false;
        if (key === 'a' || key === 'arrowleft') this.keyState.a = false;
        if (key === 'd' || key === 'arrowright') this.keyState.d = false;

        // Release shoot keys
        if (key === ' ' || code === 'Space' || key === 'j' || key === 'k' || key === 'f' || key === 'enter') {
          this.keyState.shoot = false;
        }
      });

      window.addEventListener('blur', () => {
        Object.keys(this.keyState).forEach(k => { this.keyState[k] = false; });
        this.isMouseDown = false;
      });

      // 2. Mouse Aim & Click Fire (Window-level so clicks are never swallowed while moving)
      window.addEventListener('mousemove', (e) => {
        this.mousePos.x = e.clientX;
        this.mousePos.y = e.clientY;
      });

      window.addEventListener('mousedown', (e) => {
        // Ignore clicks on UI buttons, inputs, modals, or mobile joystick anchors
        if (e.target.tagName === 'INPUT' || e.target.closest('button') || e.target.closest('#modal-settings') || e.target.closest('#modal-awards') || e.target.closest('#joystick-move-container') || e.target.closest('#joystick-aim-container') || e.target.closest('#btn-bomb-container')) {
          return;
        }
        if (e.button === 0) {
          this.isMouseDown = true;
          this.shootCount++;
          this.playLocalWeaponSound();
        }
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
          this.isMouseDown = false;
        }
      });

      // 3. Ergonomic Mobile Dual Joysticks
      this.bindMobileJoysticks();
    }

    bindMobileJoysticks() {
      const moveZone = document.getElementById('joystick-move-zone');
      const moveThumb = document.getElementById('joystick-move-thumb');
      const aimZone = document.getElementById('joystick-aim-zone');
      const aimThumb = document.getElementById('joystick-aim-thumb');

      if (!moveZone || !aimZone) return;

      moveZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        const rect = moveZone.getBoundingClientRect();
        this.moveStick.active = true;
        this.moveStick.id = t.identifier;
        this.moveStick.startX = rect.left + rect.width / 2;
        this.moveStick.startY = rect.top + rect.height / 2;
        this.updateMoveThumb(t.clientX, t.clientY);
      }, { passive: false });

      moveZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.moveStick.id) {
            this.updateMoveThumb(t.clientX, t.clientY);
            break;
          }
        }
      }, { passive: false });

      const endMove = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.moveStick.id) {
            this.moveStick.active = false;
            this.moveStick.id = null;
            this.moveStick.vx = 0;
            this.moveStick.vy = 0;
            if (moveThumb) moveThumb.style.transform = `translate(0px, 0px)`;
            break;
          }
        }
      };

      moveZone.addEventListener('touchend', endMove);
      moveZone.addEventListener('touchcancel', endMove);

      aimZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        const rect = aimZone.getBoundingClientRect();
        this.aimStick.active = true;
        this.aimStick.id = t.identifier;
        this.aimStick.startX = rect.left + rect.width / 2;
        this.aimStick.startY = rect.top + rect.height / 2;
        this.updateAimThumb(t.clientX, t.clientY);
      }, { passive: false });

      aimZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.aimStick.id) {
            this.updateAimThumb(t.clientX, t.clientY);
            break;
          }
        }
      }, { passive: false });

      const endAim = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.aimStick.id) {
            this.aimStick.active = false;
            this.aimStick.id = null;
            this.aimStick.firing = false;
            if (aimThumb) aimThumb.style.transform = `translate(0px, 0px)`;
            break;
          }
        }
      };

      aimZone.addEventListener('touchend', endAim);
      aimZone.addEventListener('touchcancel', endAim);
    }

    updateMoveThumb(clientX, clientY) {
      const moveThumb = document.getElementById('joystick-move-thumb');
      const maxR = 45;
      const dx = clientX - this.moveStick.startX;
      const dy = clientY - this.moveStick.startY;
      const dist = Math.hypot(dx, dy);

      if (dist === 0) {
        this.moveStick.vx = 0;
        this.moveStick.vy = 0;
        if (moveThumb) moveThumb.style.transform = `translate(0px, 0px)`;
        return;
      }

      const clampedDist = Math.min(dist, maxR);
      const angle = Math.atan2(dy, dx);
      const ox = Math.cos(angle) * clampedDist;
      const oy = Math.sin(angle) * clampedDist;

      if (moveThumb) {
        moveThumb.style.transform = `translate(${ox}px, ${oy}px)`;
      }

      this.moveStick.vx = ox / maxR;
      this.moveStick.vy = oy / maxR;
    }

    updateAimThumb(clientX, clientY) {
      const aimThumb = document.getElementById('joystick-aim-thumb');
      const maxR = 45;
      const dx = clientX - this.aimStick.startX;
      const dy = clientY - this.aimStick.startY;
      const dist = Math.hypot(dx, dy);

      if (dist < 10) {
        this.aimStick.firing = false;
        if (aimThumb) aimThumb.style.transform = `translate(0px, 0px)`;
        return;
      }

      const clampedDist = Math.min(dist, maxR);
      const angle = Math.atan2(dy, dx);
      const ox = Math.cos(angle) * clampedDist;
      const oy = Math.sin(angle) * clampedDist;

      if (aimThumb) {
        aimThumb.style.transform = `translate(${ox}px, ${oy}px)`;
      }

      this.aimStick.angle = angle;
      this.aimAngle = angle;
      this.aimStick.firing = true;
      this.shootCount++;
    }

    triggerBombDrop() {
      this.dropBombCount++;
      this.sfx.playBombPlant();
      this.sendShooterInput();
    }

    playLocalWeaponSound() {
      const me = this.sim.players[this.net.playerId] || (this.net.currentWorld?.players?.[this.net.playerId]);
      const weapon = me?.weapon || 'pistol';

      if (weapon === 'rifle') this.sfx.playRifle();
      else if (weapon === 'shotgun') this.sfx.playShotgun();
      else if (weapon === 'rocket') this.sfx.playRocket();
      else this.sfx.playPistol();

      this.muzzleFlashes[this.net.playerId] = performance.now() + 65;
    }

    triggerLightDamageVibration() {
      if (!this.vibrationEnabled) return;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(5);
        } catch (e) {}
      }
    }

    triggerTaunt(emoji) {
      this.sendShooterInput(emoji);
      this.sfx.playTaunt();

      const myPlayer = this.sim.players[this.net.playerId] || (this.net.currentWorld?.players?.[this.net.playerId]);
      if (myPlayer) {
        this.floatingEmojis.push(new FloatingEmoji(myPlayer.x, myPlayer.y - 35, emoji));
      }
    }

    bindNetworkCallbacks() {
      this.net.onStateChange = (meta) => {
        if (!meta) return;

        if (meta.state === 'lobby') {
          this.showScreen('screen-lobby');
          this.updateLobbyUI();
        } else if (meta.state === 'countdown') {
          this.showScreen('screen-game');
          this.showCountdown(meta.countdownSec || 3);
        } else if (meta.state === 'playing') {
          this.showScreen('screen-game');
          document.getElementById('overlay-countdown')?.classList.add('hidden');
        } else if (meta.state === 'ended') {
          this.showAwards(meta.winnerName, meta.awards);
        }
      };

      this.net.onPlayersChange = (players) => {
        this.updateLobbyUI();
      };

      this.net.onWorldSnapshot = (world) => {
        if (!this.net.isHost && world) {
          const me = world.players?.[this.net.playerId];
          if (me) {
            if (me.hp < this.lastLocalHp) {
              this.sfx.playHit();
              this.triggerLightDamageVibration();
            }
            if ((me.keysCarried || 0) > this.lastLocalKeysCarried) {
              this.sfx.playKeyPickup();
            }
            if ((me.depositedKeys || 0) > this.lastLocalDeposits) {
              this.sfx.playKeyDeposit();
            }
            this.lastLocalHp = me.hp;
            this.lastLocalKeysCarried = me.keysCarried || 0;
            this.lastLocalDeposits = me.depositedKeys || 0;
          }
        }
      };

      this.net.onEventBroadcast = (evt) => {
        this.addFeedItem(evt.text, evt.type === 'kill' ? 'text-rose-400 font-bold' : 'text-amber-300');
        if (evt.text.includes('SECURED A KEY')) {
          this.sfx.playKeyDeposit();
        } else if (evt.text.includes('grabbed a GLOWING KEY')) {
          this.sfx.playKeyPickup();
        } else if (evt.text.includes('DETONATED') || evt.text.includes('BLAST')) {
          this.sfx.playExplosion();
        }
      };

      this.sim.onRoundEnd = (winner, awards) => {
        this.sfx.playVictory();
        this.showAwards(winner?.name, awards);
      };
    }

    async handleCreateRoom() {
      const createBtn = document.getElementById('btn-create-room');
      const origHtml = createBtn ? createBtn.innerHTML : '<span>👑</span> DEPLOY SQUAD (HOST)';
      if (createBtn) {
        createBtn.innerHTML = '<span>⏳</span> DEPLOYING SQUAD...';
        createBtn.disabled = true;
      }

      try {
        const code = await this.net.createRoom();
        this.updateRoomCodeDisplay(code);
        this.showScreen('screen-lobby');
      } catch (err) {
        alert(err.message || 'Error creating room.');
      } finally {
        if (createBtn) {
          createBtn.innerHTML = origHtml;
          createBtn.disabled = false;
        }
      }
    }

    async handleJoinRoom() {
      const codeInput = document.getElementById('input-room-code');
      const joinBtn = document.getElementById('btn-join-room');
      const code = (codeInput?.value || '').trim().toUpperCase();
      if (!code || code.length < 4) {
        alert('Please enter a valid 4-letter room code.');
        return;
      }

      const origText = joinBtn ? joinBtn.textContent : 'JOIN';
      if (joinBtn) {
        joinBtn.textContent = 'CONNECTING...';
        joinBtn.disabled = true;
      }

      try {
        const joinedCode = await this.net.joinRoom(code);
        this.updateRoomCodeDisplay(joinedCode);
        this.showScreen('screen-lobby');
      } catch (err) {
        alert(err.message || 'Error joining room.');
      } finally {
        if (joinBtn) {
          joinBtn.textContent = origText;
          joinBtn.disabled = false;
        }
      }
    }

    startOfflineSimulation() {
      this.net.startLocalDemo();
      this.updateRoomCodeDisplay(this.net.roomCode);
      this.showScreen('screen-lobby');

      // Pre-add 3 AI bots for an instant 4-player heist experience!
      this.net.addDummyBot();
      this.net.addDummyBot();
      this.net.addDummyBot();
    }

    updateRoomCodeDisplay(code) {
      const lobbyCode = document.getElementById('lobby-code-display');
      const headerCode = document.getElementById('header-room-code');
      const hudCode = document.getElementById('hud-room-code');
      const headerBadge = document.getElementById('header-room-badge');
      const mobileUrlEl = document.getElementById('mobile-hotspot-url');

      if (lobbyCode) lobbyCode.textContent = code;
      if (headerCode) headerCode.textContent = code;
      if (hudCode) hudCode.textContent = code;
      if (headerBadge) headerBadge.classList.remove('hidden');

      if (mobileUrlEl) {
        let base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? 'http://10.135.161.61:8000'
          : window.location.origin;
        mobileUrlEl.textContent = `${base}/?room=${code}`;
      }
    }

    updateLobbyUI() {
      const players = this.net.currentPlayers || {};
      const playerList = Object.values(players);
      const countEl = document.getElementById('lobby-player-count');
      const listEl = document.getElementById('lobby-players-list');
      const startBtn = document.getElementById('btn-start-game');
      const addBotBtn = document.getElementById('btn-add-dummy-bot');
      const waitingNotice = document.getElementById('lobby-waiting-notice');

      if (countEl) countEl.textContent = `${playerList.length} / 4`;

      if (listEl) {
        listEl.innerHTML = playerList.map(p => {
          const isHost = (p.id === this.net.currentMeta?.hostId);
          const isMe = (p.id === this.net.playerId);
          const vaultCorners = ['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right'];
          const cornerLabel = vaultCorners[p.vaultIndex % 4] || 'Base';

          return `
            <div class="flex items-center justify-between bg-slate-950/80 border ${isMe ? 'border-amber-400/60' : 'border-slate-800'} rounded-2xl px-3 py-2">
              <div class="flex items-center space-x-2.5">
                <span class="text-2xl">${p.avatar || '🪖'}</span>
                <div>
                  <div class="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>${p.name}</span>
                    ${isMe ? '<span class="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-400 rounded-md font-mono">YOU</span>' : ''}
                    ${isHost ? '<span class="text-[9px] px-1.5 py-0.2 bg-yellow-500/20 text-yellow-300 rounded-md font-mono">LEADER</span>' : ''}
                  </div>
                  <div class="text-[9px] text-slate-400 font-mono">Home Base: ${cornerLabel}</div>
                </div>
              </div>
              <div class="w-3.5 h-3.5 rounded-full border border-slate-700" style="background-color: ${p.color};"></div>
            </div>
          `;
        }).join('');
      }

      if (this.net.isHost) {
        startBtn?.classList.remove('hidden');
        addBotBtn?.classList.toggle('hidden', playerList.length >= 4);
        waitingNotice?.classList.add('hidden');
      } else {
        startBtn?.classList.add('hidden');
        addBotBtn?.classList.add('hidden');
        waitingNotice?.classList.remove('hidden');
      }
    }

    showScreen(screenId) {
      ['screen-landing', 'screen-lobby', 'screen-locked', 'screen-game'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== screenId);
      });
    }

    quitMatch() {
      // 1. Stop local simulation loop
      this.sim.stop();

      // 2. Disconnect & cleanup network session
      this.net.leaveRoom();

      // 3. Reset visual fx & particles
      this.particles = [];
      this.floatingEmojis = [];
      this.muzzleFlashes = {};
      this.isMouseDown = false;
      Object.keys(this.keyState).forEach(k => { this.keyState[k] = false; });
      this.moveStick.active = false;
      this.aimStick.active = false;

      // 4. Hide overlays
      document.getElementById('overlay-countdown')?.classList.add('hidden');
      document.getElementById('overlay-respawn')?.classList.add('hidden');
      document.getElementById('overlay-vault-progress')?.classList.add('hidden');
      document.getElementById('modal-awards')?.classList.add('hidden');

      // 5. Reset header status & return to Landing Screen
      const headerCode = document.getElementById('header-room-code');
      const headerBadge = document.getElementById('header-room-badge');
      if (headerCode) headerCode.textContent = '----';
      if (headerBadge) headerBadge.classList.add('hidden');

      this.showScreen('screen-landing');
    }

    showCountdown(seconds) {
      const overlay = document.getElementById('overlay-countdown');
      const numEl = document.getElementById('countdown-number');
      if (!overlay || !numEl) return;

      overlay.classList.remove('hidden');
      numEl.textContent = seconds;
      let count = seconds;

      const timer = setInterval(() => {
        count--;
        if (count > 0) {
          numEl.textContent = count;
        } else {
          clearInterval(timer);
          overlay.classList.add('hidden');
        }
      }, 1000);
    }

    showAwards(winnerName, awards = {}) {
      const modal = document.getElementById('modal-awards');
      if (!modal) return;

      modal.classList.remove('hidden');

      const title = document.getElementById('awards-winner-title');
      const sub = document.getElementById('awards-winner-subtitle');
      if (title) title.textContent = winnerName ? `${winnerName.toUpperCase()} SECURED THE HEIST!` : 'EXTRACTION FINISHED!';
      if (sub) sub.textContent = 'Operation successfully completed.';

      // MVP / Master Thief
      const mvp = awards.mvp || {};
      const mvpName = document.getElementById('award-mvp-name');
      const mvpDesc = document.getElementById('award-mvp-desc');
      if (mvpName) mvpName.textContent = mvp.name || '---';
      if (mvpDesc) mvpDesc.textContent = `${mvp.deposits || 0} keys deposited`;

      // Sharpshooter
      const sharpshooter = awards.sharpshooter || {};
      const sName = document.getElementById('award-sharpshooter-name');
      const sDesc = document.getElementById('award-sharpshooter-desc');
      if (sName) sName.textContent = sharpshooter.name || '---';
      if (sDesc) sDesc.textContent = `${sharpshooter.accuracy || 0}% accuracy`;

      // Eliminator
      const spray = awards.spray || {};
      const sprayName = document.getElementById('award-spray-name');
      const sprayDesc = document.getElementById('award-spray-desc');
      if (sprayName) sprayName.textContent = spray.name || '---';
      if (sprayDesc) sprayDesc.textContent = `${spray.kills || 0} frags`;

      // Tank
      const tank = awards.tank || {};
      const tankName = document.getElementById('award-tank-name');
      const tankDesc = document.getElementById('award-tank-desc');
      if (tankName) tankName.textContent = tank.name || '---';
      if (tankDesc) tankDesc.textContent = `${tank.damage || 0} damage taken`;
    }

    addFeedItem(text, colorClass) {
      const feed = document.getElementById('hud-killfeed');
      if (!feed) return;

      const item = document.createElement('div');
      item.className = `px-2.5 py-0.5 rounded-lg bg-slate-950/80 border border-slate-800 ${colorClass} text-[10px] animate-fade-in shadow-md`;
      item.textContent = text;
      feed.appendChild(item);

      setTimeout(() => {
        item.style.opacity = '0';
        item.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => item.remove(), 500);
      }, 4000);
    }

    sendShooterInput(tauntEmoji = null, isReload = false) {
      let vx = 0;
      let vy = 0;

      if (this.moveStick.active) {
        vx = this.moveStick.vx;
        vy = this.moveStick.vy;
      } else {
        if (this.keyState.w) vy -= 1;
        if (this.keyState.s) vy += 1;
        if (this.keyState.a) vx -= 1;
        if (this.keyState.d) vx += 1;

        const mag = Math.hypot(vx, vy);
        if (mag > 0) {
          vx /= mag;
          vy /= mag;
        }
      }

      // Calculate aim angle from exact screen center where player is locked
      if (this.aimStick.active) {
        this.aimAngle = this.aimStick.angle;
      } else {
        const cx = this.viewportWidth / 2;
        const cy = this.viewportHeight / 2;
        this.aimAngle = Math.atan2(this.mousePos.y - cy, this.mousePos.x - cx);
      }

      const firing = this.aimStick.active ? this.aimStick.firing : (this.isMouseDown || this.keyState.shoot);

      this.net.sendShooterInput({
        vx: vx,
        vy: vy,
        aimAngle: this.aimAngle,
        firing: firing,
        shootCount: this.shootCount,
        dropBomb: this.dropBombCount,
        reload: isReload,
        taunt: tauntEmoji
      });
    }

    // ================= MAIN RENDER LOOP =================
    loop(timestamp) {
      requestAnimationFrame((t) => this.loop(t));

      // Throttle input streaming to Host/Sim (~20Hz / 50ms) to prevent network queuing on mobile Wi-Fi
      const now = performance.now();
      if (!this._lastInputSend || (now - this._lastInputSend) >= 50) {
        this._lastInputSend = now;
        this.sendShooterInput();
      }

      // Update local particles
      const dt = 0.016;
      this.particles.forEach(p => p.update(dt));
      this.particles = this.particles.filter(p => p.life > 0);

      this.floatingEmojis.forEach(e => e.update(dt));
      this.floatingEmojis = this.floatingEmojis.filter(e => e.life > 0);

      // Render Active Game Frame
      if (!document.getElementById('screen-game')?.classList.contains('hidden')) {
        this.draw();
        this.updateHUD();
      }
    }

    updateHUD() {
      const world = this.sim.state !== 'idle' ? this.sim.getWorldData() : (this.net.currentWorld || {});
      const players = this.sim.players && Object.keys(this.sim.players).length > 0 ? this.sim.players : (world.players || {});
      const me = players[this.net.playerId];

      if (!me) return;

      // Audio & Muzzle Flash for continuous weapon fire (works simultaneously while running!)
      if (me.lastShotTime && me.lastShotTime > this.lastShotTimeLocal) {
        this.lastShotTimeLocal = me.lastShotTime;
        this.playLocalWeaponSound();
      }

      // HP & Shield
      const hp = Math.max(0, Math.min(100, me.hp || 0));
      const shield = Math.max(0, Math.min(50, me.shield || 0));

      const hpBar = document.getElementById('hud-hp-bar');
      const hpText = document.getElementById('hud-hp-text');
      if (hpBar) hpBar.style.width = `${hp}%`;
      if (hpText) hpText.textContent = `${hp} / 100`;

      const shieldBar = document.getElementById('hud-shield-bar');
      const shieldText = document.getElementById('hud-shield-text');
      if (shieldBar) shieldBar.style.width = `${(shield / 50) * 100}%`;
      if (shieldText) shieldText.textContent = `${Math.round(shield)} / 50`;

      // Keys & Vault Deposits
      const keysEl = document.getElementById('hud-keys-held');
      const depositsEl = document.getElementById('hud-vault-deposits');
      if (keysEl) keysEl.textContent = me.keysCarried || 0;
      if (depositsEl) depositsEl.textContent = `${me.depositedKeys || 0} / 2`;

      // Weapon
      const weaponName = document.getElementById('hud-weapon-name');
      const weaponIcon = document.getElementById('hud-weapon-icon');
      const ammoCur = document.getElementById('hud-ammo-current');
      const ammoRes = document.getElementById('hud-ammo-reserve');

      const icons = { pistol: '🔫', rifle: '⚡', shotgun: '💥', rocket: '🚀' };
      if (weaponName) weaponName.textContent = (me.weapon || 'PISTOL').toUpperCase();
      if (weaponIcon) weaponIcon.textContent = icons[me.weapon || 'pistol'] || '🔫';
      if (ammoCur) ammoCur.textContent = (me.ammo === -1 || me.ammo === Infinity) ? '∞' : me.ammo;
      if (ammoRes) ammoRes.textContent = (me.reserveAmmo === -1 || me.reserveAmmo === Infinity) ? '∞' : me.reserveAmmo;

      // Timer
      const timerEl = document.getElementById('hud-timer');
      const remaining = Math.max(0, Math.round(world.roundTimeRemaining || 0));
      const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
      const secs = (remaining % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;

      // Vault depositing progress overlay
      const vaultOverlay = document.getElementById('overlay-vault-progress');
      const vaultBar = document.getElementById('vault-progress-bar');
      if (vaultOverlay && vaultBar) {
        if ((me.keysCarried || 0) > 0 && me.vaultStandingTime > 0) {
          vaultOverlay.classList.remove('hidden');
          const pct = Math.min(100, Math.round((me.vaultStandingTime / 2.0) * 100));
          vaultBar.style.width = `${pct}%`;
        } else {
          vaultOverlay.classList.add('hidden');
        }
      }

      // Respawn overlay
      const respawnOverlay = document.getElementById('overlay-respawn');
      const respawnSecs = document.getElementById('respawn-seconds');
      if (!me.alive && me.respawnAt && me.respawnAt > Date.now()) {
        respawnOverlay?.classList.remove('hidden');
        if (respawnSecs) respawnSecs.textContent = Math.ceil((me.respawnAt - Date.now()) / 1000);
      } else {
        respawnOverlay?.classList.add('hidden');
      }

      // Live 4-Player Scoreboard Strip
      this.updateScoreboard(players);
    }

    updateScoreboard(players) {
      const sb = document.getElementById('hud-scoreboard');
      if (!sb) return;

      const playerList = Object.values(players);
      const newHtml = playerList.map(p => {
        const isMe = (p.id === this.net.playerId);
        return `
          <div class="px-2 py-0.5 rounded-lg bg-slate-900/90 border ${isMe ? 'border-amber-400' : 'border-slate-800'} flex items-center space-x-1.5 text-[9px] font-code shadow-md">
            <span>${p.avatar || '🪖'}</span>
            <span class="font-bold text-white truncate max-w-[50px]">${p.name}</span>
            <span class="text-amber-400 font-bold">🗝️${p.depositedKeys || 0}/2</span>
          </div>
        `;
      }).join('');

      if (this._lastScoreboardHtml !== newHtml) {
        this._lastScoreboardHtml = newHtml;
        sb.innerHTML = newHtml;
      }
    }

    draw() {
      const ctx = this.ctx;
      const vw = this.viewportWidth;
      const vh = this.viewportHeight;

      ctx.clearRect(0, 0, vw, vh);

      const world = this.sim.state !== 'idle' ? this.sim.getWorldData() : (this.net.currentWorld || {});
      const players = this.sim.players && Object.keys(this.sim.players).length > 0 ? this.sim.players : (world.players || {});
      const me = players[this.net.playerId];

      // 1. STRICT LOCKED CENTER CAMERA:
      // Local player is ALWAYS rendered at the EXACT center of the screen
      const playerX = me ? me.x : 1100;   // default near bottom vaults
      const playerY = me ? me.y : 3400;

      // Exact center offset calculation
      const cameraX = playerX - vw / 2;
      const cameraY = playerY - vh / 2;

      this.camera.x = playerX;
      this.camera.y = playerY;

      ctx.save();
      // Translate canvas so player is dead center
      ctx.translate(-cameraX, -cameraY);

      // Draw Grid Terrain (Viewport culled)
      this.drawTerrain(ctx, cameraX, cameraY, vw, vh);

      // Draw 4 Home Base Vaults
      this.drawHomeVaults(ctx, players);

      // Draw Central Vault Room Pedestals
      this.drawCentralVaultRoom(ctx);

      // Draw Scaled 120x120px Obstacles (Stone Pillars & Destructible Wood Crates)
      const obstacles = (world.obstacles && world.obstacles.length > 0) ? world.obstacles : this.sim.obstacles;
      this.drawObstacles(ctx, obstacles, cameraX, cameraY, vw, vh);

      // Draw Pickups (Keys, Weapons, Health)
      const pickups = world.pickups || [];
      this.drawPickups(ctx, pickups, cameraX, cameraY, vw, vh);

      // Draw Landmines / Bombs
      const bombs = world.bombs || [];
      this.drawBombs(ctx, bombs, cameraX, cameraY, vw, vh);

      // Draw Projectiles
      const projectiles = world.projectiles || [];
      this.drawProjectiles(ctx, projectiles);

      // Draw Players (100% VISIBLE: Outlines, floating health, glowing visors, orbiting keys)
      Object.values(players).forEach(p => {
        if (!p || !p.alive) return;
        this.drawTacticalPlayer(ctx, p, p.id === this.net.playerId);
      });

      // Particles & Emojis
      this.particles.forEach(p => p.draw(ctx));
      this.floatingEmojis.forEach(e => e.draw(ctx));

      ctx.restore();

      // 2. OFF-SCREEN ENEMY & GOAL INDICATORS:
      // Draw radar arrows on the edge of the screen pointing toward off-screen enemies, central vault, and player's home base
      this.drawEdgeIndicators(ctx, me, players, pickups, cameraX, cameraY);
    }

    drawTerrain(ctx, cameraX, cameraY, vw, vh) {
      const pad = 120;
      const minX = Math.max(0, cameraX - pad);
      const minY = Math.max(0, cameraY - pad);
      const maxX = Math.min(WORLD_WIDTH, cameraX + vw + pad);
      const maxY = Math.min(WORLD_HEIGHT, cameraY + vh + pad);

      // Marathon field: dark background only in visible area
      ctx.fillStyle = '#050810';
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

      // Tactical grid lines (every 120px) — batched into single path
      const gridSize = 120;
      const startX = Math.max(0, Math.floor(minX / gridSize) * gridSize);
      const endX = Math.min(WORLD_WIDTH, Math.ceil(maxX / gridSize) * gridSize);
      const startY = Math.max(0, Math.floor(minY / gridSize) * gridSize);
      const endY = Math.min(WORLD_HEIGHT, Math.ceil(maxY / gridSize) * gridSize);

      ctx.strokeStyle = '#0e1420';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();

      // Marathon lane markers — subtle vertical guides (batched)
      ctx.strokeStyle = 'rgba(0,240,255,0.04)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      [480, 980, 1480, 1980].forEach(lx => {
        if (lx >= startX && lx <= endX) {
          ctx.moveTo(lx, startY);
          ctx.lineTo(lx, endY);
        }
      });
      ctx.stroke();

      // Perimeter danger border
      if (startX <= 20 || endX >= WORLD_WIDTH - 20 || startY <= 20 || endY >= WORLD_HEIGHT - 20) {
        ctx.strokeStyle = '#FF2A6D';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, WORLD_WIDTH - 10, WORLD_HEIGHT - 10);
      }

      // TOP zone highlight (key vault area)
      if (startY < 500) {
        ctx.fillStyle = 'rgba(255,215,0,0.03)';
        ctx.fillRect(startX, startY, endX - startX, Math.min(500, endY) - startY);
      }

      // BOTTOM zone highlight (home base area)
      if (endY > WORLD_HEIGHT - 500) {
        const topB = Math.max(WORLD_HEIGHT - 500, startY);
        ctx.fillStyle = 'rgba(5,217,232,0.03)';
        ctx.fillRect(startX, topB, endX - startX, endY - topB);
      }
    }

    drawHomeVaults(ctx, players) {
      // 4 side-by-side bottom-edge vaults (marathon field layout)
      const vaults = window.HOME_VAULTS || [
        { index: 0, x: 350,  y: 3400, radius: 90, color: '#00F0FF', name: 'Blue Vault' },
        { index: 1, x: 850,  y: 3400, radius: 90, color: '#FF2A6D', name: 'Pink Vault' },
        { index: 2, x: 1350, y: 3400, radius: 90, color: '#FFDF00', name: 'Gold Vault' },
        { index: 3, x: 1850, y: 3400, radius: 90, color: '#05D9E8', name: 'Cyan Vault' }
      ];

      vaults.forEach(v => {
        ctx.save();
        ctx.translate(v.x, v.y);

        const owner = Object.values(players).find(p => (p.vaultIndex % 4) === v.index);

        // Pulsing background glow
        const pulse = (Math.sin(Date.now() / 400) + 1) * 0.5;
        ctx.fillStyle = `${v.color}18`;
        ctx.beginPath();
        ctx.arc(0, 0, v.radius + pulse * 8, 0, Math.PI * 2);
        ctx.fill();

        // Metallic Base Ring
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, v.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner Safe Door Pattern
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, v.radius - 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `${v.color}88`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, v.radius - 24, 0, Math.PI * 2);
        ctx.stroke();

        // Safe Vault Emblem
        ctx.font = '28px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏛️', 0, -4);

        // Vault Owner & Key Progress Label
        ctx.font = 'bold 12px Space Grotesk, sans-serif';
        ctx.fillStyle = '#ffffff';
        const label = owner ? `${owner.name.substring(0, 9)} (${owner.depositedKeys || 0}/2)` : `${v.name} (0/2)`;
        ctx.fillText(label, 0, v.radius + 18);

        // If local player is standing here and depositing, draw circular fill progress
        if (owner && owner.id === this.net.playerId && (owner.keysCarried || 0) > 0 && owner.vaultStandingTime > 0) {
          const pct = Math.min(1, owner.vaultStandingTime / 2.0);
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, 0, v.radius + 4, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      });
    }

    drawCentralVaultRoom(ctx) {
      // TOP of the marathon field — Central Key Vault at (1200, 200)
      const world = this.sim.state !== 'idle' ? this.sim.getWorldData() : (this.net.currentWorld || {});
      const cvx = world.centralVaultX || 1200;
      const cvy = world.centralVaultY || 200;

      ctx.save();
      // Wide glowing entry zone
      const grd = ctx.createRadialGradient(cvx, cvy, 20, cvx, cvy, 280);
      grd.addColorStop(0, 'rgba(255,215,0,0.18)');
      grd.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cvx, cvy, 280, 0, Math.PI * 2);
      ctx.fill();

      // Glowing rune floor
      ctx.fillStyle = 'rgba(255,215,0,0.07)';
      ctx.fillRect(cvx - 280, cvy - 140, 560, 380);

      ctx.strokeStyle = 'rgba(255,215,0,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(cvx - 280, cvy - 140, 560, 380);

      // Chamber label
      ctx.font = 'bold 16px Space Grotesk, sans-serif';
      ctx.fillStyle = 'rgba(255,215,0,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ CENTRAL KEY VAULT — SPRINT UP! ⚡', cvx, cvy + 260);

      ctx.restore();
    }

    /**
     * Draw Scaled 120x120px Obstacles with High-Fidelity Tactical Styling
     */
    drawObstacles(ctx, obstacles, cameraX, cameraY, vw, vh) {
      const pad = 100;
      const minX = cameraX !== undefined ? (cameraX - pad) : -Infinity;
      const maxX = cameraX !== undefined ? (cameraX + vw + pad) : Infinity;
      const minY = cameraY !== undefined ? (cameraY - pad) : -Infinity;
      const maxY = cameraY !== undefined ? (cameraY + vh + pad) : Infinity;

      obstacles.forEach(ob => {
        if (ob.x + ob.w < minX || ob.x > maxX || ob.y + ob.h < minY || ob.y > maxY) {
          return;
        }
        if (ob.type === 'bush') {
          // Grass ambush patch
          ctx.save();
          ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
          ctx.fillRect(ob.x, ob.y, ob.w, ob.h);

          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);

          // Grass blade details
          ctx.fillStyle = 'rgba(52, 211, 153, 0.65)';
          for (let i = 20; i < ob.w; i += 35) {
            for (let j = 20; j < ob.h; j += 35) {
              ctx.beginPath();
              ctx.arc(ob.x + i, ob.y + j, 8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        } else if (ob.type === 'wood') {
          // Destructible Wooden Shortcut Wall / Crate (120x120px)
          ctx.save();
          ctx.fillStyle = '#78350f'; // Rich wood brown
          ctx.fillRect(ob.x, ob.y, ob.w, ob.h);

          // Wooden planks lines
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 2.5;
          const plankStep = 30;
          for (let x = ob.x + plankStep; x < ob.x + ob.w; x += plankStep) {
            ctx.beginPath();
            ctx.moveTo(x, ob.y);
            ctx.lineTo(x, ob.y + ob.h);
            ctx.stroke();
          }

          // Metal reinforced corner brackets
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 4;
          ctx.strokeRect(ob.x + 2, ob.y + 2, ob.w - 4, ob.h - 4);

          // Corner bolt rivets
          ctx.fillStyle = '#fde68a';
          const bolts = [
            [ob.x + 10, ob.y + 10],
            [ob.x + ob.w - 10, ob.y + 10],
            [ob.x + 10, ob.y + ob.h - 10],
            [ob.x + ob.w - 10, ob.y + ob.h - 10]
          ];
          bolts.forEach(([bx, by]) => {
            ctx.beginPath();
            ctx.arc(bx, by, 3, 0, Math.PI * 2);
            ctx.fill();
          });

          // Crate Cross Brace
          ctx.strokeStyle = 'rgba(69, 26, 3, 0.6)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(ob.x + 8, ob.y + 8);
          ctx.lineTo(ob.x + ob.w - 8, ob.y + ob.h - 8);
          ctx.moveTo(ob.x + ob.w - 8, ob.y + 8);
          ctx.lineTo(ob.x + 8, ob.y + ob.h - 8);
          ctx.stroke();

          // Health bar if damaged
          if (ob.hp < (ob.maxHp || 100)) {
            const hpPct = Math.max(0, ob.hp / (ob.maxHp || 100));
            ctx.fillStyle = '#020617';
            ctx.fillRect(ob.x + 6, ob.y - 10, ob.w - 12, 6);
            ctx.fillStyle = hpPct > 0.4 ? '#eab308' : '#ef4444';
            ctx.fillRect(ob.x + 6, ob.y - 10, (ob.w - 12) * hpPct, 6);
          }

          ctx.restore();
        } else {
          // Permanent Solid Stone Bunker Pillar (120x120px)
          ctx.save();
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(ob.x, ob.y, ob.w, ob.h);

          // Beveled Steel Edges
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 4;
          ctx.strokeRect(ob.x + 2, ob.y + 2, ob.w - 4, ob.h - 4);

          // Inner Dark Inset
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.strokeRect(ob.x + 10, ob.y + 10, ob.w - 20, ob.h - 20);

          // Tactical Diagonal Hazard Markings on corners
          ctx.fillStyle = '#334155';
          ctx.fillRect(ob.x + 14, ob.y + 14, ob.w - 28, ob.h - 28);

          // Center Bunker Plate
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(ob.x + ob.w / 2 - 16, ob.y + ob.h / 2 - 16, 32, 32);

          ctx.restore();
        }
      });
    }

    drawPickups(ctx, pickups, cameraX, cameraY, vw, vh) {
      const now = Date.now();
      const pad = 80;
      const minX = cameraX !== undefined ? (cameraX - pad) : -Infinity;
      const maxX = cameraX !== undefined ? (cameraX + vw + pad) : Infinity;
      const minY = cameraY !== undefined ? (cameraY - pad) : -Infinity;
      const maxY = cameraY !== undefined ? (cameraY + vh + pad) : Infinity;

      pickups.forEach(pk => {
        if (pk.respawnAt > 0) return;
        if (pk.x < minX || pk.x > maxX || pk.y < minY || pk.y > maxY) return;

        if (pk.isKey) {
          // Glowing Golden Key
          ctx.save();
          ctx.translate(pk.x, pk.y);

          // Hovering sine bounce
          const hoverY = Math.sin((now / 250) + pk.x) * 4;
          ctx.translate(0, hoverY);

          // Radiant Gold Beacon Aura
          const pulse = (Math.sin(now / 200) + 1) * 0.5;
          const glowGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 26 + pulse * 8);
          glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.95)');
          glowGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.45)');
          glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 36, 0, Math.PI * 2);
          ctx.fill();

          // Dropped key 10-second decay ring
          if (pk.isDropped && pk.droppedAt) {
            const age = now - pk.droppedAt;
            const remainingPct = Math.max(0, 1 - (age / (pk.decayTimeMs || 10000)));
            ctx.strokeStyle = remainingPct > 0.3 ? '#fde047' : '#ef4444';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + remainingPct * Math.PI * 2);
            ctx.stroke();
          }

          // Key Icon
          ctx.font = '24px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🗝️', 0, 0);

          ctx.restore();
        } else {
          // Weapons and Health/Shield pickups
          ctx.save();
          ctx.translate(pk.x, pk.y);

          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = pk.type === 'healthpack' ? '#01F70E' : pk.type === 'shield' ? '#00F0FF' : '#FFB800';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.font = '16px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const iconMap = {
            rifle: '⚡', shotgun: '💥', rocket: '🚀',
            healthpack: '💚', shield: '🛡️'
          };
          ctx.fillText(iconMap[pk.type] || '📦', 0, 0);

          ctx.restore();
        }
      });
    }

    drawBombs(ctx, bombs, cameraX, cameraY, vw, vh) {
      const now = Date.now();
      const pad = 80;
      const minX = cameraX !== undefined ? (cameraX - pad) : -Infinity;
      const maxX = cameraX !== undefined ? (cameraX + vw + pad) : Infinity;
      const minY = cameraY !== undefined ? (cameraY - pad) : -Infinity;
      const maxY = cameraY !== undefined ? (cameraY + vh + pad) : Infinity;

      bombs.forEach(b => {
        if (b.x + b.radius < minX || b.x - b.radius > maxX || b.y + b.radius < minY || b.y - b.radius > maxY) return;
        ctx.save();
        ctx.translate(b.x, b.y);

        const elapsed = now - b.plantedAt;
        const remaining = Math.max(0, b.fuseMs - elapsed);
        const blinkRate = remaining < 800 ? 80 : 200;
        const isBlink = Math.floor(now / blinkRate) % 2 === 0;

        ctx.strokeStyle = isBlink ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isBlink ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.font = '16px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', 0, 0);

        ctx.restore();
      });
    }

    drawProjectiles(ctx, projectiles) {
      projectiles.forEach(proj => {
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(proj.angle);

        if (proj.isExplosive) {
          ctx.fillStyle = '#FF6B00';
          ctx.fillRect(-10, -3, 20, 6);

          ctx.fillStyle = '#FF2A6D';
          ctx.beginPath();
          ctx.moveTo(10, -4);
          ctx.lineTo(16, 0);
          ctx.lineTo(10, 4);
          ctx.fill();
        } else {
          ctx.fillStyle = proj.color || '#FFDF00';
          ctx.fillRect(-10, -2.5, 20, 5);

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(10, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });
    }

    drawTacticalPlayer(ctx, player, isLocal) {
      ctx.save();
      ctx.translate(player.x, player.y);

      // Laser Sight for local player
      if (isLocal) {
        ctx.save();
        ctx.rotate(player.angle);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(450, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(3, 4, 20, 0, Math.PI * 2);
      ctx.fill();

      // Shield Aura
      if (player.shield > 0) {
        ctx.strokeStyle = 'rgba(5, 217, 232, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 27, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Invulnerability Bubble
      if (player.invulnerableUntil && Date.now() < player.invulnerableUntil) {
        ctx.strokeStyle = '#FFDF00';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Orbiting Glowing Keys for Key Carriers!
      const carried = player.keysCarried || 0;
      if (carried > 0) {
        const now = Date.now();
        for (let k = 0; k < carried; k++) {
          const orbitAngle = (now / 350) + (Math.PI * 2 / carried) * k;
          const kx = Math.cos(orbitAngle) * 34;
          const ky = Math.sin(orbitAngle) * 34;

          ctx.save();
          ctx.translate(kx, ky);
          ctx.font = '16px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🗝️', 0, 0);
          ctx.restore();
        }
      }

      // Rotate with Aim Angle
      ctx.rotate(player.angle);

      // Hands Gripping Weapon
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(15, -11, 4.5, 0, Math.PI * 2);
      ctx.arc(19, 7, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Gun Barrel
      const weaponType = player.weapon || 'pistol';
      const barrelLength = weaponType === 'rocket' ? 28 : weaponType === 'rifle' ? 24 : weaponType === 'shotgun' ? 20 : 16;
      const barrelWidth = weaponType === 'rocket' ? 7 : weaponType === 'shotgun' ? 6 : 4;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(8, -barrelWidth / 2, barrelLength, barrelWidth);

      ctx.fillStyle = '#64748b';
      ctx.fillRect(8 + barrelLength - 4, -barrelWidth / 2, 4, barrelWidth);

      // Muzzle Flash
      const isMuzzleFlash = (this.muzzleFlashes[player.id] && performance.now() < this.muzzleFlashes[player.id]);
      if (isMuzzleFlash) {
        ctx.save();
        ctx.translate(8 + barrelLength, 0);
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(16, 0);
        ctx.lineTo(0, 6);
        ctx.fill();
        ctx.restore();
      }

      // Tactical Body / Vest Outlines
      ctx.fillStyle = player.color || '#00F0FF';
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Armor Vest Plate
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-8, -9, 12, 18);

      // Soldier Helmet with Directional Goggle Visor
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glowing Directional Visor
      ctx.fillStyle = isLocal ? '#00F0FF' : '#FF2A6D';
      ctx.fillRect(5, -4, 5, 8);

      ctx.restore(); // Restore rotation

      // High-Contrast Floating Health & Shield Bars (HP/100)
      ctx.save();
      ctx.translate(player.x, player.y - 34);

      const barW = 46;
      const barH = 6;
      ctx.fillStyle = '#020617';
      ctx.fillRect(-barW / 2 - 1, -barH - 1, barW + 2, barH + 2);

      const hp = Math.max(0, Math.min(100, player.hp || 0));
      const hpPct = hp / 100;
      ctx.fillStyle = hpPct > 0.4 ? '#01F70E' : '#FF2A6D';
      ctx.fillRect(-barW / 2, -barH, barW * hpPct, barH);

      if (player.shield > 0) {
        const shieldPct = Math.min(1, player.shield / 50);
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(-barW / 2, -barH - 3, barW * shieldPct, 2);
      }

      // Name & Keys Carried Indicator
      ctx.font = 'bold 9px Space Grotesk, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      const keySuffix = (player.keysCarried || 0) > 0 ? ` 🗝️x${player.keysCarried}` : '';
      ctx.fillText(`${player.name.substring(0, 9)}${keySuffix}`, 0, -barH - 5);

      ctx.restore();
    }

    /**
     * OFF-SCREEN ENEMY & GOAL INDICATORS:
     * Draw directional radar arrows/pointers on screen margins pointing toward:
     * 1. Other active players/bots
     * 2. Central Key Vault
     * 3. Player's designated Home Base Vault
     */
    drawEdgeIndicators(ctx, me, players, pickups, cameraX, cameraY) {
      if (!me) return;

      const vw = this.viewportWidth;
      const vh = this.viewportHeight;
      const cx = vw / 2;
      const cy = vh / 2;
      const margin = 38;

      const halfW = cx - margin;
      const halfH = cy - margin;

      const renderPointer = (targetX, targetY, color, label, icon, distanceM) => {
        // Target relative to camera
        const screenX = targetX - cameraX;
        const screenY = targetY - cameraY;

        // If on screen with margin, skip drawing indicator
        if (screenX >= margin && screenX <= vw - margin && screenY >= margin && screenY <= vh - margin) {
          return;
        }

        const dx = screenX - cx;
        const dy = screenY - cy;
        const angle = Math.atan2(dy, dx);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const tx = Math.abs(cosA) > 0.0001 ? halfW / Math.abs(cosA) : Infinity;
        const ty = Math.abs(sinA) > 0.0001 ? halfH / Math.abs(sinA) : Infinity;
        const t = Math.min(tx, ty);

        const dotX = Math.max(margin, Math.min(vw - margin, cx + cosA * t));
        const dotY = Math.max(margin, Math.min(vh - margin, cy + sinA * t));

        ctx.save();
        ctx.translate(dotX, dotY);

        // Draw directional pointer arrow
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(8, -6);
        ctx.lineTo(8, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Indicator circular badge
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Icon inside circle
        ctx.font = '12px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, 0, 0);

        // Distance text below badge
        if (distanceM !== undefined) {
          ctx.font = 'bold 9px Space Grotesk, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${distanceM}m`, 0, 18);
        }

        ctx.restore();
      };

      // 1. Point toward Central Key Chamber (top of map, ~1200, 200)
      const world2 = this.sim.state !== 'idle' ? this.sim.getWorldData() : (this.net.currentWorld || {});
      const cvx = world2.centralVaultX || 1200;
      const cvy = world2.centralVaultY || 200;
      const distToCenter = Math.round(Math.hypot(cvx - me.x, cvy - me.y) / 20);
      renderPointer(cvx, cvy, '#FFD700', 'VAULT', '🗝️', distToCenter);

      // 2. Point toward Local Player's Home Base Vault
      const myVault = (window.HOME_VAULTS || [])[me.vaultIndex % 4];
      if (myVault) {
        const distToVault = Math.round(Math.hypot(myVault.x - me.x, myVault.y - me.y) / 20);
        renderPointer(myVault.x, myVault.y, myVault.color, 'BASE', '🏛️', distToVault);
      }

      // 3. Point toward Other Active Players & Bots
      Object.values(players).forEach(p => {
        if (!p || !p.alive || p.id === me.id) return;
        const dist = Math.round(Math.hypot(p.x - me.x, p.y - me.y) / 20);
        const icon = (p.keysCarried || 0) > 0 ? '🗝️' : (p.isBot ? '🤖' : (p.name || '?').charAt(0));
        renderPointer(p.x, p.y, p.color || '#FF2A6D', p.name, icon, dist);
      });
    }

    loadSavedConfig() {
      const vib = localStorage.getItem('pa_vibrate');
      if (vib !== null) {
        this.vibrationEnabled = (vib === '1');
        const vibInput = document.getElementById('toggle-vibration');
        if (vibInput) vibInput.checked = this.vibrationEnabled;
      }

      const apiKey = localStorage.getItem('pa_fb_apiKey') || '';
      const dbURL = localStorage.getItem('pa_fb_dbUrl') || '';
      const projId = localStorage.getItem('pa_fb_projId') || '';

      const apiKeyInput = document.getElementById('cfg-apiKey');
      const dbUrlInput = document.getElementById('cfg-databaseURL');
      const projIdInput = document.getElementById('cfg-projectId');

      if (apiKeyInput) apiKeyInput.value = apiKey;
      if (dbUrlInput) dbUrlInput.value = dbURL;
      if (projIdInput) projIdInput.value = projId;

      if (dbURL && dbURL.startsWith('http')) {
        this.net.initFirebase({
          apiKey: apiKey,
          databaseURL: dbURL,
          projectId: projId
        });
      } else {
        this.net.updateNetStatusPill('READY (P2P)', 'bg-emerald-400');
      }
    }

    saveFirebaseConfig() {
      const apiKey = document.getElementById('cfg-apiKey')?.value.trim() || '';
      const dbURL = document.getElementById('cfg-databaseURL')?.value.trim() || '';
      const projId = document.getElementById('cfg-projectId')?.value.trim() || '';

      localStorage.setItem('pa_fb_apiKey', apiKey);
      localStorage.setItem('pa_fb_dbUrl', dbURL);
      localStorage.setItem('pa_fb_projId', projId);

      const success = this.net.initFirebase({
        apiKey: apiKey,
        databaseURL: dbURL,
        projectId: projId
      });

      if (success) {
        alert('Connected to Firebase Realtime Database!');
        document.getElementById('modal-settings')?.classList.add('hidden');
      } else {
        alert('Could not connect. Switching to Local Demo / Offline Mode.');
        this.net.startLocalDemo();
        document.getElementById('modal-settings')?.classList.add('hidden');
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.PocketArena = new PocketArenaGame();
  });
})();
