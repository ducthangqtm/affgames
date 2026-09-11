/**
 * BaseGame: Chuẩn Lifecycle cho tất cả game trong Arcade Hub
 * - init(canvas, options): Thiết lập canvas, gán listener
 * - start(): Khởi động / chơi lại
 * - pause(): Tạm dừng
 * - destroy(): Dọn dẹp triệt để, cancel requestAnimationFrame, remove all event listeners
 */
export class BaseGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.state = 'IDLE'; // IDLE, PLAYING, PAUSED, GAMEOVER
    this.score = 0;
    this.onGameOverCallback = null;
    this.eventListeners = [];
  }

  init(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOverCallback = options.onGameOver || null;
    this.onScoreUpdateCallback = options.onScoreUpdate || null;
    this.onPlayAgainCallback = options.onPlayAgain || null;
    this.onGoHomeCallback = options.onGoHome || null;
    this.gameOverOverlayEl = null;
  }

  start() {
    this.removeGameOverOverlay();
    throw new Error('start() must be implemented by subclass');
  }

  pause() {
    this.state = 'PAUSED';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resume() {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
    }
  }

  triggerGameOver(finalScore) {
    this.state = 'GAMEOVER';
    if (this.onGameOverCallback) {
      this.onGameOverCallback(finalScore);
    }
  }

  /**
   * Hiển thị Game Over Overlay chứa 2 nút: Chơi Lại & Về Trang Chủ
   */
  showGameOverOverlay({ title = 'GAME OVER!', score = 0, highScore = 0, subtitle = '' } = {}) {
    this.removeGameOverOverlay();

    const parent = (this.canvas && this.canvas.parentElement) || document.getElementById('canvasViewport');
    if (!parent) return;

    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay absolute inset-0 z-30 flex flex-col items-center justify-center p-4 select-none';
    overlay.style.background = 'rgba(10, 15, 29, 0.88)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.webkitBackdropFilter = 'blur(6px)';

    overlay.innerHTML = `
      <div class="flex flex-col items-center justify-center text-center max-w-[320px] w-full px-2">
        <h2 class="text-[23px] sm:text-[25px] font-black tracking-wider text-[#f43f5e] drop-shadow-[0_0_15px_rgba(244,63,94,0.7)] mb-1 uppercase">
          ${title}
        </h2>
        
        <div class="text-[14.5px] sm:text-[15.5px] font-bold text-white mb-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          Điểm: <span class="text-[#00f2fe] font-mono text-[18px] font-extrabold">${score}</span>  |  Kỷ lục: <span class="text-[#facc15] font-mono text-[18px] font-extrabold">${highScore}</span>
        </div>

        ${subtitle ? `<p class="text-[12.5px] sm:text-[13px] font-medium text-[#94a3b8] mb-3 leading-snug">${subtitle}</p>` : ''}

        <!-- Container 2 nút bấm ngang / dọc linh hoạt -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full mt-3">
          <!-- Nút 1: Chơi lại (Chính, phong cách neon sáng, gradient xanh/vàng bắt mắt, nổi bật) -->
          <button id="btnGameOverReplay" type="button" class="btn-game-replay flex-1 w-full sm:w-auto h-[46px] min-h-[46px] px-5 py-2.5 rounded-xl text-[14.5px] font-black flex items-center justify-center gap-2 cursor-pointer touch-manipulation transition-all active:scale-95 select-none">
            🔄 Chơi Lại
          </button>

          <!-- Nút 2: Về trang chủ (Phụ, viền bo tròn nhẹ, màu tối/viền neon mờ) -->
          <button id="btnGameOverHome" type="button" class="btn-game-home flex-1 w-full sm:w-auto h-[46px] min-h-[46px] px-4 py-2.5 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer touch-manipulation transition-all active:scale-95 select-none">
            🏠 Về Trang Chủ
          </button>
        </div>
      </div>
    `;

    parent.appendChild(overlay);
    this.gameOverOverlayEl = overlay;

    // Chặn nổi bọt các sự kiện chạm/chuột để không tác động vào canvas bên dưới
    ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown'].forEach((evt) => {
      overlay.addEventListener(evt, (e) => e.stopPropagation(), { passive: false });
    });

    const replayBtn = overlay.querySelector('#btnGameOverReplay');
    const homeBtn = overlay.querySelector('#btnGameOverHome');

    if (replayBtn) {
      replayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removeGameOverOverlay();
        this.start();
        if (this.onPlayAgainCallback) {
          this.onPlayAgainCallback();
        }
      });
    }

    if (homeBtn) {
      homeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removeGameOverOverlay();
        if (this.onGoHomeCallback) {
          this.onGoHomeCallback();
        }
      });
    }
  }

  removeGameOverOverlay() {
    if (this.gameOverOverlayEl) {
      this.gameOverOverlayEl.remove();
      this.gameOverOverlayEl = null;
    }
    const oldOverlays = document.querySelectorAll('.game-over-overlay');
    oldOverlays.forEach(el => el.remove());
  }

  updateScore(newScore) {
    this.score = newScore;
    if (this.onScoreUpdateCallback) {
      this.onScoreUpdateCallback(newScore);
    }
  }

  /**
   * Helper quản lý event listener để dễ dàng gỡ sạch khi unmount
   */
  addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.eventListeners.push({ target, type, handler, options });
  }

  destroy() {
    this.removeGameOverOverlay();
    this.state = 'IDLE';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Gỡ sạch 100% event listener
    for (const { target, type, handler, options } of this.eventListeners) {
      target.removeEventListener(type, handler, options);
    }
    this.eventListeners = [];

    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
