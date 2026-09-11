import { soundEngine } from './games/SoundEngine.js';
import { GameController } from './games/GameController.js';
import { GameGridManager } from './modules/gameGrid.js';
import { LeaderboardManager } from './modules/leaderboard.js';
import { AffiliateManager } from './modules/affiliate.js';
import { DonateModalManager } from './modules/donateModal.js';

// Chặn triệt để phóng to màn hình (Gesture Zoom & Double-tap Zoom) trên iOS/Safari
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

document.addEventListener('DOMContentLoaded', () => {
  // Game Titles mapping
  const gameTitles = {
    jump: 'THẮNG NHẢY DÂY',
    snake: 'CYBER SNAKE',
    2048: '2048 NEON',
    tetris: 'XẾP HÌNH NEON'
  };

  // 0. Bố cục 2 Tab chính (Main Navigation)
  const tabBtnProducts = document.getElementById('mainTabProducts');
  const tabBtnArcade = document.getElementById('mainTabArcade');
  const tabContentProducts = document.getElementById('tabContentProducts');
  const tabContentArcade = document.getElementById('tabContentArcade');

  const switchMainTab = (activeTab) => {
    if (activeTab === 'products') {
      if (tabBtnProducts) {
        tabBtnProducts.classList.add('active-tab');
        tabBtnProducts.classList.remove('text-slate-400');
      }
      if (tabBtnArcade) {
        tabBtnArcade.classList.remove('active-tab');
        tabBtnArcade.classList.add('text-slate-400');
      }
      if (tabContentProducts) tabContentProducts.classList.remove('hidden');
      if (tabContentArcade) tabContentArcade.classList.add('hidden');
    } else {
      if (tabBtnArcade) {
        tabBtnArcade.classList.add('active-tab');
        tabBtnArcade.classList.remove('text-slate-400');
      }
      if (tabBtnProducts) {
        tabBtnProducts.classList.remove('active-tab');
        tabBtnProducts.classList.add('text-slate-400');
      }
      if (tabContentArcade) tabContentArcade.classList.remove('hidden');
      if (tabContentProducts) tabContentProducts.classList.add('hidden');

      // 1. Thiết lập game mặc định khi mở tab: Thắng Nhảy Dây (jump)
      if (gameGrid && gameGrid.resetToDefault) {
        gameGrid.resetToDefault();
      }
    }
  };

  if (tabBtnProducts) {
    tabBtnProducts.addEventListener('click', () => switchMainTab('products'));
  }
  if (tabBtnArcade) {
    tabBtnArcade.addEventListener('click', () => switchMainTab('arcade'));
  }

  // 1. Quản lý Bảng Vàng Top 10
  const leaderboardManager = new LeaderboardManager();

  // 2. Khởi tạo Lưới Tĩnh 4 Game (Grid 2x2)
  const gameGridEl = document.getElementById('gameGrid');
  const activeTitleEl = document.getElementById('activeGameTitle');

  const gameGrid = new GameGridManager(gameGridEl, {
    onActiveGameChange: (activeGameId) => {
      if (activeTitleEl) {
        activeTitleEl.innerText = `BẢNG VÀNG TOP 10: ${gameTitles[activeGameId] || activeGameId.toUpperCase()}`;
      }
      // Tự động tải Bảng Vàng của game được chọn ngay lập tức từ cache
      leaderboardManager.fetchTop10(activeGameId);
    },
    onLaunchGame: (gameId) => {
      openGame(gameId);
    }
  });

  // Tải Bảng Vàng ban đầu (game jump)
  leaderboardManager.fetchTop10('jump');

  // Lấy tổng lượt chơi ban đầu từ D1 (/api/stats) kèm timestamp và no-store chống cache
  fetch(`/api/stats?t=${Date.now()}`, { cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.json();
    })
    .then(data => {
      const countEl = document.querySelector('#totalPlaysCount');
      if (data && data.total_plays !== undefined && countEl) {
        countEl.textContent = data.total_plays;
      }
    })
    .catch((err) => {
      console.warn('Lỗi lấy tổng lượt chơi từ /api/stats:', err);
    });

  // 3. Quản lý Arcade Viewport Modal & GameController (1 canvas duy nhất)
  const arcadeModal = document.getElementById('arcadeModal');
  const arcadeCanvas = document.getElementById('arcadeCanvas');
  const modalGameName = document.getElementById('modalGameName');
  const modalCurrentScore = document.getElementById('modalCurrentScore');
  const closeArcadeBtn = document.getElementById('closeArcadeBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const controlsContainer = document.getElementById('gameControlsContainer');

  const gameController = new GameController(arcadeCanvas, {
    controlsContainer,
    onScoreUpdate: (gameId, score) => {
      if (modalCurrentScore) modalCurrentScore.innerText = score;
    },
    onGameOver: (gameId, score) => {
      leaderboardManager.handleGameOverScore(gameId, score);
    },
    onPlayAgain: (gameId) => {
      trackGamePlay(gameId);
    },
    onGoHome: () => {
      closeGame();
    }
  });

  // Bộ đếm Tổng lượt chơi áp dụng cho TẤT CẢ các game
  const trackGamePlay = (currentGameId = 'jump') => {
    // Gửi ngay fetch POST /api/stats với body { game_id: currentGameId }
    // Xóa bỏ hoàn toàn mọi biến tạm tự cộng số ảo trên frontend
    try {
      fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: currentGameId })
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        const countEl = document.querySelector('#totalPlaysCount');
        if (countEl && data && data.total_plays !== undefined) {
          countEl.textContent = data.total_plays;
        }
      })
      .catch(err => {
        console.warn('Lỗi ghi nhận lượt chơi vào D1:', err);
      });
    } catch (e) {
      console.warn('Lỗi gọi API /api/stats:', e);
    }
  };

  // Fullscreen Lock & Scroll Lock cho Mobile khi đang chơi game
  let savedScrollY = 0;
  const preventGameTouchMove = (e) => {
    // Chặn hoàn toàn thao tác cuộn và bounce scroll trên màn hình chơi game
    e.preventDefault();
  };

  const lockBodyScroll = () => {
    savedScrollY = window.scrollY || window.pageYOffset || 0;

    // Body CSS khóa cứng
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    // HTML / DocumentElement CSS khóa cứng và chặn gesture back
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.touchAction = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehaviorX = 'none';

    if (arcadeModal) {
      arcadeModal.addEventListener('touchmove', preventGameTouchMove, { passive: false });
    }
  };

  const unlockBodyScroll = () => {
    // Khôi phục lại trạng thái cuộn bình thường của trang web
    document.body.style.overflow = '';
    document.body.style.height = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    document.body.style.touchAction = '';
    document.body.style.overscrollBehavior = '';

    document.documentElement.style.overflow = '';
    document.documentElement.style.height = '';
    document.documentElement.style.position = '';
    document.documentElement.style.width = '';
    document.documentElement.style.touchAction = '';
    document.documentElement.style.overscrollBehavior = '';
    document.documentElement.style.overscrollBehaviorX = '';

    if (arcadeModal) {
      arcadeModal.removeEventListener('touchmove', preventGameTouchMove);
    }

    window.scrollTo(0, savedScrollY);
  };

  // Mở game modal khi nhấn "CHƠI NGAY"
  const openGame = (gameId) => {
    if (!arcadeModal) return;
    if (modalGameName) modalGameName.innerText = gameTitles[gameId] || gameId;
    if (modalCurrentScore) modalCurrentScore.innerText = '0';

    // Ghi nhận lượt chơi cho game tương ứng
    trackGamePlay(gameId);

    lockBodyScroll();

    arcadeModal.classList.remove('hidden');
    arcadeModal.classList.add('flex');

    gameController.loadGame(gameId);
    gameController.startCurrentGame();
  };

  // Event delegation cho nút CHƠI NGAY (hoạt động tốt với cả cards gốc và cloned cards)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.launch-game-btn');
    if (btn) {
      const gid = btn.dataset.gameId;
      if (gid) {
        if (gameGrid) gameGrid.setActiveGame(gid);
        openGame(gid);
      }
    }
  });

  // Đóng game modal
  function closeGame() {
    if (!arcadeModal) return;
    arcadeModal.classList.add('hidden');
    arcadeModal.classList.remove('flex');
    if (gameController) {
      gameController.destroy();
    }
    unlockBodyScroll();
  }

  if (closeArcadeBtn) {
    closeArcadeBtn.addEventListener('click', closeGame);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && arcadeModal && !arcadeModal.classList.contains('hidden')) {
      closeGame();
    }
  });

  // Nút bật/tắt âm thanh
  if (soundToggleBtn) {
    soundToggleBtn.innerText = soundEngine.isMuted() ? '🔇' : '🔊';
    soundToggleBtn.addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      soundToggleBtn.innerText = isMuted ? '🔇' : '🔊';
    });
  }

  // 4. Quản lý Danh mục Affiliate
  const productsGrid = document.getElementById('productsGrid');
  const categoryTabs = document.getElementById('categoryTabs');
  new AffiliateManager(productsGrid, categoryTabs);

  // 5. Quản lý Modal QR Donate
  const donateModalEl = document.getElementById('donateModal');
  const donateBtn = document.getElementById('donateBtn');
  new DonateModalManager(donateModalEl, donateBtn);

  const footerDonateLink = document.getElementById('footerDonateLink');
  if (footerDonateLink && donateModalEl) {
    footerDonateLink.addEventListener('click', (e) => {
      e.preventDefault();
      donateModalEl.classList.remove('hidden');
      donateModalEl.classList.add('flex');
    });
  }

  // 6. Xử lý Cụm tiện ích: Nút Logo TiT (Về đầu trang) & Nút Chia sẻ (Share Button)
  const titLogoBtn = document.getElementById('titLogoBtn');
  if (titLogoBtn) {
    titLogoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    const shareUrl = 'https://thangnhayday.com';
    const shareTitle = 'Thắng Nhảy Dây - Bio Link & Arcade';

    const showShareToast = (message) => {
      const existing = document.getElementById('appShareToast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'appShareToast';
      toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-xl border border-emerald-500/80 bg-slate-950/95 text-emerald-300 shadow-2xl text-xs font-medium backdrop-blur-md flex items-center gap-2 transition-all duration-300 pointer-events-none';
      toast.innerHTML = `
        <span class="text-emerald-400">🔗</span>
        <span>${message}</span>
      `;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 10px)';
        setTimeout(() => toast.remove(), 300);
      }, 2500);
    };

    const copyToClipboard = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl)
          .then(() => showShareToast('Đã sao chép liên kết thangnhayday.com!'))
          .catch(() => fallbackCopy());
      } else {
        fallbackCopy();
      }
    };

    const fallbackCopy = () => {
      const temp = document.createElement('input');
      temp.value = shareUrl;
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand('copy');
        showShareToast('Đã sao chép liên kết thangnhayday.com!');
      } catch (_) {}
      temp.remove();
    };

    shareBtn.addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            url: shareUrl
          });
        } catch (err) {
          if (err.name !== 'AbortError') {
            copyToClipboard();
          }
        }
      } else {
        copyToClipboard();
      }
    });
  }
});
