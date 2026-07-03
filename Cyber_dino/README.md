# 🦖 CYBER DINO

A retro, cyberpunk-themed monochrome recreation of the classic Chromium T-Rex Runner game. This project features authentic physics, a procedural audio synthesizer, CRT scanline aesthetics, responsive mobile control HUDs, and day/night transitions.

---

## 🕹️ Play Instructions

### Desktop Controls
* **Jump**: `Space` or `W` or `▲ (Up Arrow)`
* **Duck**: `S` or `▼ (Down Arrow)` (Dodge flying pterodactyls or perform a quick-drop from mid-air)

### Mobile Controls
* Dedicated on-screen touch buttons:
  * **JUMP ▲**
  * **DUCK ▼**

---

## ✨ Features

* **Authentic Physics Engine**: Recreated using the original Chromium configuration values—including variable gravity, jump velocity, speed-drop coefficients, and speed acceleration multipliers.
* **8-bit Web Audio Synthesizer**: Procedurally generates classic retro beeps and crash sounds using the HTML5 Web Audio API (no external audio assets required).
  * *Jump Sound*: High-pitched square wave snap.
  * *Milestone Sound*: Double-beep square wave tone triggered every 100 points.
  * *System Crash Sound*: Descending sawtooth wave crash sequence.
* **Retro-Futuristic Visuals**:
  * Clean, monochrome design using the `'Press Start 2P'` Google Web Font.
  * CRT scanline overlay and a retro pixel-coordinate grid background.
  * Milestone HUD flashes on high score milestones.
* **Dynamic Environment Cycles**: Flips between Light and Dark (Night Mode) styles automatically every 700 points.
* **High Score Persistence**: Locally saves and displays your high score across reboots using `localStorage`.
* **Sound Toggle**: An interactive HUD speaker button allows you to mute/unmute game audio on the fly.

---

## 📁 Project Architecture

```bash
Cyber_dino/
├── index.html       # Game container, screen overlays, HUD and mobile touch pads
├── style.css        # Responsive layouts, CRT grid background, styling theme and CRT filter
├── game.js          # Core engine (Chromium configs, obstacle spawners, and canvas loop)
├── sound.js         # Web Audio API procedural sound synthesizer class
└── sprite.png       # Original pixel-art sprite sheet containing T-Rex, obstacles, clouds and HUD assets
```

### Technical Highlights
* **[index.html](file:///c:/Users/SAMBIT/OneDrive/Documents/mini-projects/Cyber_dino/index.html)**: Manages the viewport, overlays (`start-overlay`, `gameover-overlay`), and HUD containers.
* **[style.css](file:///c:/Users/SAMBIT/OneDrive/Documents/mini-projects/Cyber_dino/style.css)**: Implements custom CSS variables, a responsive layout bounded at `960px`, CRT scanline patterns (`.canvas-wrapper::after`), and the coordinate background styling.
* **[game.js](file:///c:/Users/SAMBIT/OneDrive/Documents/mini-projects/Cyber_dino/game.js)**: Runs the main canvas update loop (`requestAnimationFrame`), tracks collision bounding boxes, handles sprite segment coordinates for T-Rex states (`WAITING`, `RUNNING`, `DUCKING`, `JUMPING`, `CRASHED`), and handles dynamic speeds.
* **[sound.js](file:///c:/Users/SAMBIT/OneDrive/Documents/mini-projects/Cyber_dino/sound.js)**: Contains `SoundManager` which instantiates and operates the Web Audio Context, utilizing square, triangle, and sawtooth oscillators for zero-latency procedural effects.

---

## 🚀 How to Run Locally

Since the game loads a sprite sheet image (`sprite.png`), running it via a local server is recommended to avoid CORS issues in some browsers:

1. Clone or navigate to the project directory:
   ```bash
   cd Cyber_dino
   ```
2. Spin up a quick local development server:
   * **NodeJS**:
     ```bash
     npx serve
     ```
   * **Python**:
     ```bash
     python -m http.server 8000
     ```
3. Open `http://localhost:3000` (or `http://localhost:8000`) in your browser to play.
