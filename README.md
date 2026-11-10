# NEON BREACH — FPS GAME 01

**Version 2.0: Tactical 3D** — a browser-based first-person arena survival shooter built in JavaScript and [Three.js](https://threejs.org/).

## What changed from Version 1

The original 2D raycasting renderer has been replaced with a real, perspective-correct **WebGL 3D world**.

- **World:** detailed industrial compound, concrete/metal materials, procedural ground texture, atmospheric fog, 3D obstacles and cover, glowing signs, real-time lighting and shadows
- **Gunplay:** 3D assault rifle viewmodel, automatic fire, muzzle flashes, tracer rounds, hit sparks, aim-down-sights, recoil, headshot multiplier and reload animations
- **Movement:** mouse look with vertical aiming, accelerated movement, sprint with stamina, crouch and head bob
- **Enemies:** armored humanoid 3D drones, elites and wave-5 commanders; movement, strafing, aiming, ranged attacks, hit reactions and line-of-sight checks
- **Survival:** escalating waves, enemy projectiles, health, ammo pickups, wave-clear rewards, scores, local best score and minimap
- **Presentation:** new cinematic main menu, clean tactical HUD, health and stamina meters, hit markers, kill feed, spatial-looking audio effects

3D character and weapon models are built procedurally from geometry. This is **not photorealistic** and has no network multiplayer yet.

## Run locally

You need an internet connection to load the pinned Three.js module from jsDelivr, plus a browser with WebGL support.

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000** in Chrome, Edge or Firefox.

Because the game uses browser ES modules, use a local server instead of opening `index.html` with a `file://` URL.

## Controls

| Action | Control |
| --- | --- |
| Move | W A S D |
| Look around | Mouse (pointer lock) |
| Fire | Hold left mouse |
| Aim down sights | Hold right mouse |
| Sprint | Shift |
| Crouch | C |
| Reload | R |
| Pause / release mouse | Esc |
| Resume | Click Resume Mission |

Desktop keyboard and mouse are required. There is no mobile touch control at present.

## GitHub Pages

Go to **Settings → Pages**, select **Deploy from a branch**, choose **main** and **/(root)**, then save. The static game is compatible with GitHub Pages. A Pages URL only exists after Pages has been enabled and published.

## Source files

- `index.html` — game shell, HUD and menu
- `style.css` — tactical interface and responsive styling
- `game.js` — Three.js 3D scene, enemy AI, collision, weapon systems and game state

**Dependency:** Three.js v0.169.0 imported from jsDelivr at runtime. No build steps required.

## Future improvements

Animated rigged characters, real weapon assets, PBR texture sets, multiple levels and game modes, smarter navigation/pathfinding, sound design, performance tuning, customizable controls and online multiplayer.
