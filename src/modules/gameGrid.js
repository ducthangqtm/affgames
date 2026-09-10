/**
 * GameGridManager: Bố cục Lưới Tĩnh 2x2 cho Tab Trò Chơi (Arcade)
 * - Quản lý 4 thẻ game cố định không dùng cuộn ngang
 * - Game "jump" (Thắng Nhảy Dây) mặc định active với viền neon sáng nổi bật
 * - Khi chạm vào thẻ khác: chuyển active & cập nhật Bảng Vàng tức thì từ cache
 * - Khi chạm [Chơi Ngay] hoặc chạm lần 2 vào thẻ đang active: Kích hoạt chơi game
 */
export class GameGridManager {
  constructor(gridElement, { onActiveGameChange, onLaunchGame } = {}) {
    this.grid = gridElement;
    this.onActiveGameChange = onActiveGameChange;
    this.onLaunchGame = onLaunchGame;
    this.activeGameId = 'jump';
    this.cards = [];

    this.init();
  }

  init() {
    if (!this.grid) return;

    this.cards = Array.from(this.grid.querySelectorAll('.game-grid-card'));

    this.cards.forEach((card) => {
      card.addEventListener('click', (e) => {
        const gameId = card.dataset.gameId;
        if (!gameId) return;

        // 1. Nhấn nút [Chơi Ngay]
        if (e.target.closest('.launch-game-btn')) {
          e.stopPropagation();
          this.setActiveGame(gameId);
          if (this.onLaunchGame) {
            this.onLaunchGame(gameId);
          }
          return;
        }

        // 2. Chạm lần 2 vào thẻ đang active -> Mở khung chơi game
        if (this.activeGameId === gameId) {
          if (this.onLaunchGame) {
            this.onLaunchGame(gameId);
          }
          return;
        }

        // 3. Chạm vào thẻ khác -> Chuyển active và cập nhật Bảng Vàng tức thì
        this.setActiveGame(gameId);
      });
    });

    // Mặc định ban đầu kích hoạt Thắng Nhảy Dây
    this.setActiveGame('jump');
  }

  setActiveGame(gameId) {
    this.activeGameId = gameId;

    if (this.cards) {
      this.cards.forEach((card) => {
        if (card.dataset.gameId === gameId) {
          card.classList.add('active-game-card');
        } else {
          card.classList.remove('active-game-card');
        }
      });
    }

    if (this.onActiveGameChange) {
      this.onActiveGameChange(gameId);
    }
  }

  resetToDefault() {
    this.setActiveGame('jump');
  }
}
