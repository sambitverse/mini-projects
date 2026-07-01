/**
 * Chrome T-Rex Runner - Faithful recreation
 * Uses the official Chromium sprite sheet and physics values.
 */
(function () {
    'use strict';

    // === GAME DIMENSIONS ===
    var WIDTH = 600;
    var HEIGHT = 150;
    var MS_PER_FRAME = 1000 / 60;

    // === SPRITE SHEET COORDINATES (1x / LDPI) ===
    var SP = {
        CACTUS_SMALL:  { x: 228, y: 2 },
        CACTUS_LARGE:  { x: 332, y: 2 },
        CLOUD:         { x: 86,  y: 2 },
        HORIZON:       { x: 2,   y: 54 },
        MOON:          { x: 484, y: 2 },
        PTERODACTYL:   { x: 134, y: 2 },
        RESTART:       { x: 2,   y: 2 },
        TEXT_SPRITE:   { x: 655, y: 2 },
        TREX:          { x: 848, y: 2 },
        STAR:          { x: 645, y: 2 }
    };

    // === RUNNER CONFIG (from Chromium Runner.config) ===
    var CFG = {
        ACCELERATION: 0.001,
        BG_CLOUD_SPEED: 0.2,
        BOTTOM_PAD: 10,
        CLOUD_FREQUENCY: 0.5,
        GAP_COEFFICIENT: 0.6,
        GRAVITY: 0.6,
        INITIAL_JUMP_VELOCITY: 12,
        INVERT_DISTANCE: 700,
        MAX_CLOUDS: 6,
        MAX_OBSTACLE_LENGTH: 3,
        MAX_SPEED: 13,
        SPEED: 6,
        SPEED_DROP_COEFFICIENT: 3
    };

    // === TREX CONFIG (from Chromium Trex.config) ===
    var TREX_CFG = {
        WIDTH: 44,
        HEIGHT: 47,
        WIDTH_DUCK: 59,
        HEIGHT_DUCK: 25,
        START_X: 50,
        GRAVITY: 0.6,
        INITIAL_JUMP_VELOCITY: -10,
        SPEED_DROP_COEFFICIENT: 3
    };

    // === T-REX ANIMATION FRAMES (x-offset from TREX sprite origin) ===
    var ANIM = {
        WAITING:  { frames: [44, 0],     ms: 1000 / 3 },
        RUNNING:  { frames: [88, 132],   ms: 1000 / 12 },
        CRASHED:  { frames: [220],       ms: 1000 / 60 },
        JUMPING:  { frames: [0],         ms: 1000 / 60 },
        DUCKING:  { frames: [264, 323],  ms: 1000 / 8 }
    };

    // === OBSTACLE TYPE DEFINITIONS (from Chromium Obstacle.types) ===
    var OBS_TYPES = [
        {
            type: 'CACTUS_SMALL',
            width: 17,
            height: 35,
            yPos: 105,
            multipleSpeed: 4,
            minGap: 120,
            minSpeed: 0,
            numFrames: 1,
            frameRate: 0,
            speedOffset: 0
        },
        {
            type: 'CACTUS_LARGE',
            width: 25,
            height: 50,
            yPos: 90,
            multipleSpeed: 7,
            minGap: 120,
            minSpeed: 0,
            numFrames: 1,
            frameRate: 0,
            speedOffset: 0
        },
        {
            type: 'PTERODACTYL',
            width: 46,
            height: 40,
            yPos: [100, 75, 50],
            multipleSpeed: 999,
            minSpeed: 8.5,
            minGap: 150,
            numFrames: 2,
            frameRate: 1000 / 6,
            speedOffset: 0.8
        }
    ];

    // === DISTANCE METER CONFIG ===
    var DIST_COEFFICIENT = 0.025;
    var DIGIT_WIDTH = 10;
    var DIGIT_HEIGHT = 13;
    var DIGIT_DEST_WIDTH = 11;

    // === HELPERS ===
    function rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function boxHit(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
               a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // =========================================================================
    //  GAME
    // =========================================================================
    function Game() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = WIDTH;
        this.canvas.height = HEIGHT;
        this.ctx.imageSmoothingEnabled = false;

        this.sprite = new Image();
        this.sprite.src = 'sprite.png';
        var self = this;
        this.sprite.onload = function () { self.init(); };
    }

    Game.prototype.init = function () {
        this.state = 'WAITING';
        this.currentSpeed = CFG.SPEED;
        this.distanceRan = 0;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('trex_hs')) || 0;
        this.playCount = 0;
        this.invertTrigger = false;
        this.lastTime = 0;
        this.scoreFlashTimer = 0;
        this.scoreFlashOn = true;

        // Cache DOM elements for HUD
        this.wrapper = document.getElementById('canvas-wrapper');
        this.scoreEl = document.getElementById('current-score-val');
        this.hiScoreEl = document.getElementById('high-score-val');
        this.startOverlay = document.getElementById('start-overlay');
        this.gameoverOverlay = document.getElementById('gameover-overlay');
        this.finalScoreEl = document.getElementById('final-score');
        this.soundBtn = document.getElementById('toggle-sound');

        this.trex = new Trex(this);
        this.ground = new Ground(this);
        this.clouds = [];
        this.obstacles = [];

        // Seed a few clouds
        for (var i = 0; i < 3; i++) {
            this.clouds.push(new Cloud(this, rand(50, WIDTH)));
        }

        this.updateHUD();
        this.setupInput();
        var self = this;
        requestAnimationFrame(function (t) { self.loop(t); });
    };

    Game.prototype.setupInput = function () {
        var self = this;
        var jumpCodes = { ArrowUp: 1, Space: 1, KeyW: 1 };
        var duckCodes = { ArrowDown: 1, KeyS: 1 };

        document.addEventListener('keydown', function (e) {
            if (e.repeat) return;
            if (jumpCodes[e.code]) { e.preventDefault(); self.onAction(); }
            if (duckCodes[e.code]) { e.preventDefault(); self.trex.setDuck(true); }
        });

        document.addEventListener('keyup', function (e) {
            if (duckCodes[e.code]) { self.trex.setDuck(false); }
            if (jumpCodes[e.code]) { self.trex.endJump(); }
        });

        // Canvas touch/click
        this.canvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
            self.onAction();
        });

        this.canvas.addEventListener('mousedown', function (e) {
            e.preventDefault();
            self.onAction();
        });

        // HTML overlay buttons
        var startBtn = document.getElementById('start-btn');
        var restartBtn = document.getElementById('restart-btn');
        if (startBtn) startBtn.addEventListener('click', function () { self.onAction(); });
        if (restartBtn) restartBtn.addEventListener('click', function () { self.onAction(); });

        // Mobile controls
        var jumpBtn = document.getElementById('mobile-jump');
        var duckBtn = document.getElementById('mobile-duck');
        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', function (e) { e.preventDefault(); self.onAction(); });
        }
        if (duckBtn) {
            duckBtn.addEventListener('touchstart', function (e) { e.preventDefault(); self.trex.setDuck(true); });
            duckBtn.addEventListener('touchend', function (e) { e.preventDefault(); self.trex.setDuck(false); });
        }

        // Sound toggle button
        if (this.soundBtn) {
            this.soundBtn.addEventListener('click', function () {
                if (window.sounds) {
                    var muted = sounds.toggleMute();
                    var iconEl = self.soundBtn.querySelector('.icon');
                    if (muted) {
                        self.soundBtn.classList.add('active');
                        if (iconEl) iconEl.textContent = '🔇';
                    } else {
                        self.soundBtn.classList.remove('active');
                        if (iconEl) iconEl.textContent = '🔊';
                    }
                }
            });
        }
    };

    Game.prototype.onAction = function () {
        if (this.state === 'WAITING') {
            this.startPlaying();
        } else if (this.state === 'CRASHED') {
            this.restart();
        } else if (this.state === 'PLAYING') {
            if (!this.trex.jumping) {
                this.trex.startJump();
            }
        }
    };

    Game.prototype.startPlaying = function () {
        this.state = 'PLAYING';
        this.trex.status = 'RUNNING';
        this.playCount++;
        if (window.sounds) sounds.resume();

        // Hide all overlays
        if (this.startOverlay) this.startOverlay.classList.remove('active');
        if (this.gameoverOverlay) this.gameoverOverlay.classList.remove('active');
        if (this.wrapper) this.wrapper.classList.remove('game-over');
    };

    Game.prototype.restart = function () {
        this.currentSpeed = CFG.SPEED;
        this.distanceRan = 0;
        this.score = 0;
        this.obstacles = [];
        this.invertTrigger = false;
        if (this.wrapper) this.wrapper.classList.remove('night-mode');
        this.trex.reset();
        this.updateHUD();
        this.startPlaying();
    };

    Game.prototype.crash = function () {
        this.state = 'CRASHED';
        this.trex.status = 'CRASHED';
        if (window.sounds) sounds.playGameOver();
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('trex_hs', this.highScore);
        }

        // Show game over overlay
        if (this.gameoverOverlay) this.gameoverOverlay.classList.add('active');
        if (this.finalScoreEl) this.finalScoreEl.textContent = this.score;
        if (this.wrapper) this.wrapper.classList.add('game-over');
        this.updateHUD();
    };

    Game.prototype.updateHUD = function () {
        if (this.scoreEl) this.scoreEl.textContent = String(this.score).padStart(5, '0');
        if (this.hiScoreEl) this.hiScoreEl.textContent = String(this.highScore).padStart(5, '0');
    };

    Game.prototype.loop = function (time) {
        var dt = time - (this.lastTime || time);
        this.lastTime = time;

        // Clamp dt to prevent huge jumps (e.g. switching tabs)
        if (dt > 100) dt = MS_PER_FRAME;

        this.update(dt);
        this.draw();

        var self = this;
        requestAnimationFrame(function (t) { self.loop(t); });
    };

    Game.prototype.update = function (dt) {
        if (this.state !== 'PLAYING') {
            this.trex.update(dt, this.state);
            return;
        }

        var frames = dt / MS_PER_FRAME;

        // Distance & Score
        this.distanceRan += this.currentSpeed * frames;
        var prevScore = this.score;
        this.score = Math.floor(this.distanceRan * DIST_COEFFICIENT);

        // Update HUD every few score changes
        if (this.score !== prevScore) {
            this.updateHUD();
        }

        // Score milestone beep + HUD flash
        if (this.score > 0 && Math.floor(this.score / 100) !== Math.floor(prevScore / 100)) {
            if (window.sounds) sounds.playScore();
            this.scoreFlashTimer = 1000; // Flash for 1 second
            // Flash the HUD scoreboard
            if (this.scoreEl) {
                var container = this.scoreEl.parentElement;
                container.classList.add('score-flash');
                setTimeout(function () { container.classList.remove('score-flash'); }, 500);
            }
        }

        // Score flash animation
        if (this.scoreFlashTimer > 0) {
            this.scoreFlashTimer -= dt;
            this.scoreFlashOn = Math.floor(this.scoreFlashTimer / 100) % 2 === 0;
        } else {
            this.scoreFlashOn = true;
        }

        // Speed increase
        if (this.currentSpeed < CFG.MAX_SPEED) {
            this.currentSpeed += CFG.ACCELERATION * frames;
        }

        // Day/Night toggle every INVERT_DISTANCE score points
        var shouldBeNight = Math.floor(this.score / CFG.INVERT_DISTANCE) % 2 === 1;
        if (shouldBeNight !== this.invertTrigger) {
            this.invertTrigger = shouldBeNight;
            if (this.wrapper) {
                if (shouldBeNight) {
                    this.wrapper.classList.add('night-mode');
                } else {
                    this.wrapper.classList.remove('night-mode');
                }
            }
        }

        // Update game objects
        this.trex.update(dt, this.state);
        this.ground.update(frames, this.currentSpeed);
        this.updateClouds(frames);
        this.updateObstacles(frames);
        this.checkCollisions();
    };

    Game.prototype.updateClouds = function (frames) {
        for (var i = this.clouds.length - 1; i >= 0; i--) {
            this.clouds[i].update(frames);
            if (this.clouds[i].remove) this.clouds.splice(i, 1);
        }

        var last = this.clouds[this.clouds.length - 1];
        if (this.clouds.length < CFG.MAX_CLOUDS &&
            (!last || last.x < WIDTH - last.gap)) {
            this.clouds.push(new Cloud(this, WIDTH + rand(10, 80)));
        }
    };

    Game.prototype.updateObstacles = function (frames) {
        for (var i = this.obstacles.length - 1; i >= 0; i--) {
            this.obstacles[i].update(frames, this.currentSpeed);
            if (this.obstacles[i].remove) this.obstacles.splice(i, 1);
        }

        // Spawn check
        var last = this.obstacles[this.obstacles.length - 1];
        if (!last || last.x + last.totalWidth + last.gap < WIDTH) {
            var available = [];
            for (var j = 0; j < OBS_TYPES.length; j++) {
                if (this.currentSpeed >= OBS_TYPES[j].minSpeed) {
                    available.push(OBS_TYPES[j]);
                }
            }
            if (available.length > 0) {
                var type = available[rand(0, available.length - 1)];
                this.obstacles.push(new Obstacle(this, type));
            }
        }
    };

    Game.prototype.checkCollisions = function () {
        var tBox = this.trex.getHitbox();
        for (var i = 0; i < this.obstacles.length; i++) {
            if (boxHit(tBox, this.obstacles[i].getHitbox())) {
                this.crash();
                return;
            }
        }
    };

    Game.prototype.draw = function () {
        var ctx = this.ctx;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        // Clouds (behind everything)
        for (var i = 0; i < this.clouds.length; i++) this.clouds[i].draw();

        // Ground
        this.ground.draw();

        // Obstacles
        for (var j = 0; j < this.obstacles.length; j++) this.obstacles[j].draw();

        // Dino
        this.trex.draw();

        // Score (always visible)
        this.drawScore();

        // Game Over overlay
        if (this.state === 'CRASHED') {
            this.drawGameOver();
        }
    };

    // --- TEXT SPRITE LAYOUT (from sprite sheet inspection) ---
    // Row 1 (y:2): digits 0-9 (each ~10x13), then "HI" (~20x13)
    // Row 2 (y:15): "GAME OVER" text (~191x13)
    // "HI" sprite: x = TEXT_SPRITE.x + (10 * DIGIT_WIDTH) = 655 + 100 = 755
    var HI_SPRITE = { x: 755, y: 2, w: 20, h: 13 };
    var GAMEOVER_SPRITE = { x: 655, y: 15, w: 191, h: 11 };

    Game.prototype.drawScore = function () {
        var scoreStr = String(this.score).padStart(5, '0');
        var rightEdge = WIDTH - 20;
        var y = 8;

        // Draw current score (may flash on milestone)
        if (this.scoreFlashOn) {
            this.drawDigits(scoreStr, rightEdge, y);
        }

        // Draw high score with "HI" label
        if (this.highScore > 0 || this.playCount > 1) {
            var hiStr = String(this.highScore).padStart(5, '0');

            // Position: HI  00000  00000
            var gap = DIGIT_DEST_WIDTH * 2; // gap between HI score and current score
            var hiDigitsRight = rightEdge - scoreStr.length * DIGIT_DEST_WIDTH - gap;

            // Draw HI score digits
            this.drawDigits(hiStr, hiDigitsRight, y);

            // Draw "HI" label from sprite sheet
            var hiLabelX = hiDigitsRight - hiStr.length * DIGIT_DEST_WIDTH - HI_SPRITE.w - 4;
            this.game_ctx_ref = this.ctx;
            this.ctx.drawImage(this.sprite,
                HI_SPRITE.x, HI_SPRITE.y, HI_SPRITE.w, HI_SPRITE.h,
                hiLabelX, y, HI_SPRITE.w, HI_SPRITE.h);
        }
    };

    Game.prototype.drawDigits = function (str, rightX, y) {
        // Digits 0-9 at TEXT_SPRITE.x, each 10px wide, 13px tall
        var ctx = this.ctx;
        for (var i = str.length - 1; i >= 0; i--) {
            var digit = parseInt(str[i]);
            ctx.drawImage(this.sprite,
                SP.TEXT_SPRITE.x + (digit * DIGIT_WIDTH), SP.TEXT_SPRITE.y,
                DIGIT_WIDTH, DIGIT_HEIGHT,
                rightX - (str.length - i) * DIGIT_DEST_WIDTH, y,
                DIGIT_WIDTH, DIGIT_HEIGHT
            );
        }
    };

    Game.prototype.drawGameOver = function () {
        var ctx = this.ctx;

        // "GAME OVER" text from sprite sheet (row 2 at y:15)
        ctx.drawImage(this.sprite,
            GAMEOVER_SPRITE.x, GAMEOVER_SPRITE.y, GAMEOVER_SPRITE.w, GAMEOVER_SPRITE.h,
            Math.floor(WIDTH / 2 - GAMEOVER_SPRITE.w / 2), Math.floor(HEIGHT / 2 - 25),
            GAMEOVER_SPRITE.w, GAMEOVER_SPRITE.h);

        // Restart icon from sprite sheet: RESTART at (2, 2), ~36x32
        ctx.drawImage(this.sprite,
            SP.RESTART.x, SP.RESTART.y, 36, 32,
            Math.floor(WIDTH / 2 - 18), Math.floor(HEIGHT / 2 - 5), 36, 32);
    };

    // =========================================================================
    //  TREX (Dinosaur)
    // =========================================================================
    function Trex(game) {
        this.game = game;
        this.x = TREX_CFG.START_X;
        this.groundY = HEIGHT - TREX_CFG.HEIGHT - CFG.BOTTOM_PAD;
        this.y = this.groundY;
        this.jumping = false;
        this.ducking = false;
        this.speedDrop = false;
        this.jumpVelocity = 0;
        this.status = 'WAITING';
        this.animFrame = 0;
        this.animTimer = 0;
        this.blinkTimer = rand(1000, 4000);
        this.blinking = false;
    }

    Trex.prototype.reset = function () {
        this.y = this.groundY;
        this.jumping = false;
        this.ducking = false;
        this.speedDrop = false;
        this.jumpVelocity = 0;
        this.status = 'RUNNING';
        this.animFrame = 0;
        this.animTimer = 0;
    };

    Trex.prototype.startJump = function () {
        if (this.jumping || this.ducking) return;
        this.jumping = true;
        this.jumpVelocity = TREX_CFG.INITIAL_JUMP_VELOCITY;
        this.status = 'JUMPING';
        this.speedDrop = false;
        if (window.sounds) sounds.playJump();
    };

    Trex.prototype.endJump = function () {
        if (this.speedDrop) {
            this.speedDrop = false;
        }
    };

    Trex.prototype.setDuck = function (ducking) {
        if (this.jumping) {
            if (ducking) {
                this.speedDrop = true;
                this.jumpVelocity = 1;
            }
            return;
        }
        this.ducking = ducking;
        this.status = ducking ? 'DUCKING' : 'RUNNING';
    };

    Trex.prototype.update = function (dt, gameState) {
        // Blink animation in WAITING state
        if (gameState === 'WAITING') {
            this.blinkTimer -= dt;
            if (this.blinkTimer <= 0) {
                this.blinking = !this.blinking;
                this.blinkTimer = this.blinking ? 150 : rand(1000, 4000);
            }
            return;
        }

        if (this.status === 'CRASHED') return;

        // Advance animation frame
        var anim = ANIM[this.status] || ANIM.RUNNING;
        this.animTimer += dt;
        if (this.animTimer >= anim.ms) {
            this.animTimer -= anim.ms;
            this.animFrame = (this.animFrame + 1) % anim.frames.length;
        }

        // Jump physics
        if (this.jumping) {
            var frames = dt / MS_PER_FRAME;
            this.y += this.jumpVelocity * frames;
            this.jumpVelocity += TREX_CFG.GRAVITY * frames;

            if (this.speedDrop) {
                this.y += this.jumpVelocity * TREX_CFG.SPEED_DROP_COEFFICIENT * frames;
            }

            if (this.y >= this.groundY) {
                this.y = this.groundY;
                this.jumping = false;
                this.jumpVelocity = 0;
                this.speedDrop = false;
                this.status = 'RUNNING';
            }
        }
    };

    Trex.prototype.getHitbox = function () {
        if (this.ducking) {
            var duckY = HEIGHT - TREX_CFG.HEIGHT_DUCK - CFG.BOTTOM_PAD;
            return { x: this.x + 2, y: duckY + 1, w: TREX_CFG.WIDTH_DUCK - 4, h: TREX_CFG.HEIGHT_DUCK - 2 };
        }
        return { x: this.x + 6, y: this.y + 4, w: TREX_CFG.WIDTH - 12, h: TREX_CFG.HEIGHT - 6 };
    };

    Trex.prototype.draw = function () {
        var ctx = this.game.ctx;
        var spr = this.game.sprite;
        var baseX = SP.TREX.x;
        var baseY = SP.TREX.y;
        var frameOff, sw, sh, dy;

        if (this.status === 'DUCKING') {
            var a = ANIM.DUCKING;
            frameOff = a.frames[this.animFrame % a.frames.length];
            sw = TREX_CFG.WIDTH_DUCK;
            sh = TREX_CFG.HEIGHT_DUCK;
            dy = HEIGHT - TREX_CFG.HEIGHT_DUCK - CFG.BOTTOM_PAD;
        } else if (this.status === 'CRASHED') {
            frameOff = ANIM.CRASHED.frames[0];
            sw = TREX_CFG.WIDTH;
            sh = TREX_CFG.HEIGHT;
            dy = this.y;
        } else if (this.status === 'JUMPING') {
            frameOff = ANIM.JUMPING.frames[0];
            sw = TREX_CFG.WIDTH;
            sh = TREX_CFG.HEIGHT;
            dy = this.y;
        } else if (this.game.state === 'WAITING') {
            frameOff = this.blinking ? ANIM.WAITING.frames[0] : ANIM.WAITING.frames[1];
            sw = TREX_CFG.WIDTH;
            sh = TREX_CFG.HEIGHT;
            dy = this.y;
        } else {
            var b = ANIM.RUNNING;
            frameOff = b.frames[this.animFrame % b.frames.length];
            sw = TREX_CFG.WIDTH;
            sh = TREX_CFG.HEIGHT;
            dy = this.y;
        }

        ctx.drawImage(spr, baseX + frameOff, baseY, sw, sh,
            Math.floor(this.x), Math.floor(dy), sw, sh);
    };

    // =========================================================================
    //  GROUND (Horizon Line)
    // =========================================================================
    function Ground(game) {
        this.game = game;
        // Two segments that tile horizontally
        this.xPos = [0, 600];
        this.yPos = HEIGHT - 12 - 2; // Ground strip near bottom
        // Two different halves of the horizon sprite for variety
        this.srcX = [SP.HORIZON.x, SP.HORIZON.x + 600];
    }

    Ground.prototype.update = function (frames, speed) {
        var inc = speed * frames;
        this.xPos[0] -= inc;
        this.xPos[1] -= inc;

        // Wrap segments
        if (this.xPos[0] <= -600) {
            this.xPos[0] = this.xPos[1] + 600;
        }
        if (this.xPos[1] <= -600) {
            this.xPos[1] = this.xPos[0] + 600;
        }
    };

    Ground.prototype.draw = function () {
        var ctx = this.game.ctx;
        var spr = this.game.sprite;
        var sy = SP.HORIZON.y;

        ctx.drawImage(spr, this.srcX[0], sy, 600, 12,
            Math.floor(this.xPos[0]), this.yPos, 600, 12);
        ctx.drawImage(spr, this.srcX[1], sy, 600, 12,
            Math.floor(this.xPos[1]), this.yPos, 600, 12);
    };

    // =========================================================================
    //  CLOUD
    // =========================================================================
    var CLOUD_W = 46;
    var CLOUD_H = 14;

    function Cloud(game, startX) {
        this.game = game;
        this.x = startX;
        this.y = rand(15, 60);
        this.gap = rand(100, 300);
        this.remove = false;
    }

    Cloud.prototype.update = function (frames) {
        this.x -= CFG.BG_CLOUD_SPEED * frames;
        if (this.x + CLOUD_W < 0) this.remove = true;
    };

    Cloud.prototype.draw = function () {
        this.game.ctx.drawImage(this.game.sprite,
            SP.CLOUD.x, SP.CLOUD.y, CLOUD_W, CLOUD_H,
            Math.floor(this.x), this.y, CLOUD_W, CLOUD_H);
    };

    // =========================================================================
    //  OBSTACLE (Cacti + Pterodactyl)
    // =========================================================================
    function Obstacle(game, typeConfig) {
        this.game = game;
        this.type = typeConfig.type;
        this.cfg = typeConfig;
        this.x = WIDTH;
        this.remove = false;

        // Random group size (1-3 for cacti, always 1 for birds)
        this.size = 1;
        if (typeConfig.type !== 'PTERODACTYL') {
            if (game.currentSpeed >= typeConfig.multipleSpeed) {
                this.size = rand(1, CFG.MAX_OBSTACLE_LENGTH);
            }
        }

        this.totalWidth = typeConfig.width * this.size;
        this.height = typeConfig.height;

        // Y position
        if (Array.isArray(typeConfig.yPos)) {
            this.y = typeConfig.yPos[rand(0, typeConfig.yPos.length - 1)];
        } else {
            this.y = typeConfig.yPos;
        }

        // Gap to next obstacle (from Chromium formula)
        var minGap = Math.round(this.totalWidth * game.currentSpeed +
            typeConfig.minGap * CFG.GAP_COEFFICIENT);
        var maxGap = Math.round(minGap * 1.5);
        this.gap = rand(minGap, maxGap);

        this.speedOffset = typeConfig.speedOffset || 0;

        // Animation state (for pterodactyl)
        this.animFrame = 0;
        this.animTimer = 0;

        // Sprite source position
        if (typeConfig.type === 'CACTUS_SMALL') {
            this.spriteX = SP.CACTUS_SMALL.x;
            this.spriteY = SP.CACTUS_SMALL.y;
        } else if (typeConfig.type === 'CACTUS_LARGE') {
            this.spriteX = SP.CACTUS_LARGE.x;
            this.spriteY = SP.CACTUS_LARGE.y;
        } else {
            this.spriteX = SP.PTERODACTYL.x;
            this.spriteY = SP.PTERODACTYL.y;
        }
    }

    Obstacle.prototype.update = function (frames, speed) {
        var actualSpeed = speed + (this.speedOffset * speed);
        this.x -= actualSpeed * frames;

        if (this.x + this.totalWidth < -50) {
            this.remove = true;
        }

        // Pterodactyl wing animation
        if (this.cfg.numFrames > 1) {
            this.animTimer += frames * MS_PER_FRAME;
            if (this.animTimer >= this.cfg.frameRate) {
                this.animTimer -= this.cfg.frameRate;
                this.animFrame = (this.animFrame + 1) % this.cfg.numFrames;
            }
        }
    };

    Obstacle.prototype.getHitbox = function () {
        // Inset hitbox for fair collisions
        var pad = 4;
        return {
            x: this.x + pad,
            y: this.y + pad,
            w: this.totalWidth - pad * 2,
            h: this.height - pad * 2
        };
    };

    Obstacle.prototype.draw = function () {
        var ctx = this.game.ctx;
        var sx = this.spriteX;

        if (this.type === 'PTERODACTYL') {
            // Offset sprite X by frame for animation
            sx += this.animFrame * this.cfg.width;
            ctx.drawImage(this.game.sprite,
                sx, this.spriteY, this.cfg.width, this.cfg.height,
                Math.floor(this.x), this.y, this.cfg.width, this.cfg.height);
        } else {
            // Cacti: draw group slice (consecutive cacti from sprite sheet)
            ctx.drawImage(this.game.sprite,
                sx, this.spriteY, this.totalWidth, this.height,
                Math.floor(this.x), this.y, this.totalWidth, this.height);
        }
    };

    // =========================================================================
    //  INITIALIZATION
    // =========================================================================
    window.addEventListener('load', function () {
        window.game = new Game();
    });

})();
