import { BaseGame } from './BaseGame.js';
import { soundEngine } from './SoundEngine.js';

export class SnakeGame extends BaseGame {
  constructor() {
    super();
    this.tileCount = 16; // Giảm mật độ ô xuống 16x16 để thân rắn to rõ, mồi nổi bật & nhịp độ nhanh hơn
    this.gridSize = 24;

    this.snake = [
      { x: 8, y: 8 },
      { x: 8, y: 9 },
      { x: 8, y: 10 }
    ];
    this.dx = 0;
    this.dy = -1;
    this.nextDx = 0;
    this.nextDy = -1;
    this.food = { x: 4, y: 4 };
    // Tốc độ khởi đầu baseSpeed = 160ms mỗi bước di chuyển
    this.baseSpeed = 160;
    this.speed = 160;
    this.foodCount = 0;
    this.lastTick = 0;
    this.highScore = parseInt(localStorage.getItem('snake_high_score') || '0', 10);

    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  init(canvas, options = {}) {
    super.init(canvas, options);
    this.setupCanvas();
    this.spawnFood();

    this.addListener(window, 'resize', this.handleResize);

    const handleKeyDown = (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code) && this.dy === 0) {
        e.preventDefault();
        this.nextDx = 0; this.nextDy = -1;
      } else if (['ArrowDown', 'KeyS'].includes(e.code) && this.dy === 0) {
        e.preventDefault();
        this.nextDx = 0; this.nextDy = 1;
      } else if (['ArrowLeft', 'KeyA'].includes(e.code) && this.dx === 0) {
        e.preventDefault();
        this.nextDx = -1; this.nextDy = 0;
      } else if (['ArrowRight', 'KeyD'].includes(e.code) && this.dx === 0) {
        e.preventDefault();
        this.nextDx = 1; this.nextDy = 0;
      }

      if (this.state === 'GAMEOVER' && e.code === 'Space') {
        this.removeGameOverOverlay();
        this.start();
        if (this.onPlayAgainCallback) {
          this.onPlayAgainCallback();
        }
        return;
      }

      if ((this.state === 'IDLE' || this.state === 'START') &&
          ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) {
        this.start();
      }
    };
    this.addListener(window, 'keydown', handleKeyDown);

