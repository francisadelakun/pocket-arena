# 🗝️ POCKET ARENA — Fight for Survival

> **Real-time 4-player tactical heist & extraction shooter** designed for cross-device combat across mobile and desktop. Built with **Vanilla JS**, **Canvas 2D**, **Tailwind CSS**, and **Firebase Realtime Database (free Spark plan)**.

---

## 🏆 Game Mode: "Fight for Survival"

A fast-paced tactical heist & extraction mode:

1. **4 Home Base Vaults**:
   - Each player is assigned a designated Home Base Vault in their corner:
     - **Top-Left**: Blue Vault (`#00F0FF`)
     - **Top-Right**: Pink Vault (`#FF2A6D`)
     - **Bottom-Left**: Gold Vault (`#FFDF00`)
     - **Bottom-Right**: Cyan Vault (`#05D9E8`)
2. **Central Vault Chamber**:
   - The central chamber at `(1400, 1400)` holds a limited pool of **4 Glowing Keys**.
3. **Objective & Win Condition**:
   - Infiltrate the center, grab keys, navigate back through the maze, and stand on your Home Base Vault for **2.0 seconds** to deposit.
   - **First player to deposit 2 keys into their Home Base Vault wins the heist!**
4. **Key Carrier Speed Protection**:
   - Carrying keys does **NOT** slow you down—key carriers maintain 100% full movement speed (330 px/s).
5. **On-Death Key Drops & 10s Decay Timer**:
   - If a key carrier is eliminated, all carried keys drop at their exact death location.
   - Dropped keys left on the ground uncollected for **10 seconds** will dissolve and automatically respawn back in the Central Vault.
   - Eliminated players respawn at their Home Base Vault after **4 seconds** with a temporary invulnerability bubble.
6. **2800x2800 Tactical Maze Layout**:
   - Permanent stone pillars and narrow choke-points.
   - **Destructible Wooden Shortcut Walls** (80 HP): Breakable by weapon fire and bomb blasts to create instant flanking routes!
   - Grass ambush patches for concealment.
7. **Room Code & Hosting System**:
   - Hosts automatically generate a prominent 4-character uppercase code (e.g. `ABCD`).
   - Displayed boldly in the Lobby and in the in-game HUD header.
   - Joining players simply enter the 4-letter code on the landing page.

---

## 🎮 Controls & Ergonomics

### Mobile (Landscape & Portrait Friendly)
* **Left Joystick** (Bottom-Left fixed anchor): 360° analog soldier movement.
* **Right Joystick** (Bottom-Right fixed anchor): 360° aiming with **Auto-Fire**.
* **Wide Center Dead-Zone**: Prevents thumb overlap.
* **Dedicated Bomb Button**: Placed above right stick for quick defensive landmine drops.
* **Vibration**: Heavy weapon discharge vibration removed to prevent phone shaking; optional light 5ms haptic pulse only on taking damage.

### Desktop PC
* **Movement**: `W`, `A`, `S`, `D` or `Arrow Keys` (8-directional).
* **Aim**: Mouse cursor (360°).
* **Shoot**: Left Click.
* **Bomb / Landmine**: `Space` or `B`.
* **Reload**: `R`.

---

## 🚀 Quick Start (Local Development)

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Open `http://localhost:8000` in your browser.

### Instant Offline / Solo Simulation Mode
1. Click **Deploy Squad (Host)** or open **⚙️ (Settings)** and choose **"🎮 Launch Offline Bots / Simulation Mode"**.
2. Click **"🚀 START OPERATION"** to face 3 tactical AI bots programmed to fight, steal keys, and deposit them into their vaults!

---

## 🚢 Deployment

Static deploy with zero build steps:

* **Firebase Hosting**: `npx -y firebase-tools deploy`
* **Vercel**: `npx vercel --prod`
* **Netlify**: `npx netlify deploy --prod --dir=.`
