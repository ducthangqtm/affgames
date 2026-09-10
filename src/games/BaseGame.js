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
  }

  start() {
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
