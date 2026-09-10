/**
 * Carousel Module: Swiper.js True Infinite Scroll
 * Cấu trúc: [Clone Tetris] - [1. Nhảy dây] - [2. Rắn] - [3. 2048] - [4. Tetris] - [Clone Nhảy dây]
 * Khi người dùng vuốt qua item clone ở bên phải (index 5), ngay lập tức gán scrollLeft
 * nhảy về vị trí item thật số 1 với behavior: 'auto' / 'instant' (TUYỆT ĐỐI KHÔNG dùng smooth).
 * Người dùng có thể vuốt liên tục sang phải từ 1 -> 2 -> 3 -> 4 -> 1 -> 2... thành một vòng tròn tuần hoàn hoàn hảo.
 */
export class GameCarousel {
  constructor(containerElement, onActiveGameChange) {
    this.container = containerElement;
    this.onActiveGameChange = onActiveGameChange;
    this.activeGameId = 'jump';
    this.isDown = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.hasMoved = false;
    this.allCards = [];
    this.isTeleporting = false;

    this.init();
  }

  init() {
    if (!this.container) return;

    // Xóa sạch clones cũ nếu có
    this.container.querySelectorAll('.clone-card').forEach((el) => el.remove());

    const originalCards = Array.from(this.container.querySelectorAll('.game-card:not(.clone-card)'));
    if (!originalCards || originalCards.length !== 4) return;

    // 1. Cấu trúc DOM Clone:
    // Clone item cuối (Tetris, index 3) chèn lên TRƯỚC item đầu
    const cloneLast = originalCards[3].cloneNode(true);
    cloneLast.classList.add('clone-card');
    cloneLast.setAttribute('data-is-clone', 'last');
    this.container.insertBefore(cloneLast, originalCards[0]);

    // Clone item đầu (Nhảy dây, index 0) chèn vào SAU item cuối
    const cloneFirst = originalCards[0].cloneNode(true);
    cloneFirst.classList.add('clone-card');
    cloneFirst.setAttribute('data-is-clone', 'first');
    this.container.appendChild(cloneFirst);

    // Danh sách 6 thẻ:
    // 0: [Clone Tetris]
    // 1: [1. Nhảy dây]
    // 2: [2. Rắn]
    // 3: [3. 2048]
    // 4: [4. Tetris]
    // 5: [Clone Nhảy dây]
    this.allCards = Array.from(this.container.querySelectorAll('.game-card'));

    // 2. Định vị ban đầu vào [1. Nhảy dây] thật (index 1) bằng instant
    this.centerCardInstant(1);
    this.setActiveGame('jump', this.allCards[1], false);

    // 3. Mouse Drag Scrolling trên PC
    this.initMouseDrag();

    // 4. Click thẻ để cuộn vào giữa
    this.initCardClick();

    // 5. Lắng nghe scroll & scrollend để teleport âm thầm tức thì
    this.initScrollHandlers();
  }

  getCenterScrollLeft(card) {
    if (!card || !this.container) return 0;
    return card.offsetLeft - (this.container.clientWidth - card.clientWidth) / 2;
  }

  centerCardInstant(index) {
    const card = this.allCards[index];
    if (!card || !this.container) return;

    const target = this.getCenterScrollLeft(card);

    this.container.style.scrollBehavior = 'auto';
    this.container.style.scrollSnapType = 'none';
    this.container.scrollLeft = target;

    requestAnimationFrame(() => {
      void this.container.offsetWidth;
      this.container.style.scrollSnapType = 'x mandatory';
    });
  }

  centerCardSmooth(index) {
    const card = this.allCards[index];
    if (!card || !this.container) return;

    const target = this.getCenterScrollLeft(card);
    this.container.scrollTo({
      left: target,
      behavior: 'smooth'
    });
  }

