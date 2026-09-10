import { soundEngine } from './SoundEngine.js';
import { JumpGame } from './JumpGame.js';
import { SnakeGame } from './SnakeGame.js';
import { Game2048 } from './Game2048.js';
import { TetrisGame } from './TetrisGame.js';

export class GameController {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.currentGame = null;
    this.currentGameId = null;
    this.onGameOverCallback = options.onGameOver || null;
    this.onScoreUpdate = options.onScoreUpdate || null;
    this.controlsContainer = options.controlsContainer || null;

    this.gameMap = {
      jump: JumpGame,
      snake: SnakeGame,
      2048: Game2048,
      tetris: TetrisGame
    };
  }

  loadGame(gameId) {
    if (!this.gameMap[gameId]) {
      console.error(`Game ID "${gameId}" not found`);
      return;
    }

    // Gỡ sạch game cũ nếu đang chạy
    if (this.currentGame) {
      this.currentGame.destroy();
      this.currentGame = null;
    }

    this.currentGameId = gameId;
    const GameClass = this.gameMap[gameId];
    this.currentGame = new GameClass();

    if (this.canvas && this.canvas.parentElement) {
      if (gameId === 'tetris') {
        this.canvas.parentElement.classList.add('tetris-frame');
        this.canvas.style.borderBottomLeftRadius = '0px';
        this.canvas.parentElement.style.borderBottomLeftRadius = '0px';
      } else {
        this.canvas.parentElement.classList.remove('tetris-frame');
        this.canvas.style.borderBottomLeftRadius = '';
        this.canvas.parentElement.style.borderBottomLeftRadius = '';
      }
    }

    this.currentGame.init(this.canvas, {
      onGameOver: (score) => {
        if (this.onGameOverCallback) {
          this.onGameOverCallback(gameId, score);
        }
      },
      onScoreUpdate: (score) => {
        if (this.onScoreUpdate) {
          this.onScoreUpdate(gameId, score);
        }
      }
    });

    this.setupControls(gameId);
  }

  startCurrentGame() {
    if (!this.currentGame) return;
    if (this.currentGameId === 'jump' && typeof this.currentGame.showStartScreen === 'function') {
      this.currentGame.showStartScreen();
    } else {
      this.currentGame.start();
    }
  }

  setupControls(gameId) {
    if (!this.controlsContainer) return;
    this.controlsContainer.innerHTML = '';

    if (gameId === 'jump') {
      // Game Thắng Nhảy Dây: Toàn bộ màn hình là vùng chạm, ẩn hoàn toàn container nút bấm dưới đáy
      this.controlsContainer.style.display = 'none';
      return;
    } else {
      this.controlsContainer.style.display = '';
    }

    if (gameId === 'snake') {
      const dpadWrapper = document.createElement('div');
      dpadWrapper.className = 'w-full flex flex-col items-center justify-center pb-[max(10px,env(safe-area-inset-bottom,10px))] mb-1 select-none';

      const dpad = document.createElement('div');
      dpad.className = 'grid grid-cols-3 gap-2.5 w-[240px] mx-auto items-center justify-items-center';
      dpad.innerHTML = `
        <div></div>
        <button id="dpadUp" class="dpad-btn w-[74px] h-[74px] min-w-[74px] min-h-[74px] bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.2] text-white rounded-[14px] border border-white/10 flex items-center justify-center select-none active:scale-95 transition-all touch-manipulation cursor-pointer" title="Lên">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <div></div>
        <button id="dpadLeft" class="dpad-btn w-[74px] h-[74px] min-w-[74px] min-h-[74px] bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.2] text-white rounded-[14px] border border-white/10 flex items-center justify-center select-none active:scale-95 transition-all touch-manipulation cursor-pointer" title="Trái">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button id="dpadDown" class="dpad-btn w-[74px] h-[74px] min-w-[74px] min-h-[74px] bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.2] text-white rounded-[14px] border border-white/10 flex items-center justify-center select-none active:scale-95 transition-all touch-manipulation cursor-pointer" title="Xuống">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button id="dpadRight" class="dpad-btn w-[74px] h-[74px] min-w-[74px] min-h-[74px] bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.2] text-white rounded-[14px] border border-white/10 flex items-center justify-center select-none active:scale-95 transition-all touch-manipulation cursor-pointer" title="Phải">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      `;
      dpadWrapper.appendChild(dpad);
      this.controlsContainer.appendChild(dpadWrapper);

      const bindDirection = (id, dx, dy) => {
        const el = dpad.querySelector(id);
        if (el) {
          el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (this.currentGame && this.currentGame.setDirection) {
              this.currentGame.setDirection(dx, dy);
            }
          });
        }
      };
      bindDirection('#dpadUp', 0, -1);
      bindDirection('#dpadDown', 0, 1);
      bindDirection('#dpadLeft', -1, 0);
      bindDirection('#dpadRight', 1, 0);
    } else if (gameId === '2048') {
      // Ẩn/Xóa hoàn toàn cụm phím điều hướng, người chơi vuốt trực tiếp trên bảng số
      this.controlsContainer.innerHTML = '';
    } else if (gameId === 'tetris') {
      const wrapper = document.createElement('div');
      wrapper.className = 'flex items-center justify-center gap-2.5 sm:gap-3.5 w-full max-w-sm px-2.5 mx-auto select-none';
      wrapper.innerHTML = `
        <!-- Nút Trái [ ◀ ] -->
        <button id="tetrisLeft" class="flex-1 h-[76px] min-h-[76px] max-w-[82px] bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.2] text-white rounded-[18px] border border-white/10 flex items-center justify-center select-none active:scale-95 transition-all touch-manipulation cursor-pointer" title="Sang Trái">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <!-- Nút Phải [ ▶ ] -->
        <button id="tetrisRight" class="flex-1 h-[76px] min-h-[76px] max-w-[82px] bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.2] text-white rounded-[18px] border border-white/10 flex items-center justify-center select-none active:scale-95 transition-all touch-manipulation cursor-pointer" title="Sang Phải">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Nút Thả nhanh [ ⏬ ] (Double chevron down, màu trắng căn giữa) -->
        <button id="tetrisDropBtn" class="flex-1 h-[76px] min-h-[76px] max-w-[82px] bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.2] text-white rounded-[18px] border border-white/10 flex items-center justify-center select-none active:scale-95 transition-all touch-manipulation cursor-pointer" title="Thả nhanh">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-7 7-7-7M19 13l-7 7-7-7" />
          </svg>
        </button>

        <!-- Nút Xoay [ 🔄 ] (Rotate arrow, màu trắng căn giữa) -->
        <button id="tetrisRotateBtn" class="flex-1 h-[76px] min-h-[76px] max-w-[82px] bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.2] text-white rounded-[18px] border border-white/10 flex items-center justify-center select-none active:scale-95 transition-all touch-manipulation cursor-pointer" title="Xoay khối">
          <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 4v5h5M20 20v-5h-5M4.5 9A8 8 0 0 1 19.5 7.5M19.5 15a8 8 0 0 1-15 1.5" />
          </svg>
        </button>
      `;
      this.controlsContainer.appendChild(wrapper);

      const bindAction = (id, fn) => {
        const el = wrapper.querySelector(id);
        if (el) {
          el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (this.currentGame) fn();
          });
        }
      };

      bindAction('#tetrisLeft', () => this.currentGame.move(-1));
      bindAction('#tetrisRight', () => this.currentGame.move(1));
      bindAction('#tetrisRotateBtn', () => this.currentGame.rotate());
      bindAction('#tetrisDropBtn', () => this.currentGame.hardDrop());
    }
  }

  destroy() {
    if (this.currentGame) {
      this.currentGame.destroy();
      this.currentGame = null;
    }
    if (this.controlsContainer) {
      this.controlsContainer.innerHTML = '';
      this.controlsContainer.style.display = '';
    }
  }
}
