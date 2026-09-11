import { BaseGame } from './BaseGame.js';
import { soundEngine } from './SoundEngine.js';

const VIETNAMESE_FONT = "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export class JumpGame extends BaseGame {
  constructor() {
    super();

    this.width = 380;
    this.height = 500;

    this.char = {
      x: 190,
      y: 300,
      baseY: 300,
      vy: 0,
      baseJumpForce: -7.6, // Realistic snappy hop
      jumpForce: -7.6,
      baseGravity: 0.82,
      gravity: 0.82,
      isGrounded: true,
      jumpHeight: 0,
      scaleX: 1,
      scaleY: 1,
      targetScaleX: 1,
      targetScaleY: 1
    };

    this.rope = {
      angle: -Math.PI / 2,
      baseSpeed: 0.078,
      speed: 0.078,
      maxSpeed: 0.078 * 1.85,
      passedBottom: false,
      isDangerZone: false,
      glowIntensity: 1
    };

    this.combo = 0;
    this.highScore = parseInt(localStorage.getItem('thang_high_score') || '0', 10);
    this.shake = 0;
    this.particles = [];
    this.floatingTexts = [];

    this.bgImage = null;
    this.bgImg = null;
    this.bgCache = {};
    this.selectedBg = this.getSelectedBg();
    this.selectedBgId = this.getBgNumber(this.selectedBg);
    this.mapSelectorBounds = null;
    this.hoverBtn = null;
    this.startOverlayEl = null;

    this.jumpSprite = null;
    this.assetsLoaded = false;
    this.canRestart = false;
    this.state = 'START'; // Trạng thái ban đầu: SẴN SÀNG (START / Ready screen)

    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
  }

  getSelectedBg() {
    try {
      const saved = localStorage.getItem('jump_rope_selected_bg');
      // 1. Làm sạch dữ liệu localStorage: nếu không bắt đầu bằng "bg-", lập tức reset về "bg-1.png"
      if (saved && typeof saved === 'string' && saved.startsWith('bg-')) {
        const match = saved.match(/^bg-(\d+)\.png$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= 1 && num <= 11) {
            return `bg-${num}.png`;
          }
        }
      }
    } catch (e) {}

    // Reset, gán cứng lại mặc định "bg-1.png" và lưu đè vào localStorage
    try {
      localStorage.setItem('jump_rope_selected_bg', 'bg-1.png');
    } catch (e) {}
    return 'bg-1.png';
  }

  getBgNumber(bgFileName) {
    const filename = bgFileName || this.selectedBg;
    if (!filename || typeof filename !== 'string') return 1;
    const match = filename.match(/bg-(\d+)\.png/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 11) return num;
    }
    return 1;
  }

  setSelectedBg(bgFileName) {
    let filename = bgFileName;
    if (!filename || typeof filename !== 'string' || !filename.startsWith('bg-')) {
      filename = 'bg-1.png';
    }
    this.selectedBg = filename;
    this.selectedBgId = this.getBgNumber(filename);
    try {
      localStorage.setItem('jump_rope_selected_bg', filename);
    } catch (e) {}
    this.loadBackground(filename);
    this.updateMapSelectorUI();
  }

  updateBackground(bgIndex) {
    let num = parseInt(bgIndex, 10);
    if (isNaN(num) || num < 1 || num > 11) num = 1;
    this.setSelectedBg(`bg-${num}.png`);
  }

  loadBackground(selectedBg) {
    if (!selectedBg || typeof selectedBg !== 'string' || !selectedBg.startsWith('bg-')) {
      selectedBg = 'bg-1.png';
    }
    this.selectedBg = selectedBg;
    this.selectedBgId = this.getBgNumber(selectedBg);
    if (!this.bgCache) this.bgCache = {};

    // 2. Chuẩn hóa đường dẫn web Vite static assets: /assets/backgrounds/${selectedBg}
    const src = `/assets/backgrounds/${selectedBg}`;
    if (this.bgCache[selectedBg] && this.bgCache[selectedBg].complete && this.bgCache[selectedBg].naturalWidth > 0) {
      this.bgImage = this.bgCache[selectedBg];
      this.bgImg = this.bgImage;
    } else {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        this.bgCache[selectedBg] = img;
        if (this.selectedBg === selectedBg) {
          this.bgImage = img;
          this.bgImg = img;
          if (this.state !== 'PLAYING' && this.ctx && this.canvas) this.draw();
        }
      };
      img.onerror = () => {
        console.warn(`Không thể tải ảnh nền: ${src}, reset về bg-1.png`);
        if (selectedBg !== 'bg-1.png') {
          this.setSelectedBg('bg-1.png');
        }
      };
      this.bgCache[selectedBg] = img;
      this.bgImage = img;
      this.bgImg = img;
    }

    // Tiền tải trước các bối cảnh liền kề để chuyển đổi ngay tức thì không độ trễ
    const currentNum = this.getBgNumber(selectedBg);
    const nextNum = currentNum >= 11 ? 1 : currentNum + 1;
    const prevNum = currentNum <= 1 ? 11 : currentNum - 1;
    [`bg-${nextNum}.png`, `bg-${prevNum}.png`].forEach((adjBg) => {
      if (!this.bgCache[adjBg]) {
        const adjImg = new Image();
        adjImg.src = `/assets/backgrounds/${adjBg}`;
        this.bgCache[adjBg] = adjImg;
      }
    });

    if (this.state !== 'PLAYING' && this.ctx && this.canvas) {
      this.draw();
    }
  }

  prevBackground() {
    let num = this.getBgNumber(this.selectedBg) - 1;
    if (num < 1) num = 11;
    this.setSelectedBg(`bg-${num}.png`);
  }

  nextBackground() {
    let num = this.getBgNumber(this.selectedBg) + 1;
    if (num > 11) num = 1;
    this.setSelectedBg(`bg-${num}.png`);
  }

  checkMapSelectorClick(e) {
    if (!this.mapSelectorBounds || !this.canvas) return false;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const { leftBtn, rightBtn, centerBox } = this.mapSelectorBounds;

    // Vùng chạm nút Trái [<] (nới lỏng 6px hit padding)
    if (leftBtn && cx >= leftBtn.x - 6 && cx <= leftBtn.x + leftBtn.w + 6 &&
        cy >= leftBtn.y - 6 && cy <= leftBtn.y + leftBtn.h + 6) {
      this.prevBackground();
      return true;
    }

    // Vùng chạm nút Phải [>] (nới lỏng 6px hit padding)
    if (rightBtn && cx >= rightBtn.x - 6 && cx <= rightBtn.x + rightBtn.w + 6 &&
        cy >= rightBtn.y - 6 && cy <= rightBtn.y + rightBtn.h + 6) {
      this.nextBackground();
      return true;
    }

    // Chạm vào khung xem trước ở giữa cũng đổi bối cảnh kế tiếp
    if (centerBox && cx >= centerBox.x && cx <= centerBox.x + centerBox.w &&
        cy >= centerBox.y && cy <= centerBox.y + centerBox.h) {
      this.nextBackground();
      return true;
    }

    return false;
  }

  handlePointerMove(e) {
    if (this.state !== 'START' || !this.mapSelectorBounds || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    const { leftBtn, rightBtn, centerBox } = this.mapSelectorBounds;
    let hover = null;
    if (leftBtn && cx >= leftBtn.x && cx <= leftBtn.x + leftBtn.w && cy >= leftBtn.y && cy <= leftBtn.y + leftBtn.h) {
      hover = 'left';
    } else if (rightBtn && cx >= rightBtn.x && cx <= rightBtn.x + rightBtn.w && cy >= rightBtn.y && cy <= rightBtn.y + rightBtn.h) {
      hover = 'right';
    } else if (centerBox && cx >= centerBox.x && cx <= centerBox.x + centerBox.w && cy >= centerBox.y && cy <= centerBox.y + centerBox.h) {
      hover = 'center';
    }

    if (this.hoverBtn !== hover) {
      this.hoverBtn = hover;
      this.draw();
    }
  }

  updateMapSelectorUI() {
    if (!this.startOverlayEl) return;
    const currentIndex = this.getBgNumber(this.selectedBg);
    const textEl = this.startOverlayEl.querySelector('#mapSelectorText');
    if (textEl) {
      textEl.innerText = `${currentIndex} / 11`;
    }
    const imgEl = this.startOverlayEl.querySelector('#mapThumbImg');
    if (imgEl) {
      imgEl.src = `/assets/backgrounds/bg-${currentIndex}.png`;
    }
  }

  removeStartOverlay() {
    if (this.startOverlayEl) {
      this.startOverlayEl.remove();
      this.startOverlayEl = null;
    }
    const old = document.getElementById('jumpStartOverlay');
    if (old) old.remove();
  }

  mountStartOverlay() {
    this.removeStartOverlay();

    const parent = (this.canvas && this.canvas.parentElement) || document.getElementById('canvasViewport');
    if (!parent) return;

    const overlay = document.createElement('div');
    overlay.id = 'jumpStartOverlay';
    overlay.className = 'absolute inset-0 flex items-center justify-center select-none p-3 pointer-events-auto';

    const currentIndex = this.getBgNumber(this.selectedBg);
    const personalHigh = parseInt(localStorage.getItem('thang_high_score') || '0', 10);

    overlay.innerHTML = `
      <div id="jumpStartCard">
        <h2 class="text-[20px] sm:text-[21px] font-extrabold text-[#00f2fe] drop-shadow-[0_0_12px_#00f2fe] tracking-wide m-0 leading-tight">THẮNG NHẢY DÂY</h2>
        
        <div class="text-[13px] sm:text-[13.5px] font-medium text-white leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          <p class="m-0">⚡ Chạm màn hình đúng nhịp</p>
          <p class="m-0">dây chạm đất để nhảy qua!</p>
        </div>
        
        <p class="text-[14px] sm:text-[14.5px] font-bold text-[#facc15] m-0 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">🏆 Kỷ lục của bạn: ${personalHigh} điểm</p>
        
        <!-- Nút HÀNH LANG dạng Pill Button duy nhất nằm chính giữa -->
        <button id="btnMapSelector" type="button" class="map-selector-btn bg-selector-btn" title="Chạm để đổi hành lang" style="cursor: pointer; touch-action: manipulation; z-index: 100; position: relative;">
          <img id="mapThumbImg" src="/assets/backgrounds/bg-${currentIndex}.png" alt="Preview" class="map-thumb-img pointer-events-none" style="pointer-events: none;" />
          <div class="map-text-group pointer-events-none" style="pointer-events: none;">
            <span class="map-label" style="pointer-events: none; font-size: 13px; font-weight: 700; color: #cbd5e1;">HÀNH LANG</span>
            <span id="mapSelectorText" class="map-number" style="pointer-events: none; font-size: 15px; font-weight: 800; color: #38bdf8;">${currentIndex} / 11</span>
          </div>
        </button>
        
        <!-- Nút bắt đầu chơi -->
        <button id="jumpStartBtn" type="button" class="text-[15.5px] sm:text-[16px] font-extrabold text-[#4ade80] drop-shadow-[0_0_10px_#4ade80] animate-pulse hover:scale-105 active:scale-95 transition bg-transparent border-0 cursor-pointer touch-manipulation mt-0.5 p-1 select-none">
          👉 CHẠM ĐỂ BẮT ĐẦU 👈
        </button>
      </div>
    `;

    parent.appendChild(overlay);
    this.startOverlayEl = overlay;

    const bgButton = overlay.querySelector('#btnMapSelector, .bg-selector-btn');
    const card = overlay.querySelector('#jumpStartCard');
    const startBtn = overlay.querySelector('#jumpStartBtn');

    // 1. Chặn nổi bọt các sự kiện chạm/chuột để không lọt lên màn hình cha
    ['pointerdown', 'pointerup', 'mousedown', 'touchstart'].forEach((evt) => {
      if (bgButton) {
        bgButton.addEventListener(evt, (e) => {
          e.stopPropagation();
        }, { passive: false });
      }
    });

    // 2. Gán listener trực tiếp trên cả 2 sự kiện 'click' và 'touchend' để chuyển bối cảnh
    const handleBgSwitch = (e) => {
      e.preventDefault();
      e.stopPropagation();
      let currentBgIndex = this.getBgNumber(this.selectedBg);
      // Chuyển sang ảnh tiếp theo (1 -> 11 rồi quay về 1)
      currentBgIndex = (currentBgIndex % 11) + 1;
      this.updateBackground(currentBgIndex);
    };

    if (bgButton) {
      bgButton.addEventListener('click', handleBgSwitch);
      bgButton.addEventListener('touchend', handleBgSwitch, { passive: false });
    }

    // 3. Cơ chế kích hoạt Bắt Đầu Chơi:
    const handleStartAction = (e) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      this.start();
    };

    if (startBtn) {
      startBtn.addEventListener('click', handleStartAction);
      startBtn.addEventListener('touchend', handleStartAction, { passive: false });
    }

    // Chạm khu vực ngoài bảng bối cảnh (backdrop overlay)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleStartAction(e);
      }
    });
    overlay.addEventListener('touchend', (e) => {
      if (e.target === overlay) {
        handleStartAction(e);
      }
    }, { passive: false });

    // Ngăn chặn chạm vào các phần khác trong card (ngoài startBtn và bgButton) kích hoạt start
    if (card) {
      card.addEventListener('click', (e) => {
        if (e.target !== startBtn && !startBtn.contains(e.target)) {
          e.stopPropagation();
        }
      });
      card.addEventListener('touchend', (e) => {
        if (e.target !== startBtn && !startBtn.contains(e.target)) {
          e.stopPropagation();
        }
      }, { passive: false });
    }
  }

  init(canvas, options = {}) {
    super.init(canvas, options);
    this.setupCanvas();
    this.state = 'START';
    this.loadAssets();

    this.addListener(window, 'resize', this.handleResize);

    // Thiết lập vùng chạm và con trỏ cho toàn màn hình game
    if (this.canvas) {
      this.canvas.style.touchAction = 'manipulation';
      this.canvas.style.cursor = 'pointer';
    }
    const viewport = document.getElementById('canvasViewport');
    if (viewport) {
      viewport.style.touchAction = 'manipulation';
      viewport.style.cursor = 'pointer';
    }
    const modal = document.getElementById('arcadeModal');
    if (modal) {
      modal.style.touchAction = 'manipulation';
      modal.style.cursor = 'pointer';
    }

    const handleAction = (e) => {
      // Bỏ qua nếu chạm vào nút đóng game, nút âm thanh, Start Overlay hoặc map selector
      if (e.target.closest('#closeArcadeBtn, #soundToggleBtn, .ui-modal, .ui-interactive, button, a, #jumpStartOverlay, .map-selector-btn, .bg-selector-btn, .map-selector, .game-over-overlay')) return;

      if (this.state === 'START') {
        return;
      }

      if (this.state === 'IDLE') {
        this.start();
      } else if (this.state === 'PLAYING') {
        this.jump();
      }
    };

    // Gán sự kiện vào toàn màn hình (modal / viewport / canvas)
    const touchTarget = modal || viewport || this.canvas;
    this.addListener(touchTarget, 'pointerdown', handleAction);

    const handleKeyDown = (e) => {
      if (this.state === 'START') {
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          this.prevBackground();
          return;
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          this.nextBackground();
          return;
        }
      }

      if (this.state === 'GAMEOVER') {
        if (e.code === 'Space' && this.canRestart) {
          e.preventDefault();
          this.removeGameOverOverlay();
          this.start();
          if (this.onPlayAgainCallback) {
            this.onPlayAgainCallback();
          }
        }
        return;
      }

      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleAction(e);
      }
    };
    this.addListener(window, 'keydown', handleKeyDown);

    // Initial render
    this.draw();
  }

  loadAssets() {
    this.selectedBg = this.getSelectedBg();
    this.loadBackground(this.selectedBg);

    this.jumpSprite = new Image();
    this.jumpSprite.src = '/assets/thang-jump.png';

    const onSpriteLoad = () => {
      this.assetsLoaded = true;
      if (this.state !== 'PLAYING') this.draw();
    };

    if (this.jumpSprite.complete && this.jumpSprite.naturalWidth > 0) {
      onSpriteLoad();
    } else {
      this.jumpSprite.onload = onSpriteLoad;
    }
  }

  handleResize() {
    this.setupCanvas();
    if (this.state !== 'PLAYING') this.draw();
  }

  setupCanvas() {
    if (!this.canvas) return;
    const viewport = document.getElementById('canvasViewport');
    const viewportW = (viewport && viewport.clientWidth > 0) ? viewport.clientWidth : (window.innerWidth || 380);
    const viewportH = (viewport && viewport.clientHeight > 0) ? viewport.clientHeight : (window.innerHeight ? window.innerHeight - 150 : 500);

    // Mở rộng bề ngang tương đương game Xếp Hình (90-94% viewport mobile, max 400px, min 300px)
    const width = Math.floor(Math.min(Math.max(viewportW * 0.94, 300), 400));
    const height = Math.floor(Math.min(Math.max(viewportH, 440), 520));

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.width = width;
    this.height = height;

    this.char.x = this.width / 2;
    this.char.baseY = this.height * 0.60;
    this.char.y = this.char.baseY;
  }

  /**
   * Cập nhật tốc độ quay của dây và đồng bộ thời gian nhảy theo điểm số:
   * 1. 0 - 10 điểm đầu: Tốc độ cơ bản baseSpeed giúp người chơi làm quen nhịp nhảy.
   * 2. Từ điểm thứ 10 trở đi: Mỗi điểm ghi thêm tăng nhẹ dần 1% (~ mỗi 5 điểm tăng 5% tốc độ).
   * 3. Giới hạn trần tốc độ tối đa (Max Speed Cap): Math.min(speed, baseSpeed * 1.85) để giữ độ phản xạ tốt ở mốc 50 - 100+ điểm.
   * 4. Đồng bộ thời gian lơ lửng trên không (air time): Tăng trọng lực & lực nhảy tương ứng để nhân vật tiếp đất kịp nhịp quay nhanh dần.
   */
  updateSpeedAndPhysics() {
    const baseSpeed = this.rope.baseSpeed;
    const maxSpeed = baseSpeed * 1.85;

    // 1. Tốc độ dây theo mốc điểm: 0-10 điểm đầu giữ baseSpeed, sau đó tăng dần 1%/điểm (tương đương 5%/5 điểm)
    let speed = baseSpeed;
    if (this.score > 10) {
      const pointsAbove10 = this.score - 10;
      speed = baseSpeed * (1 + pointsAbove10 * 0.01);
    }

    // 2. Giới hạn trần tốc độ tối đa (Max Speed Cap)
    this.rope.speed = Math.min(speed, maxSpeed);

    // 3. Đồng bộ thời gian lơ lửng trên không (jump duration / air time) của nhân vật Thắng:
    // Tỉ lệ tăng tốc của dây so với tốc độ gốc
    const speedRatio = this.rope.speed / baseSpeed;

    // Đồng bộ gia tốc trọng trường và lực bật nhảy để nhân vật tiếp đất vừa khít nhịp dây
    this.char.gravity = this.char.baseGravity * speedRatio;
    this.char.jumpForce = this.char.baseJumpForce * Math.sqrt(speedRatio);
  }

  jump() {
    if (this.char.isGrounded) {
      this.char.vy = this.char.jumpForce;
      this.char.isGrounded = false;
      this.char.targetScaleX = 0.9;
      this.char.targetScaleY = 1.15;
      soundEngine.playJump();
    }
  }

  showStartScreen() {
    this.setupCanvas();
    this.state = 'START';
    this.selectedBg = this.getSelectedBg();
    this.loadBackground(this.selectedBg);
    this.mountStartOverlay();
    this.score = 0;
    this.combo = 0;
    this.canRestart = false;
    this.updateSpeedAndPhysics();
    this.rope.angle = -Math.PI / 2; // Dây nằm phía trên đỉnh đầu, không quay
    this.rope.passedBottom = false;
    this.char.x = this.width / 2;
    this.char.baseY = this.height * 0.60;
    this.char.y = this.char.baseY;
    this.char.vy = 0;
    this.char.isGrounded = true;
    this.particles = [];
    this.floatingTexts = [];
    this.highScore = parseInt(localStorage.getItem('thang_high_score') || '0', 10);
    this.updateScore(0);

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.loop);
  }

  start() {
    this.removeStartOverlay();
    this.removeGameOverOverlay();
    this.state = 'PLAYING';
    this.score = 0;
    this.combo = 0;
    this.canRestart = false;
    this.updateSpeedAndPhysics();
    this.rope.angle = -Math.PI / 2;
    this.rope.passedBottom = false;
    this.char.y = this.char.baseY;
    this.char.vy = 0;
    this.char.isGrounded = true;
    this.particles = [];
    this.floatingTexts = [];

    this.updateScore(0);

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.lastTime = performance.now();
    this.animationId = requestAnimationFrame(this.loop);
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.shake = 16;
    soundEngine.playTrip();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('thang_high_score', this.highScore);
    }

    this.triggerGameOver(this.score);
    this.showGameOverOverlay({
      title: 'VẤP DÂY RỒI!',
      score: this.score,
      highScore: this.highScore,
      subtitle: this.getTitle(this.score)
    });

    setTimeout(() => {
      this.canRestart = true;
    }, 450);
  }

  getTitle(score) {
    if (score >= 100) return '👑 Huyền Thoại Hành Lang 1m5';
    if (score >= 50) return '⚡ Bậc Thầy Double Under';
    if (score >= 30) return '🔥 Quái Kiệt Nhảy Dây';
    if (score >= 15) return '⭐ Chuyên Gia Bắt Nhịp';
    if (score >= 5) return '👟 Khởi Động Hành Lang';
    return '🌱 Tập Sự Nhảy Dây';
  }

  spawnScoreParticles(x, y) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 4 - 2,
        color: ['#39ff14', '#00f0ff', '#facc15', '#ffffff'][Math.floor(Math.random() * 4)],
        size: Math.random() * 5 + 2,
        life: 1,
        decay: 0.035
      });
    }

    this.floatingTexts.push({
      x: x + 40,
      y: y - 20,
      text: '+1',
      life: 1,
      decay: 0.03
    });
  }

  update(dt) {
    if (this.shake > 0) this.shake *= 0.88;
    if (this.shake < 0.2) this.shake = 0;

    this.char.scaleX += (this.char.targetScaleX - this.char.scaleX) * 0.18;
    this.char.scaleY += (this.char.targetScaleY - this.char.scaleY) * 0.18;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1.2;
      ft.life -= ft.decay;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.state !== 'PLAYING') return;

    // 1. Character Jump Physics
    this.char.y += this.char.vy;
    this.char.vy += this.char.gravity;

    if (this.char.y >= this.char.baseY) {
      this.char.y = this.char.baseY;
      this.char.vy = 0;
      if (!this.char.isGrounded) {
        this.char.isGrounded = true;
        this.char.targetScaleX = 1.15;
        this.char.targetScaleY = 0.85;
        setTimeout(() => {
          this.char.targetScaleX = 1;
          this.char.targetScaleY = 1;
        }, 80);
      }
    }

    this.char.jumpHeight = this.char.baseY - this.char.y;

    // 2. Rope Rotation Physics
    const prevAngle = this.rope.angle;
    this.rope.angle += this.rope.speed;

    if (this.rope.angle > Math.PI) {
      this.rope.angle -= Math.PI * 2;
      this.rope.passedBottom = false;
    }

    if (prevAngle < 0 && this.rope.angle >= 0) {
      soundEngine.playWhoosh(1 + this.score * 0.01);
    }

    // 3. Collision Detection at bottom
    const hitAngle = Math.PI / 2;
    const dangerRange = 0.28;
    const isAtBottom = Math.abs(this.rope.angle - hitAngle) < dangerRange;

    if (isAtBottom && !this.rope.passedBottom) {
      const isCleared = this.char.jumpHeight >= 7;

      if (!isCleared) {
        this.gameOver();
        return;
      } else {
        this.rope.passedBottom = true;
        this.score++;
        this.combo++;
        this.updateScore(this.score);
        soundEngine.playScore();
        this.spawnScoreParticles(this.char.x, this.char.baseY + 30);

        if (this.score % 25 === 0) {
          soundEngine.playCelebration();
        }

        this.updateSpeedAndPhysics();
      }
    }
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    if (!this.width || !this.height || !this.char.x || isNaN(this.char.x)) {
      this.setupCanvas();
    }
    this.ctx.save();

    if (this.shake > 0) {
      const sx = (Math.random() - 0.5) * this.shake;
      const sy = (Math.random() - 0.5) * this.shake;
      this.ctx.translate(sx, sy);
    }

    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Background
    this.drawHallwayBackground();

    // 2. Rope behind character
    const isRopeBehind = this.rope.angle > Math.PI / 2 || this.rope.angle < -Math.PI / 2;
    if (isRopeBehind) {
      this.drawRope();
    }

    // 3. Character Shadow & Character
    this.drawShadow();
    this.drawThangCharacter();

    // 4. Rope in front
    if (!isRopeBehind) {
      this.drawRope();
    } else {
      this.drawHandleConnectors();
    }

    // 5. Particles & Popups
    this.drawParticles();
    this.drawFloatingTexts();

    // 6. Overlays
    if (this.state === 'IDLE' || this.state === 'START') {
      if (!this.startOverlayEl) {
        this.drawStartOverlay();
      }
    } else if (this.state === 'GAMEOVER') {
      this.drawGameOverOverlay();
    }

    this.ctx.restore();
  }

  drawHallwayBackground() {
    const w = this.width || 380;
    const h = this.height || 500;

    // 3. Bảo vệ hàm vẽ Canvas: kiểm tra điều kiện an toàn trước khi vẽ nền
    const bg = this.bgImage || this.bgImg;
    if (bg && bg.complete && bg.naturalWidth > 0) {
      const imgW = bg.naturalWidth;
      const imgH = bg.naturalHeight;
      const scale = Math.max(w / imgW, h / imgH);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (imgW - sw) / 2;
      const sy = (imgH - sh) * 0.44;
      this.ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, w, h);
    } else {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0b0e1c');
      grad.addColorStop(0.5, '#090c18');
      grad.addColorStop(1, '#070913');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  drawShadow() {
    const x = this.char.x;
    const y = this.char.baseY + 158;
    const jump = this.char.jumpHeight;

    const scale = Math.max(0.4, 1 - jump / 45);
    const alpha = Math.max(0.25, 0.75 - jump / 35);

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, 68 * scale, 15 * scale, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    this.ctx.fill();

    if (jump < 20) {
      this.ctx.beginPath();
      this.ctx.ellipse(x, y + 2, 48 * scale, 8 * scale, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 240, 255, ${0.28 * (1 - jump / 20)})`;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawThangCharacter() {
    this.ctx.save();
    const cx = this.char.x;
    const cy = this.char.y;

    this.ctx.translate(cx, cy);
    this.ctx.scale(this.char.scaleX, this.char.scaleY);

    const spriteH = 340;
    const aspect = (this.jumpSprite && this.jumpSprite.complete && this.jumpSprite.naturalHeight > 0)
      ? (this.jumpSprite.naturalWidth / this.jumpSprite.naturalHeight)
      : 0.62;
    const spriteW = Math.round(spriteH * aspect);

    if (this.state === 'GAMEOVER') {
      this.ctx.rotate(0.18);
      if (this.jumpSprite && this.jumpSprite.complete && this.jumpSprite.naturalWidth > 0) {
        this.ctx.drawImage(this.jumpSprite, -spriteW / 2, -spriteH / 2 + 15, spriteW, spriteH);
      }
      this.drawDizzyStars(0, -spriteH / 2 - 12);
    } else {
      if (this.jumpSprite && this.jumpSprite.complete && this.jumpSprite.naturalWidth > 0) {
        this.ctx.drawImage(this.jumpSprite, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
      }
    }

    this.ctx.restore();
  }

  drawDizzyStars(cx, cy) {
    this.ctx.save();
    const now = performance.now() * 0.005;
    for (let i = 0; i < 4; i++) {
      const ang = now + (i * Math.PI) / 2;
      const sx = cx + Math.cos(ang) * 35;
      const sy = cy + Math.sin(ang) * 12;
      this.ctx.fillStyle = i % 2 === 0 ? '#ffd60a' : '#ff9e00';
      this.ctx.font = `16px ${VIETNAMESE_FONT}`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText('💫', sx, sy);
    }
    this.ctx.restore();
  }

  drawRope() {
    const cx = this.char.x;
    const cy = this.char.baseY + 12;
    const angle = this.rope.angle;

    const radiusY = 168;
    const ropeY = cy + Math.sin(angle) * radiusY;
    const ropeZ = Math.cos(angle);

    const scaleX = this.char.scaleX || 1;
    const scaleY = this.char.scaleY || 1;
    const handleDistX = 99.6 * scaleX;
    const handleOffsetY = 28.2 * scaleY;

    const leftHandleX = cx - handleDistX;
    const leftHandleY = this.char.y + handleOffsetY;
    const rightHandleX = cx + handleDistX;
    const rightHandleY = this.char.y + handleOffsetY;

    this.ctx.save();

    const isFront = ropeZ >= 0;
    const lineWidth = isFront ? 4.8 : 2.8;
    const alpha = isFront ? 1.0 : 0.65;

    this.ctx.strokeStyle = `rgba(255, 158, 0, ${alpha})`;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.shadowColor = '#ff6a00';
    this.ctx.shadowBlur = isFront ? 18 : 6;

    const curveApexY = ropeY;
    const drop = curveApexY - Math.min(leftHandleY, rightHandleY);
    const isOverhead = drop < 0;

    const tanSpread = 68 * (1 + 0.1 * ropeZ);
    const sideSpread = isOverhead ? 26 : 16;
    const dropFactor = isOverhead ? 0.42 : 0.55;

    if (isFront && this.state === 'PLAYING') {
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 180, 20, 0.28)';
      this.ctx.lineWidth = 1.8;
      this.ctx.beginPath();
      this.ctx.moveTo(leftHandleX, leftHandleY - 6);
      this.ctx.bezierCurveTo(
        leftHandleX - sideSpread, leftHandleY + drop * dropFactor - 6,
        cx - tanSpread, curveApexY - 6,
        cx, curveApexY - 6
      );
      this.ctx.bezierCurveTo(
        cx + tanSpread, curveApexY - 6,
        rightHandleX + sideSpread, rightHandleY + drop * dropFactor - 6,
        rightHandleX, rightHandleY - 6
      );
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.ctx.beginPath();
    this.ctx.moveTo(leftHandleX, leftHandleY);
    this.ctx.bezierCurveTo(
      leftHandleX - sideSpread, leftHandleY + drop * dropFactor,
      cx - tanSpread, curveApexY,
      cx, curveApexY
    );
    this.ctx.bezierCurveTo(
      cx + tanSpread, curveApexY,
      rightHandleX + sideSpread, rightHandleY + drop * dropFactor,
      rightHandleX, rightHandleY
    );
    this.ctx.stroke();

    if (isFront) {
      this.ctx.strokeStyle = '#fff8bd';
      this.ctx.lineWidth = 1.8;
      this.ctx.shadowBlur = 4;
      this.ctx.shadowColor = '#ffd60a';
      this.ctx.stroke();
    }

    this.ctx.fillStyle = isFront ? '#ffd60a' : '#ff9e00';
    this.ctx.shadowColor = '#ff6a00';
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();
    this.ctx.arc(leftHandleX, leftHandleY, 3, 0, Math.PI * 2);
    this.ctx.arc(rightHandleX, rightHandleY, 3, 0, Math.PI * 2);
    this.ctx.fill();

    if (Math.abs(angle - Math.PI / 2) < 0.22 && this.char.jumpHeight > 2) {
      this.ctx.fillStyle = 'rgba(255, 180, 0, 0.75)';
      this.ctx.shadowColor = '#ff9e00';
      this.ctx.shadowBlur = 18;
      this.ctx.beginPath();
      this.ctx.ellipse(cx, curveApexY, 36, 6, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawHandleConnectors() {
    const cx = this.char.x;
    const scaleX = this.char.scaleX || 1;
    const scaleY = this.char.scaleY || 1;
    const handleDistX = 99.6 * scaleX;
    const handleOffsetY = 28.2 * scaleY;

    const leftHandleX = cx - handleDistX;
    const leftHandleY = this.char.y + handleOffsetY;
    const rightHandleX = cx + handleDistX;
    const rightHandleY = this.char.y + handleOffsetY;

    this.ctx.save();
    this.ctx.fillStyle = '#ff9e00';
    this.ctx.shadowColor = '#ff6a00';
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();
    this.ctx.arc(leftHandleX, leftHandleY, 3, 0, Math.PI * 2);
    this.ctx.arc(rightHandleX, rightHandleY, 3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  drawParticles() {
    this.ctx.save();
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawFloatingTexts() {
    this.ctx.save();
    for (const ft of this.floatingTexts) {
      this.ctx.font = `bold 18px ${VIETNAMESE_FONT}`;
      this.ctx.fillStyle = `rgba(57, 255, 20, ${ft.life})`;
      this.ctx.shadowColor = '#39ff14';
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(ft.text, ft.x, ft.y);
    }
    this.ctx.restore();
  }

  drawStartOverlay() {
    const w = this.width || 380;
    const h = this.height || 500;
    this.ctx.save();

    // 1. Backdrop phủ mờ dịu mắt (dùng chung style với bảng thông báo GameOver)
    this.ctx.fillStyle = 'rgba(5, 8, 20, 0.82)';
    this.ctx.fillRect(0, 0, w, h);

    // 2. Khung bảng hướng dẫn (width: 90%; max-width: 340px; padding: 22px 18px)
    const cardW = Math.min(Math.max(Math.floor(w * 0.90), 280), 340);
    const cardH = 236; // Kích thước cân đối hoàn hảo bao gồm cả cụm Map Selector
    const cardX = Math.floor((w - cardW) / 2);
    const cardY = Math.floor((h - cardH) / 2);

    // Vẽ nền thẻ bo góc kính mờ với viền phát sáng cyan neon
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.45)';
    this.ctx.lineWidth = 1.5;
    this.ctx.shadowColor = 'rgba(0, 242, 254, 0.35)';
    this.ctx.shadowBlur = 18;
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(cardX, cardY, cardW, cardH, 18);
      this.ctx.fill();
      this.ctx.stroke();
    } else {
      this.ctx.fillRect(cardX, cardY, cardW, cardH);
      this.ctx.strokeRect(cardX, cardY, cardW, cardH);
    }
    this.ctx.restore();

    // Giới hạn hiển thị bên trong viền phát sáng (overflow: hidden)
    this.ctx.save();
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(cardX, cardY, cardW, cardH, 18);
      this.ctx.clip();
    }

    const cx = w / 2;
    let curY = cardY + 22;

    // Dòng 1. Tiêu đề: "THẮNG NHẢY DÂY" (font-weight: 800, màu xanh cyan neon sáng, cỡ 22px)
    curY += 20; // baseline
    this.ctx.save();
    this.ctx.fillStyle = '#00f2fe';
    this.ctx.shadowColor = '#00f2fe';
    this.ctx.shadowBlur = 14;
    this.ctx.font = `800 22px ${VIETNAMESE_FONT}`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('THẮNG NHẢY DÂY', cx, curY);
    this.ctx.restore();
    curY += 12; // khoảng cách

    // Dòng 2. Hướng dẫn: "⚡ Chạm màn hình đúng nhịp dây chạm đất để nhảy qua!" (font-size: 15px, màu trắng sáng, font-weight: 500, ngắt dòng tự nhiên)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `500 15px ${VIETNAMESE_FONT}`;
    this.ctx.textAlign = 'center';
    curY += 14; // baseline dòng 1
    this.ctx.fillText('⚡ Chạm màn hình đúng nhịp', cx, curY);
    curY += 20; // ngắt dòng tự nhiên dòng 2
    this.ctx.fillText('dây chạm đất để nhảy qua!', cx, curY);
    curY += 12; // khoảng cách

    // Dòng 3. Kỷ lục: "🏆 Kỷ lục của bạn: X điểm" (font-size: 16px, font-weight: 700, màu vàng gold)
    curY += 15; // baseline
    const personalHigh = parseInt(localStorage.getItem('thang_high_score') || '0', 10);
    this.ctx.fillStyle = '#facc15';
    this.ctx.font = `700 16px ${VIETNAMESE_FONT}`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`🏆 Kỷ lục của bạn: ${personalHigh} điểm`, cx, curY);
    curY += 14; // khoảng cách

    // Dòng 4 [MỚI]. Thanh lướt chọn bối cảnh hành lang (Map Selector)
    const selectorW = Math.min(cardW - 32, 280);
    const selectorX = Math.floor(cx - selectorW / 2);
    const selectorY = curY;
    const btnSize = 40;

    const leftBtn = { x: selectorX, y: selectorY, w: btnSize, h: btnSize };
    const rightBtn = { x: selectorX + selectorW - btnSize, y: selectorY, w: btnSize, h: btnSize };
    const centerBox = {
      x: selectorX + btnSize + 8,
      y: selectorY,
      w: selectorW - (btnSize * 2) - 16,
      h: btnSize
    };

    this.mapSelectorBounds = { leftBtn, rightBtn, centerBox };

    // 4.1. Nút mũi tên Trái [<] (icon Chevron left, vùng bấm 40px x 40px, style đen mờ tối giản)
    this.ctx.save();
    this.ctx.fillStyle = this.hoverBtn === 'left' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)';
    this.ctx.strokeStyle = this.hoverBtn === 'left' ? 'rgba(0, 242, 254, 0.6)' : 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 1.2;
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(leftBtn.x, leftBtn.y, leftBtn.w, leftBtn.h, 10);
      this.ctx.fill();
      this.ctx.stroke();
    } else {
      this.ctx.fillRect(leftBtn.x, leftBtn.y, leftBtn.w, leftBtn.h);
      this.ctx.strokeRect(leftBtn.x, leftBtn.y, leftBtn.w, leftBtn.h);
    }
    // Vẽ icon Chevron Left sắc nét
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(leftBtn.x + 23, leftBtn.y + 14);
    this.ctx.lineTo(leftBtn.x + 16, leftBtn.y + 20);
    this.ctx.lineTo(leftBtn.x + 23, leftBtn.y + 26);
    this.ctx.stroke();
    this.ctx.restore();

    // 4.2. Khung xem trước ở giữa: Thumbnail + Tên/Số bối cảnh
    this.ctx.save();
    this.ctx.fillStyle = this.hoverBtn === 'center' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(10, 16, 30, 0.7)';
    this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
    this.ctx.lineWidth = 1;
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(centerBox.x, centerBox.y, centerBox.w, centerBox.h, 10);
      this.ctx.fill();
      this.ctx.stroke();
    } else {
      this.ctx.fillRect(centerBox.x, centerBox.y, centerBox.w, centerBox.h);
      this.ctx.strokeRect(centerBox.x, centerBox.y, centerBox.w, centerBox.h);
    }

    // Ô vuông thumbnail preview bối cảnh đang chọn (30x30)
    const thumbSize = 30;
    const thumbX = centerBox.x + 5;
    const thumbY = centerBox.y + 5;
    this.ctx.save();
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 6);
      this.ctx.clip();
    }
    const bg = this.bgImage || this.bgImg;
    if (bg && bg.complete && bg.naturalWidth > 0) {
      this.ctx.drawImage(bg, thumbX, thumbY, thumbSize, thumbSize);
    } else {
      this.ctx.fillStyle = '#1e293b';
      this.ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
    }
    this.ctx.restore();

    // Viền nhẹ cho thumbnail
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.lineWidth = 1;
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 6);
      this.ctx.stroke();
    }
    this.ctx.restore();

    // Chữ hiển thị tên/số hành lang: "HÀNH LANG: 1 / 11"
    const textStartX = thumbX + thumbSize + 8;
    this.ctx.textAlign = 'left';
    this.ctx.font = `700 13px ${VIETNAMESE_FONT}`;
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.fillText('HÀNH LANG', textStartX, centerBox.y + 16);

    const bgNum = this.getBgNumber(this.selectedBg);
    this.ctx.font = `800 15px ${VIETNAMESE_FONT}`;
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
    this.ctx.shadowBlur = 6;
    this.ctx.fillText(`${bgNum} / 11`, textStartX, centerBox.y + 31);
    this.ctx.restore();

    // 4.3. Nút mũi tên Phải [>] (icon Chevron right, vùng bấm 40px x 40px, style đen mờ tối giản)
    this.ctx.save();
    this.ctx.fillStyle = this.hoverBtn === 'right' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)';
    this.ctx.strokeStyle = this.hoverBtn === 'right' ? 'rgba(0, 242, 254, 0.6)' : 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 1.2;
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(rightBtn.x, rightBtn.y, rightBtn.w, rightBtn.h, 10);
      this.ctx.fill();
      this.ctx.stroke();
    } else {
      this.ctx.fillRect(rightBtn.x, rightBtn.y, rightBtn.w, rightBtn.h);
      this.ctx.strokeRect(rightBtn.x, rightBtn.y, rightBtn.w, rightBtn.h);
    }
    // Vẽ icon Chevron Right sắc nét
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(rightBtn.x + 17, rightBtn.y + 14);
    this.ctx.lineTo(rightBtn.x + 24, rightBtn.y + 20);
    this.ctx.lineTo(rightBtn.x + 17, rightBtn.y + 26);
    this.ctx.stroke();
    this.ctx.restore();

    curY += btnSize;
    curY += 16; // khoảng cách trước nút bắt đầu

    // Dòng 5. Nút bắt đầu: "👉 CHẠM ĐỂ BẮT ĐẦU 👈" (font-size: 17px, font-weight: 800, màu xanh lá neon #4ade80)
    curY += 17; // baseline
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.006);
    this.ctx.save();
    this.ctx.fillStyle = `rgba(74, 222, 128, ${pulse})`;
    this.ctx.shadowColor = '#4ade80';
    this.ctx.shadowBlur = 14 * pulse;
    this.ctx.font = `800 17px ${VIETNAMESE_FONT}`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('👉 CHẠM ĐỂ BẮT ĐẦU 👈', cx, curY);
    this.ctx.restore();

    this.ctx.restore(); // restore clip
    this.ctx.restore(); // restore start overlay
  }

  drawGameOverOverlay() {
    const w = this.width || 380;
    const h = this.height || 500;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(5, 8, 20, 0.8)';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.restore();
  }

  destroy() {
    this.removeStartOverlay();
    super.destroy();
    if (this.canvas) {
      this.canvas.style.touchAction = '';
      this.canvas.style.cursor = '';
    }
    const viewport = document.getElementById('canvasViewport');
    if (viewport) {
      viewport.style.touchAction = '';
      viewport.style.cursor = '';
    }
    const modal = document.getElementById('arcadeModal');
    if (modal) {
      modal.style.touchAction = '';
      modal.style.cursor = '';
    }
    this.mapSelectorBounds = null;
    this.hoverBtn = null;
  }

  loop(timestamp) {
    if (this.state !== 'PLAYING' && this.state !== 'GAMEOVER' && this.state !== 'START') return;
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    this.animationId = requestAnimationFrame(this.loop);
  }
}
