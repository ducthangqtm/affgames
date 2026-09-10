// Game 4: Xếp Hình Neon (Cyber Tetris / Neon Block Puzzle)
// 100% HTML5 Canvas 2D + 7-Bag Randomizer + Ghost Piece + Wall Kicks + Mobile Touch & D-Pad

class TetrisGame {
  constructor(canvasId, nextCanvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.nextCanvas = document.getElementById(nextCanvasId);
    this.nextCtx = this.nextCanvas ? this.nextCanvas.getContext('2d') : null;

    this.COLS = 10;
    this.ROWS = 20;
    this.cellSize = 20;

    // Tetrominoes definition with neon color palette
    this.PIECES = {
      I: {
        shape: [
          [0, 0, 0, 0],
          [1, 1, 1, 1],
          [0, 0, 0, 0],
          [0, 0, 0, 0]
        ],
        color: '#00f0ff',
        glow: 'rgba(0, 240, 255, 0.6)'
      },
      J: {
        shape: [
          [1, 0, 0],
          [1, 1, 1],
          [0, 0, 0]
        ],
        color: '#3b82f6',
        glow: 'rgba(59, 130, 246, 0.6)'
      },
      L: {
        shape: [
          [0, 0, 1],
          [1, 1, 1],
          [0, 0, 0]
        ],
        color: '#f97316',
        glow: 'rgba(249, 115, 22, 0.6)'
      },
      O: {
        shape: [
          [1, 1],
          [1, 1]
        ],
        color: '#facc15',
        glow: 'rgba(250, 204, 21, 0.6)'
      },
      S: {
        shape: [
          [0, 1, 1],
          [1, 1, 0],
          [0, 0, 0]
        ],
        color: '#10b981',
        glow: 'rgba(16, 185, 129, 0.6)'
      },
      T: {
        shape: [
          [0, 1, 0],
          [1, 1, 1],
          [0, 0, 0]
        ],
        color: '#a855f7',
        glow: 'rgba(168, 85, 247, 0.6)'
      },
      Z: {
        shape: [
          [1, 1, 0],
          [0, 1, 1],
          [0, 0, 0]
        ],
        color: '#ef4444',
        glow: 'rgba(239, 68, 68, 0.6)'
      }
    };

    this.grid = this.createGrid();
    this.bag = [];
    this.currentPiece = null;
    this.nextPiece = null;

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.highScore = parseInt(localStorage.getItem('tetris_high_score') || '0', 10);
    this.state = 'START'; // START, PLAYING, GAMEOVER, PAUSED

    this.dropInterval = 800; // ms
    this.lastDropTime = 0;
    this.clearingRows = [];
    this.clearAnimTimer = 0;
    this.particles = [];

    this.setupCanvas();
    this.initEvents();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  createGrid() {
    return Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));
  }

  setupCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const isMobile = window.innerWidth < 640;
    // Sidebar on right takes ~95px on mobile, modal header takes ~45px, controls take ~80px
    const maxW = Math.min(window.innerWidth - (isMobile ? 115 : 140), isMobile ? 250 : 300);
    const maxH = isMobile ? Math.min(window.innerHeight - 175, 480) : 520;

    // Maintain 1:2 aspect ratio (10:20 grid)
    let cell = Math.floor(Math.min(maxW / this.COLS, maxH / this.ROWS));
    cell = Math.max(18, Math.min(cell, 24)); // clamp between 18px and 24px for a grand, tall display

    this.cellSize = cell;
    this.canvas.width = this.COLS * cell;
    this.canvas.height = this.ROWS * cell;

    if (this.nextCanvas) {
      this.nextCanvas.width = 56;
      this.nextCanvas.height = 56;
    }
  }

  getNextFromBag() {
    if (this.bag.length === 0) {
      const keys = Object.keys(this.PIECES);
      // Fisher-Yates shuffle
      for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
      }
      this.bag = keys;
    }
    const type = this.bag.pop();
    const template = this.PIECES[type];
    return {
      type,
      shape: template.shape.map(row => [...row]),
      color: template.color,
      glow: template.glow,
      x: Math.floor(this.COLS / 2) - Math.ceil(template.shape[0].length / 2),
      y: 0
    };
  }

  initEvents() {
    window.addEventListener('resize', () => this.setupCanvas());

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      const sec = document.getElementById('tetrisGameSection');
      if (!sec || sec.classList.contains('hidden')) return;

      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        this.move(-1);
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        this.move(1);
      } else if (['ArrowUp', 'KeyW', 'KeyX'].includes(e.code)) {
        e.preventDefault();
        this.rotate();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        this.softDrop();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'START' || this.state === 'GAMEOVER') {
          this.start();
        } else if (this.state === 'PLAYING') {
          this.hardDrop();
        }
      }
    });

    // Touch D-Pad buttons
    const bindBtn = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.state === 'START' || this.state === 'GAMEOVER') {
          this.start();
          return;
        }
        action();
      });
    };

    bindBtn('tetrisLeft', () => this.move(-1));
    bindBtn('tetrisRight', () => this.move(1));
    bindBtn('tetrisRotate', () => this.rotate());
    bindBtn('tetrisDown', () => this.softDrop());
    bindBtn('tetrisDrop', () => this.hardDrop());

    // Restart button
    const restartBtn = document.getElementById('tetrisRestartBtn');
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.start();
      });
    }

    // Touch swipe support directly on canvas
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      if (this.state !== 'PLAYING') return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = performance.now();
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      if (this.state !== 'PLAYING') return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = performance.now() - touchStartTime;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Tap to rotate
      if (absX < 12 && absY < 12 && dt < 250) {
        this.rotate();
        return;
      }

      // Horizontal swipe
      if (absX > absY && absX > 25) {
        if (dx > 0) this.move(1);
        else this.move(-1);
      }
      // Swipe down
      else if (absY > absX && dy > 30) {
        if (dy > 90) this.hardDrop();
        else this.softDrop();
      }
    }, { passive: true });
  }

  start() {
    const overEl = document.getElementById('tetrisGameOverOverlay');
    if (overEl) overEl.classList.add('hidden');

    this.grid = this.createGrid();
    this.bag = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 800;
    this.clearingRows = [];
    this.particles = [];

    this.currentPiece = this.getNextFromBag();
    this.nextPiece = this.getNextFromBag();
    this.state = 'PLAYING';
    this.lastDropTime = performance.now();

    this.updateHUD();
    this.drawNextPiece();

    if (window.soundEngine) window.soundEngine.playJump();
  }

  updateHUD() {
    const sEl = document.getElementById('tetrisScore');
    const hEl = document.getElementById('tetrisHighScore');
    const lEl = document.getElementById('tetrisLines');
    const lvEl = document.getElementById('tetrisLevel');

    if (sEl) sEl.innerText = this.score;
    if (hEl) hEl.innerText = this.highScore;
    if (lEl) lEl.innerText = this.lines;
    if (lvEl) lvEl.innerText = this.level;
  }

  isValidPosition(piece, offsetX = 0, offsetY = 0) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const newX = piece.x + c + offsetX;
          const newY = piece.y + r + offsetY;

          if (newX < 0 || newX >= this.COLS || newY >= this.ROWS) {
            return false;
          }
          if (newY >= 0 && this.grid[newY][newX]) {
            return false;
          }
        }
      }
    }
    return true;
  }

  move(dir) {
    if (this.state !== 'PLAYING' || !this.currentPiece) return;
    if (this.isValidPosition(this.currentPiece, dir, 0)) {
      this.currentPiece.x += dir;
      this.playBlip(180, 0.04);
    }
  }

  rotate() {
    if (this.state !== 'PLAYING' || !this.currentPiece) return;

    // Transpose and reverse rows for 90deg clockwise rotation
    const original = this.currentPiece.shape;
    const n = original.length;
    const rotated = Array.from({ length: n }, () => Array(n).fill(0));

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        rotated[c][n - 1 - r] = original[r][c];
      }
    }

    const testPiece = { ...this.currentPiece, shape: rotated };

    // Wall kick attempts: [0, -1, 1, -2, 2]
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (this.isValidPosition(testPiece, kick, 0)) {
        this.currentPiece.shape = rotated;
        this.currentPiece.x += kick;
        this.playBlip(320, 0.06);
        return;
      }
    }
  }

  softDrop() {
    if (this.state !== 'PLAYING' || !this.currentPiece) return;
    if (this.isValidPosition(this.currentPiece, 0, 1)) {
      this.currentPiece.y++;
      this.score += 1;
      this.updateHUD();
      this.playBlip(140, 0.03);
    } else {
      this.lockPiece();
    }
  }

  getGhostY() {
    if (!this.currentPiece) return 0;
    let ghostY = this.currentPiece.y;
    while (this.isValidPosition(this.currentPiece, 0, ghostY - this.currentPiece.y + 1)) {
      ghostY++;
    }
    return ghostY;
  }

  hardDrop() {
    if (this.state !== 'PLAYING' || !this.currentPiece) return;
    const ghostY = this.getGhostY();
    const droppedCells = ghostY - this.currentPiece.y;
    this.currentPiece.y = ghostY;
    this.score += droppedCells * 2;
    this.updateHUD();

    this.spawnLockParticles(this.currentPiece);
    this.lockPiece();
    this.playThud();
  }

  lockPiece() {
    if (!this.currentPiece) return;

    // Merge piece into grid
    for (let r = 0; r < this.currentPiece.shape.length; r++) {
      for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
        if (this.currentPiece.shape[r][c]) {
          const gx = this.currentPiece.x + c;
          const gy = this.currentPiece.y + r;
          if (gy < 0) {
            this.gameOver();
            return;
          }
          this.grid[gy][gx] = {
            color: this.currentPiece.color,
            glow: this.currentPiece.glow
          };
        }
      }
    }

    // Check full rows
    this.checkLines();

    // Spawn next piece
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.getNextFromBag();
    this.drawNextPiece();

    // Check immediate game over if spawned in collision
    if (!this.isValidPosition(this.currentPiece)) {
      this.gameOver();
    }
  }

  checkLines() {
    const fullRows = [];
    for (let r = 0; r < this.ROWS; r++) {
      if (this.grid[r].every(cell => cell !== 0)) {
        fullRows.push(r);
      }
    }

    if (fullRows.length > 0) {
      this.clearingRows = fullRows;
      this.clearAnimTimer = 180; // ms flash

      // Scoring table: 1:100, 2:300, 3:500, 4:800 (Tetris!)
      const points = [0, 100, 300, 500, 800];
      const earned = (points[fullRows.length] || 1000) * this.level;
      this.score += earned;
      this.lines += fullRows.length;

      // Increase level every 10 lines
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(120, 800 - (this.level - 1) * 65);

      this.updateHUD();

      if (fullRows.length >= 4) {
        if (window.soundEngine) window.soundEngine.playCelebration();
      } else {
        if (window.soundEngine) window.soundEngine.playScore();
      }

      // Spawn line clear fireworks
      for (const row of fullRows) {
        for (let col = 0; col < this.COLS; col++) {
          this.particles.push({
            x: (col + 0.5) * this.cellSize,
            y: (row + 0.5) * this.cellSize,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            color: ['#00f0ff', '#facc15', '#ffffff', '#ff2a85'][Math.floor(Math.random() * 4)],
            size: Math.random() * 4 + 2,
            life: 1,
            decay: 0.04
          });
        }
      }

      // Remove lines after short flash
      setTimeout(() => {
        for (const row of fullRows) {
          this.grid.splice(row, 1);
          this.grid.unshift(Array(this.COLS).fill(0));
        }
        this.clearingRows = [];
      }, 140);
    }
  }

  spawnLockParticles(piece) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const px = (piece.x + c + 0.5) * this.cellSize;
          const py = (piece.y + r + 1) * this.cellSize;
          for (let i = 0; i < 3; i++) {
            this.particles.push({
              x: px,
              y: py,
              vx: (Math.random() - 0.5) * 3,
              vy: -Math.random() * 2,
              color: piece.color,
              size: Math.random() * 3 + 1,
              life: 1,
              decay: 0.06
            });
          }
        }
      }
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    if (window.soundEngine) window.soundEngine.playTrip();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('tetris_high_score', this.highScore);
    }

    if (window.leaderboard) {
      window.leaderboard.submitScore('tetris', this.score);
    }

    setTimeout(() => {
      const overEl = document.getElementById('tetrisGameOverOverlay');
      if (overEl) overEl.classList.remove('hidden');
      const fScore = document.getElementById('tetrisFinalScore');
      const fHigh = document.getElementById('tetrisFinalHighScore');
      if (fScore) fScore.innerText = this.score;
      if (fHigh) fHigh.innerText = this.highScore;
    }, 350);
  }

  playBlip(freq, duration) {
    if (!window.soundEngine || window.soundEngine.isMuted()) return;
    try {
      window.soundEngine.init();
      const ctx = window.soundEngine.ctx;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }

  playThud() {
    if (!window.soundEngine || window.soundEngine.isMuted()) return;
    try {
      window.soundEngine.init();
      const ctx = window.soundEngine.ctx;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  update(now) {
    if (this.state === 'PLAYING') {
      if (now - this.lastDropTime > this.dropInterval) {
        if (this.isValidPosition(this.currentPiece, 0, 1)) {
          this.currentPiece.y++;
        } else {
          this.lockPiece();
        }
        this.lastDropTime = now;
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Matrix Background Grid
    this.drawBackgroundGrid();

    // 2. Locked blocks in grid
    this.drawLockedBlocks();

    // 3. Current falling piece (Ghost piece hint removed as requested)
    if (this.state === 'PLAYING' && this.currentPiece) {
      this.drawPiece(this.currentPiece);
    }

    // 4. Line clear flash
    if (this.clearingRows.length > 0) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (const row of this.clearingRows) {
        this.ctx.fillRect(0, row * this.cellSize, this.canvas.width, this.cellSize);
      }
    }

    // 5. Particles
    this.drawParticles();
  }

  drawBackgroundGrid() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cell = this.cellSize;

    // Deep synthwave cyber background
    const grad = this.ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0d1f');
    grad.addColorStop(1, '#050712');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    // Subtle neon grid lines
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
    this.ctx.lineWidth = 1;

    for (let c = 1; c < this.COLS; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * cell, 0);
      this.ctx.lineTo(c * cell, h);
      this.ctx.stroke();
    }
    for (let r = 1; r < this.ROWS; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * cell);
      this.ctx.lineTo(w, r * cell);
      this.ctx.stroke();
    }
  }

  drawBlock(x, y, color, isGhost = false) {
    const size = this.cellSize;
    const pad = 1.5;
    const bx = x * size + pad;
    const by = y * size + pad;
    const bw = size - pad * 2;
    const bh = size - pad * 2;
    const rad = 3;

    this.ctx.save();
    if (isGhost) {
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1.2;
      this.ctx.strokeRect(bx, by, bw, bh);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      this.ctx.fillRect(bx, by, bw, bh);
    } else {
      // Glow
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 6;

      // Solid block fill
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.roundRect(bx, by, bw, bh, rad);
      this.ctx.fill();

      // Top-left shiny glossy bevel highlight
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      this.ctx.beginPath();
      this.ctx.moveTo(bx, by);
      this.ctx.lineTo(bx + bw, by);
      this.ctx.lineTo(bx + bw - 3, by + 3);
      this.ctx.lineTo(bx + 3, by + 3);
      this.ctx.lineTo(bx + 3, by + bh - 3);
      this.ctx.lineTo(bx, by + bh);
      this.ctx.closePath();
      this.ctx.fill();

      // Dark inner bevel
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.beginPath();
      this.ctx.moveTo(bx + bw, by);
      this.ctx.lineTo(bx + bw, by + bh);
      this.ctx.lineTo(bx, by + bh);
      this.ctx.lineTo(bx + 3, by + bh - 3);
      this.ctx.lineTo(bx + bw - 3, by + bh - 3);
      this.ctx.lineTo(bx + bw - 3, by + 3);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawLockedBlocks() {
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const cell = this.grid[r][c];
        if (cell) {
          this.drawBlock(c, r, cell.color);
        }
      }
    }
  }

  drawGhostPiece() {
    const ghostY = this.getGhostY();
    if (ghostY === this.currentPiece.y) return;

    for (let r = 0; r < this.currentPiece.shape.length; r++) {
      for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
        if (this.currentPiece.shape[r][c]) {
          this.drawBlock(this.currentPiece.x + c, ghostY + r, this.currentPiece.color, true);
        }
      }
    }
  }

  drawPiece(piece) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          this.drawBlock(piece.x + c, piece.y + r, piece.color);
        }
      }
    }
  }

  drawNextPiece() {
    if (!this.nextCtx || !this.nextPiece) return;
    const w = this.nextCanvas.width;
    const h = this.nextCanvas.height;
    this.nextCtx.clearRect(0, 0, w, h);

    const shape = this.nextPiece.shape;
    const cols = shape[0].length;
    const rows = shape.length;
    const cell = Math.min(Math.floor((w - 8) / cols), Math.floor((h - 8) / rows), 13);
    const shapeW = cols * cell;
    const shapeH = rows * cell;
    const ox = Math.floor((w - shapeW) / 2);
    const oy = Math.floor((h - shapeH) / 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (shape[r][c]) {
          const bx = ox + c * cell + 0.5;
          const by = oy + r * cell + 0.5;
          const bw = cell - 1;
          const bh = cell - 1;

          this.nextCtx.save();
          this.nextCtx.shadowColor = this.nextPiece.color;
          this.nextCtx.shadowBlur = 4;
          this.nextCtx.fillStyle = this.nextPiece.color;
          this.nextCtx.beginPath();
          this.nextCtx.roundRect(bx, by, bw, bh, 2);
          this.nextCtx.fill();

          this.nextCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          this.nextCtx.fillRect(bx + 0.5, by + 0.5, bw - 1, 1.5);
          this.nextCtx.restore();
        }
      }
    }
  }

  drawParticles() {
    this.ctx.save();
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  loop(now) {
    this.update(now);
    this.draw();
    requestAnimationFrame(this.loop);
  }
}
