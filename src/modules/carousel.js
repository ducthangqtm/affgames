/**
 * Legacy wrapper: Chuyển hướng sang GameGridManager
 * Toàn bộ logic Carousel, clone DOM và cuộn ngang đã được thay thế hoàn toàn bằng Bố cục Lưới Tĩnh 2x2.
 */
import { GameGridManager } from './gameGrid.js';

export class GameCarousel extends GameGridManager {
  constructor(containerElement, onActiveGameChange) {
    super(containerElement, { onActiveGameChange });
  }

  scrollToGame(gameId) {
    this.setActiveGame(gameId);
  }
}

export { GameGridManager };
