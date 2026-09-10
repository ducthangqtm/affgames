import { BaseGame } from './BaseGame.js';
import { soundEngine } from './SoundEngine.js';

export class Game2048 extends BaseGame {
  constructor() {
    super();
    this.size = 4;
    this.grid = [];
    this.highScore = parseInt(localStorage.getItem('2048_high_score') || '0', 10);
    this.over = false;

    // Neon palette for 2048 tiles (Sống động, rực rỡ, độ tương phán cao)
    this.tileStyles = {
      0: { bg: 'rgba(255, 255, 255, 0.04)', text: '#ffffff', glow: 'transparent' },
      2: { bg: '#0284c7', text: '#ffffff', glow: 'rgba(2, 132, 199, 0.5)' },          // Nền xanh lơ sáng (#0284c7), chữ trắng
      4: { bg: '#059669', text: '#ffffff', glow: 'rgba(5, 150, 105, 0.5)' },          // Nền xanh ngọc đậm (#059669), chữ trắng
      8: { bg: '#ea580c', text: '#ffffff', glow: 'rgba(234, 88, 12, 0.6)' },          // Nền cam rực (#ea580c), chữ trắng
      16: { bg: '#dc2626', text: '#ffffff', glow: 'rgba(220, 38, 38, 0.65)' },       // Nền cam đỏ chói (#dc2626), chữ trắng
      32: { bg: '#fbc02d', text: '#0f172a', glow: 'rgba(251, 192, 45, 0.7)' },       // Nền vàng chanh rực rỡ (#fbc02d), chữ đen đậm
      64: { bg: '#db2777', text: '#ffffff', glow: 'rgba(219, 39, 119, 0.7)' },       // Nền hồng cánh sen (#db2777), chữ trắng
      128: { bg: '#9333ea', text: '#ffffff', glow: 'rgba(147, 51, 234, 0.75)' },     // Nền tím neon (#9333ea), chữ trắng, hiệu ứng glow nhẹ
      256: { bg: '#6366f1', text: '#ffffff', glow: 'rgba(99, 102, 241, 0.8)' },      // Nền tím xanh đậm (#6366f1), chữ trắng
      512: { bg: '#2563eb', text: '#ffffff', glow: 'rgba(37, 99, 235, 0.85)' },      // Nền xanh dương đậm (#2563eb), chữ trắng
      1024: { bg: '#ffd700', text: '#000000', glow: '#ffd700' },                     // Nền vàng kim cương gold (#ffd700), chữ đen đậm, bóng viền vàng
      2048: { bg: 'rainbow', text: '#ffffff', glow: 'rgba(255, 0, 128, 0.95)' },     // Gradient cầu vồng neon rực lửa, chữ trắng kèm hào quang
      4096: { bg: '#f43f5e', text: '#ffffff', glow: 'rgba(244, 63, 94, 1.0)' }
    };

    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  init(canvas, options = {}) {
    super.init(canvas, options);
    this.setupCanvas();

    this.addListener(window, 'resize', this.handleResize);

    // Keyboard controls
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); this.move('UP'); }
      else if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); this.move('DOWN'); }
      else if (['ArrowLeft', 'KeyA'].includes(e.code)) { e.preventDefault(); this.move('LEFT'); }
      else if (['ArrowRight', 'KeyD'].includes(e.code)) { e.preventDefault(); this.move('RIGHT'); }

      if (this.state === 'GAMEOVER' && e.code === 'Space') {
        this.start();
      }
    };
    this.addListener(window, 'keydown', handleKeyDown);

    // Touch swipe gestures
    let startX = 0, startY = 0;
    let isTouching = false;
    let hasMovedThisTouch = false;

    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isTouching = true;
      hasMovedThisTouch = false;
    };

    const handleTouchMove = (e) => {
      if (!isTouching || hasMovedThisTouch || e.touches.length !== 1) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - startX;
      const dy = currentY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) > 22) {
        hasMovedThisTouch = true;
        if (absDx > absDy) {
          this.move(dx > 0 ? 'RIGHT' : 'LEFT');
        } else {
          this.move(dy > 0 ? 'DOWN' : 'UP');
        }
      }
    };

    const handleTouchEnd = () => {
      isTouching = false;
      hasMovedThisTouch = false;
    };

    this.addListener(this.canvas, 'touchstart', handleTouchStart, { passive: true });
    this.addListener(this.canvas, 'touchmove', handleTouchMove, { passive: true });
    this.addListener(this.canvas, 'touchend', handleTouchEnd, { passive: true });
    this.addListener(this.canvas, 'touchcancel', handleTouchEnd, { passive: true });

    this.resetGrid();
    this.draw();
  }

  handleResize() {
    this.setupCanvas();
    this.draw();
  }

  setupCanvas() {
    if (!this.canvas) return;
    const viewport = document.getElementById('canvasViewport');
    const viewportW = viewport ? viewport.clientWidth : window.innerWidth;
    // Mở rộng bề ngang tương đương game Xếp Hình (90-94% viewport mobile, max 400px)
    const targetW = Math.floor(Math.min(viewportW > 0 ? viewportW * 0.94 : 380, 400));
    const viewportH = viewport ? viewport.clientHeight : 500;
    const maxH = Math.floor(Math.min(viewportH > 150 ? viewportH : (window.innerHeight - 150), 460));
    const size = Math.floor(Math.min(targetW, maxH));

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.scale(dpr, dpr);
    this.width = size;
    this.height = size;
  }

  resetGrid() {
    this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    this.score = 0;
    this.over = false;
    this.addRandomTile();
    this.addRandomTile();
    this.updateScore(0);
  }

  start() {
    this.state = 'PLAYING';
    this.resetGrid();
    this.draw();

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.animationId = requestAnimationFrame(this.loop);
  }

  addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) emptyCells.push({ r, c });
      }
    }
    if (emptyCells.length > 0) {
      const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
      return { r, c };
    }
    return null;
  }

  move(dir) {
    if (this.state !== 'PLAYING') {
      if (this.state === 'IDLE' || this.state === 'START') {
        this.start();
      } else {
        return;
      }
    }
    if (this.over) return;
    let scoreGained = 0;

    const slideRow = (row) => {
      let arr = row.filter(val => val !== 0);
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === arr[i + 1]) {
          arr[i] *= 2;
          scoreGained += arr[i];
          arr.splice(i + 1, 1);
        }
      }
      while (arr.length < this.size) arr.push(0);
      return arr;
    };

    const prevGrid = JSON.stringify(this.grid);

    if (dir === 'LEFT') {
      for (let r = 0; r < this.size; r++) this.grid[r] = slideRow(this.grid[r]);
    } else if (dir === 'RIGHT') {
      for (let r = 0; r < this.size; r++) this.grid[r] = slideRow(this.grid[r].reverse()).reverse();
    } else if (dir === 'UP') {
      for (let c = 0; c < this.size; c++) {
        let col = [this.grid[0][c], this.grid[1][c], this.grid[2][c], this.grid[3][c]];
        col = slideRow(col);
        for (let r = 0; r < this.size; r++) this.grid[r][c] = col[r];
      }
    } else if (dir === 'DOWN') {
      for (let c = 0; c < this.size; c++) {
        let col = [this.grid[3][c], this.grid[2][c], this.grid[1][c], this.grid[0][c]];
        col = slideRow(col);
        for (let r = 0; r < this.size; r++) this.grid[3 - r][c] = col[r];
      }
    }

    if (JSON.stringify(this.grid) !== prevGrid) {
      if (scoreGained > 0) {
        this.score += scoreGained;
        soundEngine.playScore();
      }

      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('2048_high_score', this.highScore);
      }
      this.updateScore(this.score);

      this.addRandomTile();
      this.checkGameOver();
      this.draw();
    }
  }

  checkGameOver() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0) return;
        if (r < this.size - 1 && this.grid[r][c] === this.grid[r + 1][c]) return;
        if (c < this.size - 1 && this.grid[r][c] === this.grid[r][c + 1]) return;
      }
    }
    this.over = true;
    this.state = 'GAMEOVER';
    soundEngine.playTrip();
    this.triggerGameOver(this.score);
    this.draw();
  }

  draw() {
    if (!this.ctx) return;
    const w = this.width;
    const h = this.height;
    const padding = 8;
    const gap = 8;
    const boardSize = w - padding * 2;
    const cellSize = (boardSize - gap * (this.size - 1)) / this.size;

    // Board background
    this.ctx.fillStyle = '#0a0f1d';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.fillStyle = '#111827';
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(padding - 2, padding - 2, boardSize + 4, boardSize + 4, 14);
      this.ctx.fill();
    } else {
      this.ctx.fillRect(padding - 2, padding - 2, boardSize + 4, boardSize + 4);
    }

    // Cells
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.grid[r][c];
        const x = padding + c * (cellSize + gap);
        const y = padding + r * (cellSize + gap);
        const style = this.tileStyles[val] || this.tileStyles[4096];

        this.ctx.save();
        if (val === 2048) {
          // Ô 2048: Gradient cầu vồng neon rực lửa kèm hào quang phát sáng
          const grad = this.ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
          grad.addColorStop(0, '#ff007f');
          grad.addColorStop(0.5, '#ff5500');
          grad.addColorStop(1, '#ffd700');
          this.ctx.fillStyle = grad;
          this.ctx.shadowColor = 'rgba(255, 85, 0, 0.95)';
          this.ctx.shadowBlur = 20;
        } else {
          this.ctx.fillStyle = style.bg;
          if (val > 0) {
            this.ctx.shadowColor = style.glow;
            this.ctx.shadowBlur = val >= 1024 ? 16 : 10;
          }
        }

        if (this.ctx.roundRect) {
          this.ctx.beginPath();
          this.ctx.roundRect(x, y, cellSize, cellSize, 12);
          this.ctx.fill();
        } else {
          this.ctx.fillRect(x, y, cellSize, cellSize);
        }

        // Viền hiệu ứng bóng vàng cho ô 1024 và viền sáng cho 2048
        if (val === 1024) {
          this.ctx.lineWidth = 2.5;
          this.ctx.strokeStyle = '#ffe55c';
          if (this.ctx.roundRect) {
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, cellSize, cellSize, 12);
            this.ctx.stroke();
          } else {
            this.ctx.strokeRect(x, y, cellSize, cellSize);
          }
        } else if (val === 2048) {
          this.ctx.lineWidth = 2.5;
          this.ctx.strokeStyle = '#ffffff';
          if (this.ctx.roundRect) {
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, cellSize, cellSize, 12);
            this.ctx.stroke();
          } else {
            this.ctx.strokeRect(x, y, cellSize, cellSize);
          }
        }
        this.ctx.restore();

        if (val > 0) {
          this.ctx.save();
          this.ctx.fillStyle = style.text;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          let fontSize = Math.floor(cellSize * 0.48);
          if (val >= 100) fontSize = Math.floor(cellSize * 0.42);
          if (val >= 1000) fontSize = Math.floor(cellSize * 0.34);
          if (val >= 10000) fontSize = Math.floor(cellSize * 0.28);
          this.ctx.font = `800 ${fontSize}px Roboto, "JetBrains Mono", sans-serif`;
          this.ctx.fillText(val, x + cellSize / 2, y + cellSize / 2);
          this.ctx.restore();
        }
      }
    }

    // Overlays
    if (this.state === 'IDLE' || this.state === 'START') {
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.fillStyle = '#f43f5e';
      this.ctx.font = 'bold 22px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('2048 NEON', w / 2, h / 2 - 20);
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '13px sans-serif';
      this.ctx.fillText('Vuốt màn hình hoặc dùng phím mũi tên', w / 2, h / 2 + 15);
    } else if (this.state === 'GAMEOVER') {
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.fillStyle = '#f43f5e';
      this.ctx.font = 'bold 24px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('HẾT NƯỚC ĐI!', w / 2, h / 2 - 25);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 15px sans-serif';
      this.ctx.fillText(`Điểm: ${this.score}  |  Kỷ lục: ${this.highScore}`, w / 2, h / 2 + 5);
      this.ctx.fillStyle = '#38bdf8';
      this.ctx.font = 'bold 13px sans-serif';
      this.ctx.fillText('Chạm để chơi ván mới', w / 2, h / 2 + 38);
    }
  }

  loop() {
    this.draw();
  }
}
