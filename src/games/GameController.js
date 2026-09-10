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
    if (this.currentGame) {
      this.currentGame.start();
    }
  }

  setupControls(gameId) {
    if (!this.controlsContainer) return;
    this.controlsContainer.innerHTML = '';

    if (gameId === 'jump') {
      const bar = document.createElement('div');
      bar.className = 'w-full max-w-[300px] mx-auto flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-bold select-none active:scale-95 transition-transform shadow-lg cursor-pointer';
      bar.innerHTML = '<span class="text-sm">⚡</span><span>CHẠM MÀN HÌNH ĐỂ NHẢY</span>';
      bar.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (this.currentGame && this.currentGame.state === 'PLAYING') {
          this.currentGame.jump();
        } else if (this.currentGame) {
          this.currentGame.start();
        }
      });
      this.controlsContainer.appendChild(bar);
    } else if (gameId === 'snake') {
      const dpadWrapper = document.createElement('div');
      dpadWrapper.className = 'w-full flex flex-col items-center justify-center pb-[max(18px,env(safe-area-inset-bottom,18px))] mb-1';

      const dpad = document.createElement('div');
      dpad.className = 'grid grid-cols-3 gap-3 w-[240px] mx-auto items-center justify-items-center';
      dpad.innerHTML = `
        <div></div>
        <button id="dpadUp" class="dpad-btn w-[72px] h-[72px] min-w-[72px] min-h-[72px] bg-slate-800/95 active:bg-emerald-500 text-white rounded-2xl text-2xl font-black border-2 border-emerald-400/50 shadow-xl flex items-center justify-center select-none active:scale-95 transition-transform" title="Lên">▲</button>
        <div></div>
        <button id="dpadLeft" class="dpad-btn w-[72px] h-[72px] min-w-[72px] min-h-[72px] bg-slate-800/95 active:bg-emerald-500 text-white rounded-2xl text-2xl font-black border-2 border-emerald-400/50 shadow-xl flex items-center justify-center select-none active:scale-95 transition-transform" title="Trái">◀</button>
        <button id="dpadDown" class="dpad-btn w-[72px] h-[72px] min-w-[72px] min-h-[72px] bg-slate-800/95 active:bg-emerald-500 text-white rounded-2xl text-2xl font-black border-2 border-emerald-400/50 shadow-xl flex items-center justify-center select-none active:scale-95 transition-transform" title="Xuống">▼</button>
        <button id="dpadRight" class="dpad-btn w-[72px] h-[72px] min-w-[72px] min-h-[72px] bg-slate-800/95 active:bg-emerald-500 text-white rounded-2xl text-2xl font-black border-2 border-emerald-400/50 shadow-xl flex items-center justify-center select-none active:scale-95 transition-transform" title="Phải">▶</button>
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
      wrapper.className = 'flex items-center justify-between w-full max-w-sm px-3 mx-auto';
      wrapper.innerHTML = `
        <!-- Cụm trái: 2 nút [ ◀ TRÁI ] và [ PHẢI ▶ ] kích thước lớn 64x64px -->
        <div class="flex items-center gap-2.5">
          <button id="tetrisLeft" class="w-16 h-16 min-w-[64px] min-h-[64px] bg-slate-800/95 active:bg-cyan-500 text-white rounded-2xl text-2xl font-black border border-cyan-400/40 shadow-lg flex items-center justify-center select-none active:scale-95 transition-transform" title="Sang Trái">
            ◀
          </button>
          <button id="tetrisRight" class="w-16 h-16 min-w-[64px] min-h-[64px] bg-slate-800/95 active:bg-cyan-500 text-white rounded-2xl text-2xl font-black border border-cyan-400/40 shadow-lg flex items-center justify-center select-none active:scale-95 transition-transform" title="Sang Phải">
            ▶
          </button>
        </div>

        <!-- Nút ở giữa: [ ⚡ THẢ NHANH ] đặt ở vị trí giữa, tách biệt khoảng cách với nút XOAY -->
        <div class="flex items-center justify-center px-2">
          <button id="tetrisDropBtn" class="h-16 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 active:scale-95 text-white font-black rounded-2xl text-xs flex flex-col items-center justify-center shadow-lg border border-cyan-300/40 select-none transition-transform" title="Rơi nhanh">
            <span class="text-xl leading-none mb-0.5">⚡</span>
            <span class="text-[11px] uppercase tracking-wider font-extrabold whitespace-nowrap">THẢ NHANH</span>
          </button>
        </div>

        <!-- Cụm phải: Nút [ 🔄 XOAY ] đặt ngoài cùng bên phải, tròn to nổi bật màu tím neon gradient -->
        <div class="flex items-center justify-end">
          <button id="tetrisRotateBtn" class="w-16 h-16 min-w-[64px] min-h-[64px] rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-pink-500 active:scale-95 text-white font-black text-xs flex flex-col items-center justify-center shadow-[0_0_20px_rgba(217,70,239,0.5)] border-2 border-purple-300/60 select-none transition-transform" title="Xoay khối">
            <span class="text-xl leading-none mb-0.5">🔄</span>
            <span class="text-[11px] uppercase tracking-wider font-extrabold">XOAY</span>
          </button>
        </div>
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
    }
  }
}