  /**
   * Reset vị trí cuộn về đúng thẻ [1. Nhảy Dây] và kích hoạt tải Bảng Vàng
   */
  resetToDefault() {
    if (!this.container || !this.allCards || this.allCards.length < 6) return;

    this.isTeleporting = true;
    this.container.style.scrollSnapType = 'none';
    this.container.style.scrollBehavior = 'auto';

    const jumpCard = this.allCards[1];
    if (jumpCard) {
      const target = this.getCenterScrollLeft(jumpCard);
      this.container.scrollLeft = target;
    }

    this.setActiveGame('jump', this.allCards[1], true);

    requestAnimationFrame(() => {
      void this.container.offsetWidth;
      this.container.style.scrollSnapType = 'x mandatory';
      setTimeout(() => {
        this.isTeleporting = false;
      }, 50);
    });
  }

  /**
   * Teleport tức thì giữa thẻ Clone và thẻ Thật tương ứng mà không giật lùi
   */
  teleportTo(targetIndex, gameId) {
    this.isTeleporting = true;

    // Tắt scroll-snap và ép behavior: 'auto'
    this.container.style.scrollSnapType = 'none';
    this.container.style.scrollBehavior = 'auto';

    const card = this.allCards[targetIndex];
    if (card) {
      const target = this.getCenterScrollLeft(card);
      this.container.scrollLeft = target;
    }

    // Đồng bộ trạng thái active card & dots
    this.setActiveGame(gameId, this.allCards[targetIndex], false);

    requestAnimationFrame(() => {
      void this.container.offsetWidth;
      this.container.style.scrollSnapType = 'x mandatory';
      setTimeout(() => {
        this.isTeleporting = false;
      }, 50);
    });
  }

