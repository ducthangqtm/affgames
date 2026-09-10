import { BaseGame } from './BaseGame.js';
import { soundEngine } from './SoundEngine.js';

export class TetrisGame extends BaseGame {
  constructor() {
    super();
    this.COLS = 10;
    this.ROWS = 20;
    this.cellSize = 20;

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
        glow: 'rgba(168, 85, 247, 0.6)'
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

    this.lines = 0;
    this.level = 1;
    this.highScore = parseInt(localStorage.getItem('tetris_high_score') || '0', 10);
    this.dropInterval = 800;
    this.lastDropTime = 0;
    this.clearingRows = [];
    this.clearAnimTimer = 0;
    this.particles = [];

    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  createGrid() {
    return Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));
  }

  init(canvas, options = {}) {
    super.init(canvas, options);
    this.setupCanvas();

    this.addListener(window, 'resize', this.handleResize);

    // Keyboard controls
    const handleKeyDown = (e) => {
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
        if (this.state === 'IDLE' || this.state === 'START' || this.state === 'GAMEOVER') {
          this.start();
        } else if (this.state === 'PLAYING') {
          this.hardDrop();
        }
      }
    };
    this.addListener(window, 'keydown', handleKeyDown);

    // Touch swipe gestures
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e) => {
      if (this.state === 'IDLE' || this.state === 'START' || this.state === 'GAMEOVER') {
        this.start();
        return;
      }
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = performance.now();
    };

    const handleTouchEnd = (e) => {
      if (this.state !== 'PLAYING') return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = performance.now() - touchStartTime;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Tap to rotate
      if (absX < 14 && absY < 14 && dt < 250) {
        this.rotate();
        return;
      }

      // Horizontal swipe
      if (absX > absY && absX > 25) {
        if (dx > 0) this.move(1);
        else this.move(-1);
      }
      // Vertical swipe
      else if (absY > absX && dy > 30) {
        if (dy > 80) this.hardDrop();
        else this.softDrop();
      }
    };

    this.addListener(this.canvas, 'touchstart', handleTouchStart, { passive: true });
    this.addListener(this.canvas, 'touchend', handleTouchEnd, { passive: true });

    this.draw();
  }

  handleResize() {
    this.setupCanvas();
    this.draw();
  }

  setupCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const parentW = parent ? parent.clientWidth : Math.min(window.innerWidth * 0.92, 420);

    const maxW = Math.min(parentW || 380, 420);
    const maxH = Math.min(window.innerHeight * 0.65, 540);

    const sidebarWidth = 96;
    let cell = Math.floor(Math.min((maxW - sidebarWidth) / this.COLS, maxH / this.ROWS));
    cell = Math.max(18, Math.min(cell, 28));

    this.cellSize = cell;
    this.boardWidth = this.COLS * cell;
    this.boardHeight = this.ROWS * cell;
    this.sidebarWidth = sidebarWidth;

    const totalW = this.boardWidth + sidebarWidth;
    const totalH = this.boardHeight;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = totalW * dpr;
    this.canvas.height = totalH * dpr;
    this.canvas.style.width = `${totalW}px`;
    this.canvas.style.height = `${totalH}px`;

    this.ctx.scale(dpr, dpr);
    this.width = totalW;
    this.height = totalH;
  }

  getNextFromBag() {
    if (this.bag.length === 0) {
      const keys = Object.keys(this.PIECES);
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

  start() {
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
    this.updateScore(0);

    soundEngine.playJump();

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.animationId = requestAnimationFrame(this.loop);
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
      soundEngine.playBlip(180, 0.04);
      this.draw();
    }
  }

  rotate() {
    if (this.state !== 'PLAYING' || !this.currentPiece) return;

    const original = this.currentPiece.shape;
    const n = original.length;
    const rotated = Array.from({ length: n }, () => Array(n).fill(0));

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        rotated[c][n - 1 - r] = original[r][c];
      }
    }

    const testPiece = { ...this.currentPiece, shape: rotated };
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (this.isValidPosition(testPiece, kick, 0)) {
        this.currentPiece.shape = rotated;
        this.currentPiece.x += kick;
        soundEngine.playBlip(320, 0.06);
        this.draw();
        return;
      }
    }
  }

  softDrop() {
    if (this.state !== 'PLAYING' || !this.currentPiece) return;
    if (this.isValidPosition(this.currentPiece, 0, 1)) {
      this.currentPiece.y++;
      this.score += 1;
      this.updateScore(this.score);
      soundEngine.playBlip(140, 0.03);
      this.draw();
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
    this.updateScore(this.score);

    this.spawnLockParticles(this.currentPiece);
    this.lockPiece();
    soundEngine.playThud();
  }

  lockPiece() {
    if (!this.currentPiece) return;

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

    this.checkLines();

    this.currentPiece = this.nextPiece;
    this.nextPiece = this.getNextFromBag();

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
      this.clearAnimTimer = 180;

      const points = [0, 100, 300, 500, 800];
      const earned = (points[fullRows.length] || 1000) * this.level;
      this.score += earned;
      this.lines += fullRows.length;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(120, 800 - (this.level - 1) * 65);

      this.updateScore(this.score);

      if (fullRows.length >= 4) {
        soundEngine.playCelebration();
      } else {
        soundEngine.playScore();
      }

      for (const row of fullRows) {
        for (let col = 0; col < this.COLS; col++) {
          this.particles.push({
            x: (col + 0.5) * this.cellSize,
            y: (row + 0.5) * this.cellSize,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            color: '#00f0ff',
            life: 1,
            size: Math.random() * 4 + 2
          });
        }
      }

      for (const row of fullRows) {
        this.grid.splice(row, 1);
        this.grid.unshift(Array(this.COLS).fill(0));
      }
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
              life: 0.6,
              size: 2
            });
          }
        }
      }
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    soundEngine.playTrip();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('tetris_high_score', this.highScore);
    }
    this.triggerGameOver(this.score);
  }

  draw() {
    if (!this.ctx) return;
    const cs = this.cellSize;
    const bw = this.boardWidth;
    const bh = this.boardHeight;

    this.ctx.fillStyle = '#0a0d18';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Board area
    this.ctx.fillStyle = '#0e1322';
    this.ctx.fillRect(0, 0, bw, bh);

    // Grid lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    this.ctx.lineWidth = 1;
    for (let r = 0; r <= this.ROWS; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * cs);
      this.ctx.lineTo(bw, r * cs);
      this.ctx.stroke();
    }
    for (let c = 0; c <= this.COLS; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * cs, 0);
      this.ctx.lineTo(c * cs, bh);
      this.ctx.stroke();
    }

    // Border separating board and next piece sidebar
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(bw, 0);
    this.ctx.lineTo(bw, bh);
    this.ctx.stroke();

    // Locked blocks
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const cell = this.grid[r][c];
        if (cell) {
          this.drawBlock(c * cs, r * cs, cell.color, cell.glow);
        }
      }
    }
    // Current piece (Ghost piece tắt hoàn toàn theo yêu cầu)
    if (this.state === 'PLAYING' && this.currentPiece) {
      for (let r = 0; r < this.currentPiece.shape.length; r++) {
        for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
          if (this.currentPiece.shape[r][c]) {
            const px = (this.currentPiece.x + c) * cs;
            const py = (this.currentPiece.y + r) * cs;
            this.drawBlock(px, py, this.currentPiece.color, this.currentPiece.glow);
          }
        }
      }
    }

    // Sidebar: Next Piece & Stats (Căn giữa đẹp mắt, không sát viền)
    const sbW = this.sidebarWidth || 96;
    const sideCenterX = bw + sbW / 2;

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.fillText('TIẾP THEO', sideCenterX, 24);

    if (this.nextPiece) {
      const miniCs = Math.max(12, Math.floor(cs * 0.72));
      const shape = this.nextPiece.shape;
      const pieceCols = shape[0].length;
      const pieceW = pieceCols * miniCs;
      const startX = sideCenterX - pieceW / 2;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            this.drawBlock(startX + c * miniCs, 36 + r * miniCs, this.nextPiece.color, this.nextPiece.glow, miniCs);
          }
        }
      }
    }

    // Level & Lines stats
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.fillText('CẤP ĐỘ', sideCenterX, 130);
    this.ctx.fillStyle = '#facc15';
    this.ctx.font = 'bold 18px "JetBrains Mono", monospace';
    this.ctx.fillText(`${this.level}`, sideCenterX, 154);

    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.fillText('HÀNG XÓA', sideCenterX, 192);
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = 'bold 18px "JetBrains Mono", monospace';
    this.ctx.fillText(`${this.lines}`, sideCenterX, 216);

    // Particles
    this.ctx.save();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    this.ctx.restore();

    // Overlays
    if (this.state === 'IDLE' || this.state === 'START') {
      this.ctx.fillStyle = 'rgba(10, 13, 24, 0.75)';
      this.ctx.fillRect(0, 0, bw, bh);
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.font = 'bold 18px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('XẾP HÌNH NEON', bw / 2, bh / 2 - 15);
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '12px sans-serif';
      this.ctx.fillText('Chạm hoặc bấm Space để chơi', bw / 2, bh / 2 + 15);
    } else if (this.state === 'GAMEOVER') {
      this.ctx.fillStyle = 'rgba(10, 13, 24, 0.85)';
      this.ctx.fillRect(0, 0, bw, bh);
      this.ctx.fillStyle = '#f43f5e';
      this.ctx.font = 'bold 20px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('GAME OVER!', bw / 2, bh / 2 - 20);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 14px sans-serif';
      this.ctx.fillText(`Điểm: ${this.score}`, bw / 2, bh / 2 + 8);
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.fillText('Chạm để chơi lại', bw / 2, bh / 2 + 35);
    }
  }

  drawBlock(x, y, color, glow, size = this.cellSize) {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = glow;
    this.ctx.shadowBlur = 6;
    this.ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

    // Bevel highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    this.ctx.fillRect(x + 2, y + 2, size - 4, 2);
    this.ctx.fillRect(x + 2, y + 2, 2, size - 4);
    this.ctx.restore();
  }

  loop(timestamp) {
    if (this.state === 'PLAYING') {
      if (timestamp - this.lastDropTime > this.dropInterval) {
        if (this.isValidPosition(this.currentPiece, 0, 1)) {
          this.currentPiece.y++;
        } else {
          this.lockPiece();
        }
        this.lastDropTime = timestamp;
      }
    }

    this.draw();

    if (this.state === 'PLAYING' || this.state === 'GAMEOVER') {
      this.animationId = requestAnimationFrame(this.loop);
    }
  }
}
