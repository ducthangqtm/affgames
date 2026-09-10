// Game 3: 2048 Retro Neon - High Performance 60FPS Edition
// Ultra-smooth touch gestures + Zero-DOM-thrashing pooled cells + Tactile D-Pad

class Game2048 {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.size = 4;
    this.grid = [];
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('2048_high_score') || '0', 10);
    this.over = false;
    this.cells = [];
    this.overlayEl = null;

    this.initDOM();
    this.initTouch();
    this.initKeyboard();
    this.initButtons();
    this.restart();
  }

  initDOM() {
    this.container.innerHTML = '';
    this.cells = [];

    for (let i = 0; i < this.size * this.size; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell tile-0 flex items-center justify-center font-black rounded-lg transition-transform text-lg select-none';
      cell.style.willChange = 'transform';
      this.container.appendChild(cell);
      this.cells.push(cell);
    }

    // Pre-create Game Over Overlay once
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'absolute inset-0 bg-black/85 backdrop-blur-sm hidden flex flex-col items-center justify-center p-4 rounded-xl z-20 font-sans';
    this.overlayEl.innerHTML = `
      <div class="text-3xl mb-1">💥</div>
      <div class="text-rose-500 font-black text-2xl mb-1 vn-arcade-font">HẾT NƯỚC ĐI!</div>
      <div class="text-slate-300 text-xs mb-3">Điểm của bạn: <span id="overlay2048Score" class="font-bold text-emerald-400 text-base">0</span></div>
      <div class="w-full max-w-xs grid grid-cols-2 gap-2">
        <button id="overlay2048RestartBtn" class="btn-neon py-2.5 text-xs font-black flex items-center justify-center gap-1 shadow-lg">
          <span>🔁</span><span>CHƠI LẠI</span>
        </button>
        <button onclick="closeArcadeModal()" class="py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition flex items-center justify-center gap-1">
          <span>🏠</span><span>VỀ TRANG CHỦ</span>
        </button>
      </div>
    `;
    this.container.appendChild(this.overlayEl);

    const restartBtn = this.overlayEl.querySelector('#overlay2048RestartBtn');
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.restart();
      });
    }
  }

  restart() {
    this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    this.score = 0;
    this.over = false;
    if (this.overlayEl) this.overlayEl.classList.add('hidden');
    this.addRandomTile();
    this.addRandomTile();
    this.render();
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

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (document.getElementById('game2048Section').classList.contains('hidden')) return;

      if (['ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); this.move('UP'); }
      else if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); this.move('DOWN'); }
      else if (['ArrowLeft', 'KeyA'].includes(e.code)) { e.preventDefault(); this.move('LEFT'); }
      else if (['ArrowRight', 'KeyD'].includes(e.code)) { e.preventDefault(); this.move('RIGHT'); }
    });
  }

  initTouch() {
    let startX = 0, startY = 0;
    let isTouching = false;
    let hasMovedThisTouch = false;

    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      // Prevent browser back/forward swipe gesture
      if (e.cancelable) e.preventDefault();
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isTouching = true;
      hasMovedThisTouch = false;
    }, { passive: false });

    this.container.addEventListener('touchmove', (e) => {
      if (!isTouching || hasMovedThisTouch || e.touches.length !== 1) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - startX;
      const dy = currentY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Fast, instant response at 20px threshold
      if (Math.max(absDx, absDy) > 20) {
        if (e.cancelable) e.preventDefault();
        hasMovedThisTouch = true;
        if (absDx > absDy) {
          this.move(dx > 0 ? 'RIGHT' : 'LEFT');
        } else {
          this.move(dy > 0 ? 'DOWN' : 'UP');
        }
      }
    }, { passive: false });

    const endTouch = () => {
      isTouching = false;
      hasMovedThisTouch = false;
    };

    this.container.addEventListener('touchend', endTouch, { passive: true });
    this.container.addEventListener('touchcancel', endTouch, { passive: true });
  }

  initButtons() {
    // D-Pad removed for 2048 - swipe gestures only
  }

  move(dir) {
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
        if (window.soundEngine) window.soundEngine.playScore();
      }

      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('2048_high_score', this.highScore);
      }

      const newTile = this.addRandomTile();
      this.checkGameOver();
      this.render(newTile);
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
    if (window.soundEngine) window.soundEngine.playTrip();

    // Submit score to Cloudflare D1 Leaderboard
    if (window.leaderboard && this.score > 0) {
      window.leaderboard.submitScore('2048', this.score);
    }

    if (this.overlayEl) {
      const scoreSpan = this.overlayEl.querySelector('#overlay2048Score');
      if (scoreSpan) scoreSpan.innerText = this.score;
      this.overlayEl.classList.remove('hidden');
    }
  }

  render(newTile = null) {
    const scoreEl = document.getElementById('score2048');
    const highEl = document.getElementById('high2048');
    if (scoreEl) scoreEl.innerText = this.score;
    if (highEl) highEl.innerText = this.highScore;

    let cellIndex = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.grid[r][c];
        const cell = this.cells[cellIndex];
        const isNew = newTile && newTile.r === r && newTile.c === c;

        cell.className = `cell tile-${val} flex items-center justify-center font-black rounded-lg transition-transform text-lg select-none ${isNew ? 'tile-pop' : ''}`;
        cell.textContent = val > 0 ? val : '';
        cellIndex++;
      }
    }
  }
}

window.Game2048 = Game2048;
