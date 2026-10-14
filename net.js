/**
 * POCKET ARENA — "Fight for Survival" Tactical Heist Networking Layer (`net.js`)
 * 
 * Hybrid Ultra-Low-Latency Multi-Transport:
 * 1. Direct Local Server Relay (/api/room/...) — Instant, rock-solid Hotspot/Wi-Fi connection between PC and Mobile
 * 2. WebRTC P2P DataChannels via PeerJS — Global fallback for remote players
 * 3. BroadcastChannel Bus — Instant cross-tab play on same machine
 * 4. Local Simulation Loop — Offline solo testing with AI bots
 */

(function (window) {
  'use strict';

  const AVATARS = ['🪖', '🤖', '💀', '🦊', '🐱', '🐸', '🐵', '🐯', '🐙', '👾'];
  const PLAYER_COLORS = ['#00F0FF', '#FF2A6D', '#FFDF00', '#05D9E8'];

  const ADJECTIVES = ['Ghost', 'Shadow', 'Viper', 'Rogue', 'Apex', 'Thunder', 'Reaper', 'Cyber', 'Iron', 'Nova', 'Echo', 'Bravo'];
  const NOUNS = ['Sniper', 'Operator', 'Commando', 'Striker', 'Titan', 'Ranger', 'Spectre', 'Havoc', 'Falcon', 'Wolf', 'Marine', 'Phantom'];

  // 4-letter alphanumeric alphabet (avoiding 0/O, 1/I)
  const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  class NetManager {
    constructor() {
      this.db = null;
      this.isFirebaseReady = false;
      this.isLocalDemo = false;
      this.isServerRelay = false;

      // Identity & Session
      this.playerId = null;
      this.playerName = '';
      this.playerAvatar = '🪖';
      this.playerColor = PLAYER_COLORS[0];
      this.roomCode = null;
      this.isHost = false;

      // Transport Handles
      this.peer = null;
      this.hostConnection = null;
      this.clientConnections = {};
      this.broadcastChannel = null;
      this.syncInterval = null;
      this.seenEventTimestamps = new Set();

      // Current Room Snapshot Cache
      this.currentMeta = null;
      this.currentPlayers = {};
      this.currentWorld = null;

      // Callbacks for sim & game engines
      this.onStateChange = null;
      this.onPlayersChange = null;
      this.onWorldSnapshot = null;
      this.onEventBroadcast = null;
      this.onHostMigrated = null;
      this.onRoomLocked = null;

      this.initIdentity();
    }

    initIdentity() {
      let storedId = sessionStorage.getItem('pa_shooter_player_id');
      if (!storedId) {
        storedId = 'p_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('pa_shooter_player_id', storedId);
      }
      this.playerId = storedId;

      let storedName = sessionStorage.getItem('pa_shooter_player_name');
      if (!storedName) {
        storedName = this.generateFunnyName();
        sessionStorage.setItem('pa_shooter_player_name', storedName);
      }
      this.playerName = storedName;

      let storedAvatar = sessionStorage.getItem('pa_shooter_player_avatar');
      if (!storedAvatar) {
        storedAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
        sessionStorage.setItem('pa_shooter_player_avatar', storedAvatar);
      }
      this.playerAvatar = storedAvatar;
    }

    generateFunnyName() {
      const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      const num = Math.floor(Math.random() * 90 + 10);
      return `${adj}${noun}${num}`;
    }

    setPlayerName(name) {
      if (!name || !name.trim()) return;
      this.playerName = name.trim().substring(0, 18);
      sessionStorage.setItem('pa_shooter_player_name', this.playerName);

      if (this.currentPlayers[this.playerId]) {
        this.currentPlayers[this.playerId].name = this.playerName;
        if (this.isHost) {
          this.broadcastToClients({ type: 'players_update', players: this.currentPlayers });
          if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
        }
      }
    }

    cycleAvatar() {
      const currentIndex = AVATARS.indexOf(this.playerAvatar);
      const nextIndex = (currentIndex + 1) % AVATARS.length;
      this.playerAvatar = AVATARS[nextIndex];
      sessionStorage.setItem('pa_shooter_player_avatar', this.playerAvatar);

      if (this.currentPlayers[this.playerId]) {
        this.currentPlayers[this.playerId].avatar = this.playerAvatar;
        if (this.isHost) {
          this.broadcastToClients({ type: 'players_update', players: this.currentPlayers });
          if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
        }
      }
      return this.playerAvatar;
    }

    initFirebase(config) {
      if (!config || !config.databaseURL || config.databaseURL.indexOf('http') !== 0) {
        this.isFirebaseReady = false;
        return false;
      }

      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(config);
        }
        this.db = firebase.database();
        this.isFirebaseReady = true;

        this.db.ref('.info/connected').on('value', (snap) => {
          const connected = snap.val() === true;
          this.updateNetStatusPill(connected ? 'ONLINE (RTDB)' : 'CONNECTING...', connected ? 'bg-emerald-400' : 'bg-amber-500 animate-pulse');
        });

        return true;
      } catch (err) {
        console.warn('[NetManager] Firebase init failed:', err);
        this.isFirebaseReady = false;
        return false;
      }
    }

    updateNetStatusPill(text, pillClass) {
      const statusPill = document.getElementById('header-net-pill');
      const statusText = document.getElementById('header-net-status');
      if (statusPill && statusText) {
        statusPill.className = `inline-block w-1.5 h-1.5 rounded-full ${pillClass}`;
        statusText.textContent = text;
      }
    }

    // ================= LOCAL DEMO / BOT MODE =================
    startLocalDemo() {
      this.cleanupTransports();
      this.isLocalDemo = true;
      this.isHost = true;
      this.isServerRelay = false;
      this.roomCode = this.generateRoomCode();

      this.updateNetStatusPill('OFFLINE (BOTS)', 'bg-cyan-400');

      this.currentMeta = {
        hostId: this.playerId,
        state: 'lobby',
        startedAt: Date.now()
      };

      this.currentPlayers = {
        [this.playerId]: {
          id: this.playerId,
          name: this.playerName,
          avatar: this.playerAvatar,
          color: PLAYER_COLORS[0],
          vaultIndex: 0,
          keysCarried: 0,
          depositedKeys: 0,
          joinedAt: Date.now(),
          alive: true,
          hp: 100,
          shield: 50,
          weapon: 'pistol',
          ammo: -1,
          reserveAmmo: -1,
          kills: 0,
          deaths: 0,
          shotsFired: 0,
          shotsHit: 0,
          damageTaken: 0,
          lastSeen: Date.now()
        }
      };

      this.currentWorld = {
        inputs: {},
        players: this.currentPlayers,
        projectiles: [],
        bombs: [],
        pickups: [],
        obstacles: []
      };

      if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
      if (this.onStateChange) this.onStateChange(this.currentMeta);

      return true;
    }

    // ================= ROOM CREATION (HOST) =================
    async createRoom() {
      this.cleanupTransports();
      this.isLocalDemo = false;
      this.isHost = true;

      const code = this.generateRoomCode();
      this.roomCode = code;
      this.playerColor = PLAYER_COLORS[0];

      const initialPlayer = {
        id: this.playerId,
        name: this.playerName,
        avatar: this.playerAvatar,
        color: this.playerColor,
        vaultIndex: 0,
        keysCarried: 0,
        depositedKeys: 0,
        joinedAt: Date.now(),
        alive: true,
        hp: 100,
        shield: 50,
        weapon: 'pistol',
        ammo: -1,
        reserveAmmo: -1,
        kills: 0,
        deaths: 0,
        shotsFired: 0,
        shotsHit: 0,
        damageTaken: 0,
        lastSeen: Date.now()
      };

      this.currentMeta = {
        hostId: this.playerId,
        state: 'lobby',
        startedAt: Date.now(),
        createdAt: Date.now()
      };

      this.currentPlayers = {
        [this.playerId]: initialPlayer
      };

      this.currentWorld = {
        inputs: {},
        players: this.currentPlayers,
        projectiles: [],
        bombs: [],
        pickups: [],
        obstacles: []
      };

      // 1. Try Direct Local Server Relay (Fastest, zero-config on Wi-Fi / Hotspot)
      try {
        const resp = await fetch('/api/room/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code, player: initialPlayer })
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.ok) {
            this.isServerRelay = true;
            console.log(`[NetManager] 🚀 Created room [${code}] on local server relay!`);
            this.startServerSyncLoop();
          }
        }
      } catch (err) {
        console.log('[NetManager] Local server API not available, falling back to WebRTC/Broadcast:', err);
      }

      // 2. Setup Local Cross-Tab BroadcastChannel
      this.setupHostBroadcastChannel(code);

      // 3. Setup WebRTC PeerJS as secondary fallback
      this.setupHostPeer(code);

      this.updateNetStatusPill(`HOSTING [${code}] (LIVE)`, 'bg-emerald-400');
      if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
      if (this.onStateChange) this.onStateChange(this.currentMeta);

      this.broadcastEvent('taunt', `👑 Room [${code}] created! Share code with your squad operatives.`);
      return code;
    }

    setupHostBroadcastChannel(code) {
      if (typeof BroadcastChannel === 'undefined') return;

      try {
        this.broadcastChannel = new BroadcastChannel(`pkarena_bc_${code}`);
        this.broadcastChannel.onmessage = (evt) => {
          const msg = evt.data;
          if (!msg || !this.isHost) return;

          if (msg.type === 'join_request') {
            this.handleHostIncomingJoin(msg.player, (response) => {
              this.broadcastChannel.postMessage({ type: 'join_response', targetId: msg.player.id, ...response });
            });
          } else if (msg.type === 'client_input') {
            if (!this.currentWorld) this.currentWorld = {};
            if (!this.currentWorld.inputs) this.currentWorld.inputs = {};
            this.currentWorld.inputs[msg.playerId] = msg.input;
          } else if (msg.type === 'client_leave') {
            this.handlePlayerLeave(msg.playerId);
          }
        };
      } catch (e) {
        console.warn('[NetManager] BroadcastChannel setup failed:', e);
      }
    }

    setupHostPeer(code) {
      if (typeof window.Peer === 'undefined') return;

      const peerId = `pkarena-room-${code}`;
      try {
        this.peer = new window.Peer(peerId, {
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('connection', (conn) => {
          this.clientConnections[conn.peer] = conn;

          conn.on('data', (data) => {
            if (!data) return;

            if (data.type === 'join_request') {
              this.handleHostIncomingJoin(data.player, (response) => {
                conn.send({ type: 'join_response', ...response });
              });
            } else if (data.type === 'client_input') {
              if (!this.currentWorld) this.currentWorld = {};
              if (!this.currentWorld.inputs) this.currentWorld.inputs = {};
              this.currentWorld.inputs[data.playerId] = data.input;
            } else if (data.type === 'client_leave') {
              this.handlePlayerLeave(data.playerId);
            }
          });

          conn.on('close', () => {
            delete this.clientConnections[conn.peer];
          });
        });
      } catch (err) {}
    }

    handleHostIncomingJoin(player, sendReply) {
      const existingPlayerIds = Object.keys(this.currentPlayers);
      const isRejoining = existingPlayerIds.includes(player.id);

      if (!isRejoining && existingPlayerIds.length >= 4) {
        sendReply({ accepted: false, reason: `Room [${this.roomCode}] is full (4/4 operatives).` });
        return;
      }

      if (!isRejoining && this.currentMeta.state !== 'lobby') {
        sendReply({ accepted: false, reason: `Room [${this.roomCode}] is currently in battle!` });
        return;
      }

      const slotIndex = isRejoining ? existingPlayerIds.indexOf(player.id) : existingPlayerIds.length;
      const assignedColor = PLAYER_COLORS[slotIndex % PLAYER_COLORS.length];

      const playerData = {
        id: player.id,
        name: player.name || `Operative ${slotIndex + 1}`,
        avatar: player.avatar || '🪖',
        color: assignedColor,
        vaultIndex: slotIndex % 4,
        keysCarried: 0,
        depositedKeys: 0,
        joinedAt: Date.now(),
        alive: true,
        hp: 100,
        shield: 50,
        weapon: 'pistol',
        ammo: -1,
        reserveAmmo: -1,
        kills: 0,
        deaths: 0,
        shotsFired: 0,
        shotsHit: 0,
        damageTaken: 0,
        lastSeen: Date.now()
      };

      this.currentPlayers[player.id] = playerData;

      sendReply({
        accepted: true,
        slotIndex: slotIndex,
        roomCode: this.roomCode,
        meta: this.currentMeta,
        players: this.currentPlayers
      });

      this.broadcastToClients({ type: 'players_update', players: this.currentPlayers });
      if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
      this.broadcastEvent('taunt', `🎯 ${playerData.name} joined the squad! (${Object.keys(this.currentPlayers).length}/4)`);
    }

    handlePlayerLeave(playerId) {
      if (!playerId || !this.currentPlayers[playerId]) return;
      const leavingPlayer = this.currentPlayers[playerId];
      delete this.currentPlayers[playerId];

      this.broadcastToClients({ type: 'players_update', players: this.currentPlayers });
      if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
      this.broadcastEvent('taunt', `🚪 ${leavingPlayer.name} disconnected.`);
    }

    // ================= ROOM JOINING (CLIENT) =================
    async joinRoom(code) {
      code = (code || '').trim().toUpperCase();
      if (!code || code.length < 4 || code.length > 6) {
        throw new Error('Please enter a valid room code (4 to 6 characters).');
      }

      this.cleanupTransports();
      this.isLocalDemo = false;
      this.isHost = false;
      this.roomCode = code;

      this.updateNetStatusPill(`CONNECTING [${code}]...`, 'bg-amber-400 animate-pulse');

      const myPlayerData = {
        id: this.playerId,
        name: this.playerName,
        avatar: this.playerAvatar
      };

      // 1. FAST-PATH: Direct Local Server Join (Instant on Wi-Fi / Hotspot)
      let serverApiAvailable = false;
      try {
        const resp = await fetch('/api/room/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code, player: myPlayerData })
        });

        // If we get ANY JSON response (even an error), the relay server is running
        const data = await resp.json();
        serverApiAvailable = true;

        if (resp.ok && data.ok) {
          this.isServerRelay = true;
          this.playerColor = PLAYER_COLORS[data.slotIndex % PLAYER_COLORS.length];
          this.currentMeta = data.meta;
          this.currentPlayers = data.players;

          this.updateNetStatusPill(`CONNECTED [${code}] (HOTSPOT)`, 'bg-emerald-400');
          if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
          if (this.onStateChange) this.onStateChange(this.currentMeta);

          this.startServerSyncLoop();
          console.log(`[NetManager] ⚡ Connected to room [${code}] via local server relay!`);
          return code;
        } else {
          // Server is running but returned an error (room not found, full, in battle, etc.)
          // Surface the error immediately — no P2P fallback needed
          const errMsg = (data && data.error) ? data.error
            : `Room [${code}] not found. Ask your host for the correct 4-letter code.`;
          throw new Error(errMsg);
        }
      } catch (err) {
        // If server relay API was reachable and gave us an error, propagate immediately
        if (serverApiAvailable) throw err;
        // Otherwise server isn't running — log and fall through to P2P
        console.log('[NetManager] Relay server offline, trying P2P fallback:', err.message);
      }

      // 2. SECONDARY FALLBACK: BroadcastChannel & WebRTC PeerJS
      return new Promise((resolve, reject) => {
        let isResolved = false;

        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            this.updateNetStatusPill('DISCONNECTED', 'bg-rose-500');
            reject(new Error(`Room [${code}] not found. Please verify the code with your squad host.`));
          }
        }, 6000);

        const onJoinSuccess = (data) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeoutId);

          this.playerColor = PLAYER_COLORS[data.slotIndex % PLAYER_COLORS.length];
          this.currentMeta = data.meta;
          this.currentPlayers = data.players;

          this.updateNetStatusPill(`CONNECTED [${code}] (P2P)`, 'bg-emerald-400');
          if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
          if (this.onStateChange) this.onStateChange(this.currentMeta);

          resolve(code);
        };

        const onJoinFailure = (reason) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeoutId);
          this.updateNetStatusPill('DISCONNECTED', 'bg-rose-500');
          reject(new Error(reason || `Failed to join room [${code}].`));
        };

        // BroadcastChannel
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            this.broadcastChannel = new BroadcastChannel(`pkarena_bc_${code}`);
            this.broadcastChannel.onmessage = (evt) => {
              const msg = evt.data;
              if (!msg) return;

              if (msg.type === 'join_response' && msg.targetId === this.playerId) {
                if (msg.accepted) onJoinSuccess(msg);
                else onJoinFailure(msg.reason);
              } else if (msg.type === 'players_update') {
                this.currentPlayers = msg.players;
                if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
              } else if (msg.type === 'state_update') {
                this.currentMeta = msg.meta;
                if (this.onStateChange) this.onStateChange(this.currentMeta);
              } else if (msg.type === 'world_snapshot') {
                this.currentWorld = msg.world;
                if (this.onWorldSnapshot) this.onWorldSnapshot(this.currentWorld);
              } else if (msg.type === 'event_broadcast') {
                if (this.onEventBroadcast) this.onEventBroadcast(msg.event);
              }
            };

            this.broadcastChannel.postMessage({ type: 'join_request', player: myPlayerData });
          } catch (e) {}
        }

        // WebRTC PeerJS
        if (typeof window.Peer !== 'undefined') {
          try {
            this.peer = new window.Peer(undefined, {
              debug: 0,
              config: {
                iceServers: [
                  { urls: 'stun:stun.l.google.com:19302' },
                  { urls: 'stun:global.stun.twilio.com:3478' }
                ]
              }
            });

            this.peer.on('open', () => {
              const targetHostPeerId = `pkarena-room-${code}`;
              const conn = this.peer.connect(targetHostPeerId, { reliable: true });
              this.hostConnection = conn;

              conn.on('open', () => {
                conn.send({ type: 'join_request', player: myPlayerData });
              });

              conn.on('data', (data) => {
                if (!data) return;
                if (data.type === 'join_response') {
                  if (data.accepted) onJoinSuccess(data);
                  else onJoinFailure(data.reason);
                } else if (data.type === 'players_update') {
                  this.currentPlayers = data.players;
                  if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
                } else if (data.type === 'state_update') {
                  this.currentMeta = data.meta;
                  if (this.onStateChange) this.onStateChange(this.currentMeta);
                } else if (data.type === 'world_snapshot') {
                  this.currentWorld = data.world;
                  if (this.onWorldSnapshot) this.onWorldSnapshot(this.currentWorld);
                } else if (data.type === 'event_broadcast') {
                  if (this.onEventBroadcast) this.onEventBroadcast(data.event);
                }
              });

              conn.on('error', () => onJoinFailure());
            });

            this.peer.on('error', (err) => {
              if (err.type === 'peer-unavailable') {
                onJoinFailure(`Room [${code}] not found. Please verify the code.`);
              }
            });
          } catch (err) {}
        }
      });
    }

    // ================= HIGH-FREQUENCY SERVER SYNC LOOP =================
    // ================= HIGH-FREQUENCY SERVER SYNC LOOP =================
    startServerSyncLoop() {
      if (this.syncInterval) clearInterval(this.syncInterval);

      // Fast ~20Hz polling loop over local network with in-flight request protection
      this.syncInterval = setInterval(async () => {
        if (!this.roomCode || !this.isServerRelay || this._isSyncing) return;
        this._isSyncing = true;

        try {
          const res = await fetch(`/api/room/sync?code=${this.roomCode}&playerId=${this.playerId}`);
          if (!res.ok) return;

          const data = await res.json();
          if (!data || !data.ok) return;

          // 1. Sync Room State (lightweight check)
          if (data.meta && data.meta.state !== this.currentMeta?.state) {
            this.currentMeta = data.meta;
            if (this.onStateChange) this.onStateChange(this.currentMeta);
          }

          // 2. Sync Players (lightweight property check instead of JSON.stringify)
          if (data.players) {
            const currentKeys = Object.keys(this.currentPlayers || {});
            const newKeys = Object.keys(data.players);
            let playersChanged = (currentKeys.length !== newKeys.length);
            if (!playersChanged) {
              for (let i = 0; i < newKeys.length; i++) {
                const pid = newKeys[i];
                const np = data.players[pid];
                const op = this.currentPlayers[pid];
                if (!op || op.depositedKeys !== np.depositedKeys || op.keysCarried !== np.keysCarried || op.alive !== np.alive || op.hp !== np.hp || op.weapon !== np.weapon) {
                  playersChanged = true;
                  break;
                }
              }
            }
            if (playersChanged) {
              this.currentPlayers = data.players;
              if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
            }
          }

          // 3. Sync World (Clients receive host's simulation)
          if (!this.isHost && data.world) {
            this.currentWorld = data.world;
            if (this.onWorldSnapshot) this.onWorldSnapshot(this.currentWorld);
          }

          // 4. Host collects inputs from clients
          if (this.isHost && data.inputs) {
            if (!this.currentWorld) this.currentWorld = {};
            this.currentWorld.inputs = data.inputs;
          }

          // 5. Sync Events (Killfeed, alerts)
          if (data.events && Array.isArray(data.events)) {
            data.events.forEach(evt => {
              if (evt && evt.ts && !this.seenEventTimestamps.has(evt.ts)) {
                this.seenEventTimestamps.add(evt.ts);
                if (this.onEventBroadcast) this.onEventBroadcast(evt);
              }
            });
          }
        } catch (e) {
        } finally {
          this._isSyncing = false;
        }
      }, 50);
    }

    // ================= DATA BROADCAST & INPUT STREAMING =================
    broadcastToClients(message) {
      // 1. Send via WebRTC
      Object.values(this.clientConnections).forEach(conn => {
        if (conn && conn.open) {
          try { conn.send(message); } catch (e) {}
        }
      });

      // 2. Send via BroadcastChannel
      if (this.broadcastChannel) {
        try { this.broadcastChannel.postMessage(message); } catch (e) {}
      }
    }

    sendShooterInput(inputData) {
      const payload = {
        vx: typeof inputData.vx === 'number' ? inputData.vx : 0,
        vy: typeof inputData.vy === 'number' ? inputData.vy : 0,
        aimAngle: typeof inputData.aimAngle === 'number' ? inputData.aimAngle : 0,
        firing: !!inputData.firing,
        shootCount: inputData.shootCount || 0,
        dropBomb: inputData.dropBomb || 0,
        reload: !!inputData.reload,
        taunt: inputData.taunt || null,
        ts: Date.now()
      };

      // Always update local cache immediately
      if (!this.currentWorld) this.currentWorld = {};
      if (!this.currentWorld.inputs) this.currentWorld.inputs = {};
      this.currentWorld.inputs[this.playerId] = payload;

      // If client, stream to host with in-flight request guard to avoid network queuing on mobile
      if (!this.isHost) {
        if (this.isServerRelay && this.roomCode) {
          if (!this._inputSending) {
            this._inputSending = true;
            fetch('/api/room/input', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: this.roomCode,
                playerId: this.playerId,
                input: payload
              })
            }).catch(() => {}).finally(() => {
              this._inputSending = false;
            });
          }
        }

        if (this.hostConnection && this.hostConnection.open) {
          try {
            this.hostConnection.send({
              type: 'client_input',
              playerId: this.playerId,
              input: payload
            });
          } catch (e) {}
        }

        if (this.broadcastChannel) {
          try {
            this.broadcastChannel.postMessage({
              type: 'client_input',
              playerId: this.playerId,
              input: payload
            });
          } catch (e) {}
        }
      }
    }

    publishWorldSnapshot(worldData) {
      if (!this.isHost) return;

      this.currentWorld = worldData;

      if (this.isServerRelay && this.roomCode) {
        if (!this._worldSending) {
          this._worldSending = true;
          fetch('/api/room/world', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: this.roomCode,
              world: worldData
            })
          }).catch(() => {}).finally(() => {
            this._worldSending = false;
          });
        }
      }

      this.broadcastToClients({
        type: 'world_snapshot',
        world: worldData
      });
    }

    setRoomState(state, extraMeta = {}) {
      this.currentMeta = {
        ...this.currentMeta,
        state: state,
        ...extraMeta
      };

      if (this.onStateChange) this.onStateChange(this.currentMeta);

      if (this.isHost) {
        if (this.isServerRelay && this.roomCode) {
          fetch('/api/room/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: this.roomCode,
              state: state,
              extraMeta: extraMeta
            })
          }).catch(() => {});
        }

        this.broadcastToClients({
          type: 'state_update',
          meta: this.currentMeta
        });
      }
    }

    broadcastEvent(type, text) {
      const evt = { type, text, ts: Date.now() };

      if (this.onEventBroadcast) this.onEventBroadcast(evt);

      if (this.isServerRelay && this.roomCode) {
        fetch('/api/room/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: this.roomCode,
            event: evt
          })
        }).catch(() => {});
      }

      if (this.isHost) {
        this.broadcastToClients({
          type: 'event_broadcast',
          event: evt
        });
      }
    }

    async addDummyBot() {
      if (this.isServerRelay && this.roomCode) {
        try {
          const res = await fetch('/api/room/add_bot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: this.roomCode })
          });
          const data = await res.json();
          if (data && data.ok) {
            this.currentPlayers = data.players;
            if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
            return;
          }
        } catch (e) {}
      }

      const currentKeys = Object.keys(this.currentPlayers);
      if (currentKeys.length >= 4) return null;

      const botCount = currentKeys.filter(k => k.startsWith('bot_')).length;
      const botId = `bot_${botCount + 1}`;
      const botNames = ['Delta-Bot', 'Viper-Bot', 'Ghost-Bot', 'Havoc-Bot'];
      const slotIndex = currentKeys.length;

      const botData = {
        id: botId,
        name: botNames[botCount % botNames.length],
        avatar: '🤖',
        color: PLAYER_COLORS[slotIndex % PLAYER_COLORS.length],
        vaultIndex: slotIndex % 4,
        keysCarried: 0,
        depositedKeys: 0,
        joinedAt: Date.now(),
        alive: true,
        hp: 100,
        shield: 50,
        weapon: 'pistol',
        ammo: -1,
        reserveAmmo: -1,
        kills: 0,
        deaths: 0,
        shotsFired: 0,
        shotsHit: 0,
        damageTaken: 0,
        isBot: true,
        lastSeen: Date.now()
      };

      this.currentPlayers[botId] = botData;

      if (this.isHost) {
        this.broadcastToClients({
          type: 'players_update',
          players: this.currentPlayers
        });
      }

      if (this.onPlayersChange) this.onPlayersChange(this.currentPlayers);
      this.broadcastEvent('taunt', `🤖 ${botData.name} entered the combat zone!`);
      return botData;
    }

    cleanupTransports() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }

      if (this.broadcastChannel) {
        try {
          if (!this.isHost && this.roomCode) {
            this.broadcastChannel.postMessage({ type: 'client_leave', playerId: this.playerId });
          }
          this.broadcastChannel.close();
        } catch (e) {}
        this.broadcastChannel = null;
      }

      if (this.hostConnection) {
        try {
          this.hostConnection.send({ type: 'client_leave', playerId: this.playerId });
          this.hostConnection.close();
        } catch (e) {}
        this.hostConnection = null;
      }

      Object.values(this.clientConnections).forEach(conn => {
        try { conn.close(); } catch (e) {}
      });
      this.clientConnections = {};

      if (this.peer) {
        try { this.peer.destroy(); } catch (e) {}
        this.peer = null;
      }

      if (this.isServerRelay && this.roomCode) {
        fetch('/api/room/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: this.roomCode, playerId: this.playerId })
        }).catch(() => {});
      }
    }

    leaveRoom() {
      this.cleanupTransports();
      this.roomCode = null;
      this.isHost = false;
      this.isServerRelay = false;
      this.currentMeta = null;
      this.currentPlayers = {};
      this.currentWorld = null;
      this.updateNetStatusPill('READY', 'bg-amber-500');
    }

    generateRoomCode() {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
      }
      return code;
    }
  }

  window.NetManager = NetManager;
})(window);