  initMouseDrag() {
    const el = this.container;

    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.launch-game-btn')) return;

      this.isDown = true;
      this.hasMoved = false;
      el.classList.add('cursor-grabbing');
      this.startX = e.pageX - el.offsetLeft;
      this.scrollLeft = el.scrollLeft;
    });

    const endDrag = () => {
      if (!this.isDown) return;
      this.isDown = false;
      el.classList.remove('cursor-grabbing');
      setTimeout(() => this.handleScrollEnd(), 60);
    };

    el.addEventListener('mouseleave', endDrag);
    el.addEventListener('mouseup', endDrag);

    el.addEventListener('mousemove', (e) => {
      if (!this.isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - this.startX) * 1.5;
      if (Math.abs(walk) > 6) {
        this.hasMoved = true;
      }
      el.scrollLeft = this.scrollLeft - walk;
    });
  }

  initCardClick() {
    this.allCards.forEach((card, idx) => {
      card.addEventListener('click', (e) => {
        if (this.hasMoved || e.target.closest('.launch-game-btn')) return;

        this.centerCardSmooth(idx);
        const gameId = card.dataset.gameId;
        this.setActiveGame(gameId, card);
      });
    });
  }

  getClosestCenterIndex() {
    if (!this.container) return 1;
    const containerCenter = this.container.getBoundingClientRect().left + this.container.clientWidth / 2;
    let minDiff = Infinity;
    let closestIdx = 1;

    this.allCards.forEach((card, idx) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const diff = Math.abs(cardCenter - containerCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    return closestIdx;
  }

  initScrollHandlers() {
    let debounceTimer = null;

    const onScrollUpdate = () => {
      if (this.isTeleporting) return;

      // Cập nhật real-time active UI theo game tương ứng
      const closestIdx = this.getClosestCenterIndex();
      let activeGid = 'jump';
      if (closestIdx === 0 || closestIdx === 4) activeGid = 'tetris';
      else if (closestIdx === 1 || closestIdx === 5) activeGid = 'jump';
      else if (closestIdx === 2) activeGid = 'snake';
      else if (closestIdx === 3) activeGid = '2048';

      this.updateDotsUI(activeGid);

      // Debounce fallback cho các trình duyệt chưa hỗ trợ scrollend
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.handleScrollEnd();
      }, 70);
    };

    this.container.addEventListener('scroll', onScrollUpdate, { passive: true });

    // Sự kiện scrollend chuẩn của trình duyệt hiện đại
    this.container.addEventListener('scrollend', () => {
      clearTimeout(debounceTimer);
      this.handleScrollEnd();
    });

    window.addEventListener('resize', () => {
      this.centerCardInstant(this.getRealCardIndex(this.activeGameId));
    });
  }

  getRealCardIndex(gameId) {
    const map = { jump: 1, snake: 2, '2048': 3, tetris: 4 };
    return map[gameId] || 1;
  }

  handleScrollEnd() {
    if (this.isTeleporting) return;

    const closestIdx = this.getClosestCenterIndex();

    // 1. Người dùng vuốt qua phải vào [Clone Nhảy dây] (index 5)
    // -> Ngay lập tức gán scrollLeft nhảy về vị trí [1. Nhảy dây] với behavior: 'auto' / 'instant'
    if (closestIdx === 5) {
      this.teleportTo(1, 'jump');
      return;
    }

    // 2. Người dùng vuốt qua trái vào [Clone Tetris] (index 0)
    // -> Ngay lập tức gán scrollLeft nhảy về vị trí [4. Tetris] với behavior: 'auto' / 'instant'
    if (closestIdx === 0) {
      this.teleportTo(4, 'tetris');
      return;
    }

    // 3. Đang ở trong khoảng thẻ thật 1..4
    const realCard = this.allCards[closestIdx];
    if (realCard) {
      this.setActiveGame(realCard.dataset.gameId, realCard);
    }
  }

  setActiveGame(gameId, cardElement, notify = true) {
    this.activeGameId = gameId;

    this.allCards.forEach((card) => {
      card.classList.remove('ring-2', 'ring-cyan-400', 'scale-[1.02]', 'shadow-cyan-500/20');
      card.classList.add('opacity-75');
    });

    if (cardElement) {
      cardElement.classList.remove('opacity-75');
      cardElement.classList.add('ring-2', 'ring-cyan-400', 'scale-[1.02]', 'shadow-cyan-500/20');
    }

    this.updateDotsUI(gameId);

    if (notify && this.onActiveGameChange) {
      this.onActiveGameChange(gameId);
    }
  }

  updateDotsUI(activeGameId) {
    const dots = document.querySelectorAll('.carousel-dot');
    dots.forEach((dot) => {
      if (dot.dataset.gameId === activeGameId) {
        dot.classList.add('bg-cyan-400', 'w-6');
        dot.classList.remove('bg-slate-700', 'w-2');
      } else {
        dot.classList.remove('bg-cyan-400', 'w-6');
        dot.classList.add('bg-slate-700', 'w-2');
      }
    });
  }

  scrollToGame(gameId) {
    const currentIdx = this.getClosestCenterIndex();

    // Vòng tròn tuần hoàn khi click dot:
    // Nếu đang ở Tetris (4) bấm vào Nhảy Dây (jump) -> cuộn tới Clone Nhảy Dây (5) rồi instant teleport về 1
    if ((currentIdx === 4 || currentIdx === 0) && gameId === 'jump') {
      this.centerCardSmooth(5);
      this.setActiveGame('jump', this.allCards[5]);
      return;
    }

    // Nếu đang ở Nhảy Dây (1) bấm vào Tetris -> cuộn lùi tới Clone Tetris (0) rồi instant teleport về 4
    if ((currentIdx === 1 || currentIdx === 5) && gameId === 'tetris') {
      this.centerCardSmooth(0);
      this.setActiveGame('tetris', this.allCards[0]);
      return;
    }

    const realIdx = this.getRealCardIndex(gameId);
    this.centerCardSmooth(realIdx);
    this.setActiveGame(gameId, this.allCards[realIdx]);
  }

  detectCenterCard() {
    this.handleScrollEnd();
  }

  destroy() {
    this.allCards = [];
  }
}