    // Touch swipe gestures directly on canvas
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      if (this.state === 'IDLE' || this.state === 'START') {
        this.start();
      }
    };

    const handleTouchEnd = (e) => {
      if (e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) > 20) {
        if (absDx > absDy) {
          if (dx > 0 && this.dx === 0) { this.nextDx = 1; this.nextDy = 0; }
          else if (dx < 0 && this.dx === 0) { this.nextDx = -1; this.nextDy = 0; }
        } else {
          if (dy > 0 && this.dy === 0) { this.nextDx = 0; this.nextDy = 1; }
          else if (dy < 0 && this.dy === 0) { this.nextDx = 0; this.nextDy = -1; }
        }
      }
    };

    this.addListener(this.canvas, 'touchstart', handleTouchStart, { passive: true });
    this.addListener(this.canvas, 'touchend', handleTouchEnd, { passive: true });

    this.draw();
  }

  setDirection(ndx, ndy) {
    if (this.state === 'IDLE' || this.state === 'START') {
      this.start();
    }
    if (ndx !== 0 && this.dx === 0) {
      this.nextDx = ndx;
      this.nextDy = 0;
    }
    if (ndy !== 0 && this.dy === 0) {
      this.nextDx = 0;
      this.nextDy = ndy;
    }
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
    const maxH = Math.floor(Math.min(viewportH > 150 ? viewportH : (window.innerHeight - 180), 440));
    const rawSize = Math.floor(Math.min(targetW, maxH));
    this.gridSize = Math.floor(rawSize / this.tileCount);
    const size = this.gridSize * this.tileCount;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.scale(dpr, dpr);
    this.width = size;
    this.height = size;
  }

  start() {
    this.removeGameOverOverlay();
    this.snake = [
      { x: 8, y: 8 },
      { x: 8, y: 9 },
      { x: 8, y: 10 }
    ];
    this.dx = 0;
    this.dy = -1;
    this.nextDx = 0;
    this.nextDy = -1;
    this.score = 0;
    this.foodCount = 0;
    this.speed = this.baseSpeed;
    this.state = 'PLAYING';
    this.spawnFood();
    this.updateScore(0);

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.lastTick = performance.now();
    this.animationId = requestAnimationFrame(this.loop);
  }

  spawnFood() {
    let valid = false;
    while (!valid) {
      this.food.x = Math.floor(Math.random() * this.tileCount);
      this.food.y = Math.floor(Math.random() * this.tileCount);
      valid = !this.snake.some(seg => seg.x === this.food.x && seg.y === this.food.y);
    }
  }

  update() {
    this.dx = this.nextDx;
    this.dy = this.nextDy;

    const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };

    // Wrap around boundaries
    if (head.x < 0) head.x = this.tileCount - 1;
    if (head.x >= this.tileCount) head.x = 0;
    if (head.y < 0) head.y = this.tileCount - 1;
    if (head.y >= this.tileCount) head.y = 0;

    // Self collision
    if (this.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      this.state = 'GAMEOVER';
      soundEngine.playTrip();
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('snake_high_score', this.highScore);
      }
      this.triggerGameOver(this.score);
      this.showGameOverOverlay({
        title: 'GAME OVER!',
        score: this.score,
        highScore: this.highScore,
        subtitle: 'Rắn đã va chạm thân mình'
      });
      return;
    }

    this.snake.unshift(head);

    // Food collision
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.foodCount++;
      // Cơ chế tăng tốc: Cứ mỗi 5 điểm (ăn 5 mồi), giảm khoảng thời gian tick 8ms, sàn tối thiểu 70ms:
      this.speed = Math.max(70, this.baseSpeed - (Math.floor(this.foodCount / 5) * 8));
      soundEngine.playScore();
      this.spawnFood();
      this.updateScore(this.score);
    } else {
      this.snake.pop();
    }
  }

  draw() {
    if (!this.ctx) return;
    const w = this.width;
    const h = this.height;
    const gs = this.gridSize;

    this.ctx.fillStyle = '#090d16';
    this.ctx.fillRect(0, 0, w, h);

    // Subtle grid
    this.ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= this.tileCount; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * gs, 0);
      this.ctx.lineTo(i * gs, h);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * gs);
      this.ctx.lineTo(w, i * gs);
      this.ctx.stroke();
    }

    // Food (Glowing Apple)
    this.ctx.save();
    this.ctx.fillStyle = '#f43f5e';
    this.ctx.shadowColor = '#f43f5e';
    this.ctx.shadowBlur = 14;
    this.ctx.beginPath();
    this.ctx.arc(this.food.x * gs + gs / 2, this.food.y * gs + gs / 2, Math.max(4, gs / 2 - 2), 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Snake
    this.snake.forEach((seg, i) => {
      const isHead = i === 0;
      this.ctx.save();
      this.ctx.fillStyle = isHead ? '#39ff14' : `rgba(57, 255, 20, ${Math.max(0.35, 1 - i * 0.035)})`;
      if (isHead) {
        this.ctx.shadowColor = '#39ff14';
        this.ctx.shadowBlur = 12;
      }
      this.ctx.beginPath();
      const cornerRadius = isHead ? Math.max(5, Math.round(gs * 0.24)) : Math.max(3, Math.round(gs * 0.15));
      if (this.ctx.roundRect) {
        this.ctx.roundRect(seg.x * gs + 1, seg.y * gs + 1, gs - 2, gs - 2, cornerRadius);
      } else {
        this.ctx.rect(seg.x * gs + 1, seg.y * gs + 1, gs - 2, gs - 2);
      }
      this.ctx.fill();

      if (isHead) {
        this.ctx.fillStyle = '#000000';
        const eyeRadius = Math.max(2, Math.round(gs * 0.1));
        this.ctx.beginPath();
        this.ctx.arc(seg.x * gs + gs * 0.35, seg.y * gs + gs * 0.35, eyeRadius, 0, Math.PI * 2);
        this.ctx.arc(seg.x * gs + gs * 0.65, seg.y * gs + gs * 0.35, eyeRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    // Overlays
    if (this.state === 'IDLE' || this.state === 'START') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.fillStyle = '#39ff14';
      this.ctx.font = 'bold 20px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('RẮN SĂN MỒI NEON', w / 2, h / 2 - 15);
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '13px sans-serif';
      this.ctx.fillText('Vuốt hoặc dùng phím / D-Pad để chơi', w / 2, h / 2 + 15);
    } else if (this.state === 'GAMEOVER') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  loop(timestamp) {
    if (this.state === 'PLAYING') {
      if (timestamp - this.lastTick > this.speed) {
        this.update();
        this.lastTick = timestamp;
      }
    }
    this.draw();

    if (this.state === 'PLAYING' || this.state === 'GAMEOVER') {
      this.animationId = requestAnimationFrame(this.loop);
    }
  }
}
