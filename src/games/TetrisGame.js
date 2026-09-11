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
    this.pauseButtonRect = null;

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
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        this.togglePause();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'PAUSED') {
          this.togglePause();
        } else if (this.state === 'GAMEOVER') {
          this.removeGameOverOverlay();
          this.start();
          if (this.onPlayAgainCallback) {
            this.onPlayAgainCallback();
          }
        } else if (this.state === 'IDLE' || this.state === 'START') {
          this.start();
        } else if (this.state === 'PLAYING') {
          this.hardDrop();
        }
      }
    };
    this.addListener(window, 'keydown', handleKeyDown);

    // Touch swipe gestures & Pause button tap
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = performance.now();

      const coords = this.getCanvasCoords(t);

      // Nếu đang tạm dừng, chạm vào vùng chơi hoặc nút Pause để tiếp tục
      if (this.state === 'PAUSED') {
        if (coords.x <= this.boardWidth || this.isInsidePauseButton(coords.x, coords.y)) {
          this.togglePause();
          return;
        }
      }

      // Nhấn nút Pause khi đang chơi
      if (this.isInsidePauseButton(coords.x, coords.y)) {
        this.togglePause();
        return;
      }

      if (this.state === 'IDLE' || this.state === 'START') {
        this.start();
        return;
      }
    };

    const handleTouchEnd = (e) => {
      if (this.state !== 'PLAYING') return;
      const t = e.changedTouches[0];
      const coords = this.getCanvasCoords(t);

      // Tránh kích hoạt vuốt nếu chạm vào nút Pause
      if (this.isInsidePauseButton(coords.x, coords.y)) return;

      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = performance.now() - touchStartTime;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Chạm nhẹ để xoay (nếu không phải nút bấm)
      if (absX < 14 && absY < 14 && dt < 250) {
        if (coords.x <= this.boardWidth) {
          this.rotate();
        }
        return;
      }

      // Vuốt ngang sang trái/phải
      if (absX > absY && absX > 25) {
        if (dx > 0) this.move(1);
        else this.move(-1);
      }
      // Vuốt dọc xuống để thả
      else if (absY > absX && dy > 30) {
        if (dy > 80) this.hardDrop();
        else this.softDrop();
      }
    };

    this.addListener(this.canvas, 'touchstart', handleTouchStart, { passive: true });
    this.addListener(this.canvas, 'touchend', handleTouchEnd, { passive: true });

    // Pointer event cho Desktop (Click chuột vào nút Pause hoặc bấm tiếp tục)
    const handlePointerDown = (e) => {
      if (e.pointerType === 'touch') return; // Đã xử lý ở touchstart

      const coords = this.getCanvasCoords(e);
      if (this.state === 'PAUSED') {
        if (coords.x <= this.boardWidth || this.isInsidePauseButton(coords.x, coords.y)) {
          this.togglePause();
          return;
        }
      }

      if (this.isInsidePauseButton(coords.x, coords.y)) {
        this.togglePause();
        return;
      }

      if (this.state === 'IDLE' || this.state === 'START') {
        this.start();
      }
    };
    this.addListener(this.canvas, 'pointerdown', handlePointerDown);

    // Đổi con trỏ chuột khi hover vào nút Pause
    const handleMouseMove = (e) => {
      const coords = this.getCanvasCoords(e);
      if (this.isInsidePauseButton(coords.x, coords.y)) {
        this.canvas.style.cursor = 'pointer';
      } else if (this.state === 'PAUSED' && coords.x <= this.boardWidth) {
        this.canvas.style.cursor = 'pointer';
      } else {
        this.canvas.style.cursor = 'default';
      }
    };
    this.addListener(this.canvas, 'mousemove', handleMouseMove);

    this.draw();
  }

  getCanvasCoords(e) {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  isInsidePauseButton(x, y) {
    if (!this.pauseButtonRect) return false;
    const { x: bx, y: by, w: bw, h: bh } = this.pauseButtonRect;
    // Bổ sung đệm chạm 8px để người dùng mobile dễ bấm trúng
    return x >= bx - 8 && x <= bx + bw + 8 && y >= by - 8 && y <= by + bh + 8;
  }

  drawRoundedRect(x, y, w, h, r) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  handleResize() {
    this.setupCanvas();
    this.draw();
  }

  setupCanvas() {
    if (!this.canvas) return;
    const viewport = document.getElementById('canvasViewport');
    const viewportW = viewport ? viewport.clientWidth : window.innerWidth;
    // Chiều rộng tối đa cân đối theo màn hình, loại bỏ hoàn toàn viền đen 2 bên
    const maxW = Math.floor(Math.min(viewportW > 0 ? viewportW * 0.94 : 380, 400));
    
    // Chiều cao có sẵn đảm bảo không bị tràn màn hình mobile
    const viewportH = viewport ? viewport.clientHeight : 500;
    const maxH = Math.floor(Math.min(viewportH > 150 ? viewportH : (window.innerHeight - 160), 520));

    // Cột sidebar chứa thông tin
    const minSidebarW = 104;
    let cell = Math.floor(Math.min((maxW - minSidebarW) / this.COLS, maxH / this.ROWS));
    cell = Math.max(16, Math.min(cell, 28));

    this.cellSize = cell;
    this.boardWidth = this.COLS * cell;
    // Cột thông tin tự động mở rộng để canvas tràn khít toàn bộ chiều ngang khung chơi
    this.sidebarWidth = Math.max(minSidebarW, maxW - this.boardWidth);

    const totalW = this.boardWidth + this.sidebarWidth;
    const totalH = this.boardHeight = this.ROWS * cell;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = totalW * dpr;
    this.canvas.height = totalH * dpr;
    this.canvas.style.width = `${totalW}px`;
    this.canvas.style.height = `${totalH}px`;
    // Xóa bo góc dưới bên trái của canvas và khung ngoài để không bị lẹm góc gạch
    this.canvas.style.borderBottomLeftRadius = '0px';
    if (this.canvas.parentElement) {
      this.canvas.parentElement.style.borderBottomLeftRadius = '0px';
      this.canvas.parentElement.classList.add('tetris-frame');
    }

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
    this.removeGameOverOverlay();
    this.grid = this.createGrid();
    this.bag = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.highScore = parseInt(localStorage.getItem('tetris_high_score') || '0', 10);
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

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      soundEngine.playBlip(200, 0.05);
      this.draw();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.lastDropTime = performance.now();
      soundEngine.playBlip(350, 0.05);
      this.animationId = requestAnimationFrame(this.loop);
    }
  }

  updateScore(newScore) {
    super.updateScore(newScore);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('tetris_high_score', this.highScore);
    }
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
      // Cứ xóa được 10 hàng (lines) thì tăng 1 Cấp độ (Level)
      this.level = Math.floor(this.lines / 10) + 1;
      // Tốc độ rơi theo Cấp độ (dropInterval): Level 1 là 800ms, mỗi Level tăng theo hàm mũ Math.pow(0.85, level - 1), sàn tối thiểu 120ms
      this.dropInterval = Math.max(120, Math.round(800 * Math.pow(0.85, this.level - 1)));

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
    this.showGameOverOverlay({
      title: 'GAME OVER!',
      score: this.score,
      highScore: this.highScore,
      subtitle: `Cấp độ: ${this.level} • Số hàng đã xóa: ${this.lines}`
    });
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

    // Border separating board and next piece sidebar (viền mảnh hiện đại)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
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

    // Sidebar: Next Piece, Stats & Pause Button (Căn giữa theo logic flex space-around, text-align center)
    const sbW = this.sidebarWidth || 104;
    const sideCenterX = bw + sbW / 2;
    const totalH = this.height;
    const slotH = totalH / 5;

    const slot0CenterY = slotH * 0.5;
    const slot1CenterY = slotH * 1.5;
    const slot2CenterY = slotH * 2.5;
    const slot3CenterY = slotH * 3.5;
    const slot4CenterY = slotH * 4.5;

    // --- MỤC 0: KHỐI TIẾP THEO ---
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = 'bold 13px Roboto, sans-serif';
    if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '1px';
    this.ctx.fillText('TIẾP THEO', sideCenterX, slot0CenterY - 26);
    this.ctx.restore();

    // Khung hiển thị gạch "TIẾP THEO" căn chính giữa cột
    const boxW = Math.min(sbW - 24, 72);
    const boxH = Math.min(slotH - 38, 56);
    const boxX = sideCenterX - boxW / 2;
    const boxY = slot0CenterY - 8;

    this.ctx.save();
    this.drawRoundedRect(boxX, boxY, boxW, boxH, 10);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    this.ctx.restore();

    if (this.nextPiece) {
      const miniCs = Math.max(10, Math.min(13, Math.floor(cs * 0.62)));
      const shape = this.nextPiece.shape;
      const pieceCols = shape[0].length;
      const pieceRows = shape.length;
      const pieceW = pieceCols * miniCs;
      const pieceH = pieceRows * miniCs;
      const startX = sideCenterX - pieceW / 2;
      const startY = boxY + (boxH - pieceH) / 2;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
            this.drawBlock(startX + c * miniCs, startY + r * miniCs, this.nextPiece.color, this.nextPiece.glow, miniCs);
          }
        }
      }
    }

    // --- MỤC 1: KỶ LỤC (ĐIỂM CAO NHẤT) ---
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = 'bold 13px Roboto, sans-serif';
    if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '1px';
    this.ctx.fillText('KỶ LỤC', sideCenterX, slot1CenterY - 16);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '700 23px Roboto, "JetBrains Mono", monospace';
    if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '0px';
    this.ctx.fillText(`${this.highScore.toLocaleString()}`, sideCenterX, slot1CenterY + 14);
    this.ctx.restore();

    // --- MỤC 2: ĐIỂM SỐ HIỆN TẠI (DƯỚI KỶ LỤC) ---
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = 'bold 13px Roboto, sans-serif';
    if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '1px';
    this.ctx.fillText('ĐIỂM', sideCenterX, slot2CenterY - 16);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '700 23px Roboto, "JetBrains Mono", monospace';
    if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '0px';
    this.ctx.fillText(`${this.score.toLocaleString()}`, sideCenterX, slot2CenterY + 14);
    this.ctx.restore();

    // --- MỤC 3: CẤP ĐỘ ---
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = 'bold 13px Roboto, sans-serif';
    if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '1px';
    this.ctx.fillText('CẤP ĐỘ', sideCenterX, slot3CenterY - 16);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '700 23px Roboto, "JetBrains Mono", monospace';
    if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '0px';
    this.ctx.fillText(`${this.level}`, sideCenterX, slot3CenterY + 14);
    this.ctx.restore();

    // --- MỤC 4: NÚT TẠM DỪNG (PAUSE BUTTON) ---
    const btnW = Math.max(48, Math.min(sbW - 24, 58));
    const btnH = 48;
    const btnX = sideCenterX - btnW / 2;
    const btnY = slot4CenterY - btnH / 2;
    this.pauseButtonRect = { x: btnX, y: btnY, w: btnW, h: btnH };

    this.ctx.save();
    this.drawRoundedRect(btnX, btnY, btnW, btnH, 12);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Icon trắng tinh căn giữa (Pause 2 vạch hoặc Play tam giác)
    this.ctx.fillStyle = '#ffffff';
    if (this.state === 'PAUSED') {
      // Icon Play ▶
      this.ctx.beginPath();
      this.ctx.moveTo(sideCenterX - 5, slot4CenterY - 9);
      this.ctx.lineTo(sideCenterX + 7, slot4CenterY);
      this.ctx.lineTo(sideCenterX - 5, slot4CenterY + 9);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      // Icon Pause ⏸ (2 vạch đứng màu trắng)
      const barW = 3.5;
      const barH = 16;
      const gap = 5;
      const barY = slot4CenterY - barH / 2;
      this.ctx.fillRect(sideCenterX - gap / 2 - barW, barY, barW, barH);
      this.ctx.fillRect(sideCenterX + gap / 2, barY, barW, barH);
    }
    this.ctx.restore();

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
    } else if (this.state === 'PAUSED') {
      this.ctx.fillStyle = 'rgba(10, 13, 24, 0.88)';
      this.ctx.fillRect(0, 0, bw, bh);

      // Icon Pause 2 vạch trắng trên overlay
      const pBarW = 5;
      const pBarH = 24;
      const pGap = 8;
      const pBarY = bh / 2 - 32;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(bw / 2 - pGap / 2 - pBarW, pBarY, pBarW, pBarH);
      this.ctx.fillRect(bw / 2 + pGap / 2, pBarY, pBarW, pBarH);

      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 20px Roboto, sans-serif';
      if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '1px';
      this.ctx.fillText('ĐÃ TẠM DỪNG', bw / 2, bh / 2 + 10);

      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '13px Roboto, sans-serif';
      if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = '0px';
      this.ctx.fillText('Chạm màn hình để chơi tiếp', bw / 2, bh / 2 + 36);
    } else if (this.state === 'GAMEOVER') {
      this.ctx.fillStyle = 'rgba(10, 13, 24, 0.85)';
      this.ctx.fillRect(0, 0, bw, bh);
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

  destroy() {
    super.destroy();
    if (this.canvas) {
      this.canvas.style.borderBottomLeftRadius = '';
      if (this.canvas.parentElement) {
        this.canvas.parentElement.style.borderBottomLeftRadius = '';
        this.canvas.parentElement.classList.remove('tetris-frame');
      }
    }
  }
}
