// Game 2: Rắn Săn Mồi Neon (Cyber Snake)
// 100% Canvas 2D + Touch D-Pad support

class SnakeGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.gridSize = 20;
    this.tileCount = 20;

    this.setupCanvas();

    this.snake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 }
    ];
    this.dx = 0;
    this.dy = -1;
    this.nextDx = 0;
    this.nextDy = -1;
    this.food = { x: 5, y: 5 };
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('snake_high_score') || '0', 10);
    this.state = 'START'; // START, PLAYING, GAMEOVER
    this.speed = 105; // ms per tick
    this.lastTick = 0;

    this.initEvents();
    this.spawnFood();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setupCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const size = Math.min(rect.width, 420);
    this.canvas.width = size;
    this.canvas.height = size;
    this.gridSize = Math.floor(size / this.tileCount);
  }

  initEvents() {
    window.addEventListener('resize', () => this.setupCanvas());

    window.addEventListener('keydown', (e) => {
      if (document.getElementById('snakeGameSection').classList.contains('hidden')) return;

      if (['ArrowUp', 'KeyW'].includes(e.code) && this.dy === 0) {
        this.nextDx = 0; this.nextDy = -1;
      } else if (['ArrowDown', 'KeyS'].includes(e.code) && this.dy === 0) {
        this.nextDx = 0; this.nextDy = 1;
      } else if (['ArrowLeft', 'KeyA'].includes(e.code) && this.dx === 0) {
        this.nextDx = -1; this.nextDy = 0;
      } else if (['ArrowRight', 'KeyD'].includes(e.code) && this.dx === 0) {
        this.nextDx = 1; this.nextDy = 0;
      }

      if (this.state === 'START' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        this.start();
      }
    });

    // Touch D-Pad buttons
    const bindBtn = (id, ndx, ndy) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (this.state === 'START') this.start();
          if (ndx !== 0 && this.dx === 0) { this.nextDx = ndx; this.nextDy = 0; }
          if (ndy !== 0 && this.dy === 0) { this.nextDx = 0; this.nextDy = ndy; }
        });
      }
    };

    bindBtn('snakeUp', 0, -1);
    bindBtn('snakeDown', 0, 1);
    bindBtn('snakeLeft', -1, 0);
    bindBtn('snakeRight', 1, 0);

    const restartBtn = document.getElementById('snakeRestartBtn');
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.start();
      });
    }
  }

  start() {
    const overEl = document.getElementById('snakeGameOverOverlay');
    if (overEl) overEl.classList.add('hidden');

    this.snake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 }
    ];
    this.dx = 0;
    this.dy = -1;
    this.nextDx = 0;
    this.nextDy = -1;
    this.score = 0;
    this.state = 'PLAYING';
    this.spawnFood();
    this.updateUI();
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

    // Wall collision (Wrap around or Die - Let's do wrap-around for fun arcade vibe)
    if (head.x < 0) head.x = this.tileCount - 1;
    if (head.x >= this.tileCount) head.x = 0;
    if (head.y < 0) head.y = this.tileCount - 1;
    if (head.y >= this.tileCount) head.y = 0;

    // Self collision
    if (this.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      this.state = 'GAMEOVER';
      window.soundEngine.playTrip();
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('snake_high_score', this.highScore);
      }
      this.updateUI();

      // Show sleek HTML Game Over overlay
      const overEl = document.getElementById('snakeGameOverOverlay');
      const fScoreEl = document.getElementById('snakeFinalScore');
      const fHighEl = document.getElementById('snakeFinalHighScore');
      if (fScoreEl) fScoreEl.innerText = this.score;
      if (fHighEl) fHighEl.innerText = this.highScore;
      if (overEl) overEl.classList.remove('hidden');

      // Submit score to Cloudflare D1 Leaderboard
      if (window.leaderboard && this.score > 0) {
        window.leaderboard.submitScore('snake', this.score);
      }
      return;
    }

    this.snake.unshift(head);

    // Food check
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      window.soundEngine.playScore();
      this.spawnFood();
      this.updateUI();
    } else {
      this.snake.pop();
    }
  }

  updateUI() {
    const sEl = document.getElementById('snakeScore');
    const hEl = document.getElementById('snakeHighScore');
    if (sEl) sEl.innerText = this.score;
    if (hEl) hEl.innerText = this.highScore;
  }

  draw() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const gs = this.gridSize;

    // Background
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
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    this.ctx.arc(this.food.x * gs + gs / 2, this.food.y * gs + gs / 2, gs / 2 - 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Snake
    this.snake.forEach((seg, i) => {
      const isHead = i === 0;
      this.ctx.save();
      this.ctx.fillStyle = isHead ? '#39ff14' : `rgba(57, 255, 20, ${Math.max(0.3, 1 - i * 0.03)})`;
      if (isHead) {
        this.ctx.shadowColor = '#39ff14';
        this.ctx.shadowBlur = 8;
      }
      this.ctx.beginPath();
      this.ctx.roundRect(seg.x * gs + 1, seg.y * gs + 1, gs - 2, gs - 2, isHead ? 5 : 3);
      this.ctx.fill();

      if (isHead) {
        // Eyes
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(seg.x * gs + gs * 0.35, seg.y * gs + gs * 0.35, 2, 0, Math.PI * 2);
        this.ctx.arc(seg.x * gs + gs * 0.65, seg.y * gs + gs * 0.35, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    // Overlays
    if (this.state === 'START') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.65)';
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.fillStyle = '#39ff14';
      this.ctx.font = 'bold 18px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('RẮN SĂN MỒI NEON', w / 2, h / 2 - 15);
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.font = '13px sans-serif';
      this.ctx.fillText('Chạm phím mũi tên / D-Pad để chơi', w / 2, h / 2 + 15);
    } else if (this.state === 'GAMEOVER') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.75)';
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.fillStyle = '#f43f5e';
      this.ctx.font = 'bold 20px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('GAME OVER!', w / 2, h / 2 - 20);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '14px sans-serif';
      this.ctx.fillText(`Điểm: ${this.score}`, w / 2, h / 2 + 8);
      this.ctx.fillStyle = '#39ff14';
      this.ctx.font = 'bold 13px sans-serif';
      this.ctx.fillText('Chạm màn hình hoặc bấm phím để chơi lại', w / 2, h / 2 + 35);
    }
  }

  loop(timestamp) {
    if (this.state === 'PLAYING' && timestamp - this.lastTick > this.speed) {
      this.update();
      this.lastTick = timestamp;
    }
    this.draw();
    requestAnimationFrame(this.loop);
  }
}

window.SnakeGame = SnakeGame;
