/**
 * Leaderboard Module: Đồng bộ Bảng Vàng Cloudflare D1, Cache cục bộ, Pop-up Top 10
 * Kết nối Cloudflare Pages Functions API: /api/leaderboard
 */

// Bộ đệm Cache Bảng Vàng Client In-Memory (Top 10 của 4 game)
export const leaderboardCache = {};

export class LeaderboardManager {
  constructor() {
    this.cache = new Map(); // `${gameId}_${type}` -> { data, timestamp }
    this.cacheTTL = 60 * 1000; // 60 giây
    this.activeGameId = 'jump';
    this.currentType = 'weekly'; // 'weekly' | 'alltime'
    this.qualifyingScores = new Map();
    this.modalEl = document.getElementById('nameModal');
    this.pendingScoreSubmission = null;

    // Dữ liệu mẫu dự phòng khi chưa kết nối mạng
    this.defaultMockScores = {
      weekly: {
        jump: [
          { rank: 1, player_name: "Pro_Skipper", display_name: "Pro_Skipper", score: 95, created_at: "2026-09-08" },
          { rank: 2, player_name: "Thắng Nhảy Dây", display_name: "Thắng Nhảy Dây", score: 88, created_at: "2026-09-09" },
          { rank: 3, player_name: "SpeedHop", display_name: "SpeedHop", score: 64, created_at: "2026-09-10" },
          { rank: 4, player_name: "HànhLangMaster", display_name: "HànhLangMaster", score: 52, created_at: "2026-09-08" },
          { rank: 5, player_name: "MinhNhảy", display_name: "MinhNhảy", score: 41, created_at: "2026-09-09" }
        ],
        snake: [
          { rank: 1, player_name: "NeonSnake", display_name: "NeonSnake", score: 410, created_at: "2026-09-08" },
          { rank: 2, player_name: "CyberViper", display_name: "CyberViper", score: 360, created_at: "2026-09-09" },
          { rank: 3, player_name: "Thắng Nhảy Dây", display_name: "Thắng Nhảy Dây", score: 270, created_at: "2026-09-10" }
        ],
        '2048': [
          { rank: 1, player_name: "QuickMerge", display_name: "QuickMerge", score: 8192, created_at: "2026-09-08" },
          { rank: 2, player_name: "NeonMaster", display_name: "NeonMaster", score: 8192, created_at: "2026-09-09" },
          { rank: 3, player_name: "Thắng Nhảy Dây", display_name: "Thắng Nhảy Dây", score: 4096, created_at: "2026-09-10" }
        ],
        tetris: [
          { rank: 1, player_name: "TetrisPro", display_name: "TetrisPro", score: 7100, created_at: "2026-09-08" },
          { rank: 2, player_name: "BlockKing", display_name: "BlockKing", score: 6800, created_at: "2026-09-09" },
          { rank: 3, player_name: "Thắng Nhảy Dây", display_name: "Thắng Nhảy Dây", score: 5200, created_at: "2026-09-10" }
        ]
      },
      alltime: {
        jump: [
          { rank: 1, player_name: "Thắng Nhảy Dây", display_name: "Thắng Nhảy Dây", score: 108, created_at: "2026-09-01" },
          { rank: 2, player_name: "Pro_Skipper", display_name: "Pro_Skipper", score: 95, created_at: "2026-09-02" },
          { rank: 3, player_name: "HànhLangMaster", display_name: "HànhLangMaster", score: 72, created_at: "2026-09-03" }
        ],
        snake: [
          { rank: 1, player_name: "CyberViper", display_name: "CyberViper", score: 450, created_at: "2026-09-01" },
          { rank: 2, player_name: "NeonSnake", display_name: "NeonSnake", score: 410, created_at: "2026-09-02" }
        ],
        '2048': [
          { rank: 1, player_name: "NeonMaster", display_name: "NeonMaster", score: 16384, created_at: "2026-09-01" },
          { rank: 2, player_name: "QuickMerge", display_name: "QuickMerge", score: 8192, created_at: "2026-09-02" }
        ],
        tetris: [
          { rank: 1, player_name: "BlockKing", display_name: "BlockKing", score: 8400, created_at: "2026-09-01" },
          { rank: 2, player_name: "TetrisPro", display_name: "TetrisPro", score: 7100, created_at: "2026-09-02" }
        ]
      }
    };

    window.leaderboardManagerInstance = this;
    this.initTabs();
    this.initModalEvents();
  }

  initTabs() {
    const tabWeekly = document.getElementById('leaderboardTabWeekly');
    const tabAllTime = document.getElementById('leaderboardTabAllTime');

    const setMode = (mode) => {
      this.currentType = mode;
      this.updateTabsUI(mode);
      this.fetchLeaderboard(this.activeGameId, this.currentType);
    };

    if (tabWeekly) {
      tabWeekly.addEventListener('click', () => setMode('weekly'));
    }
    if (tabAllTime) {
      tabAllTime.addEventListener('click', () => setMode('alltime'));
    }
  }

  updateTabsUI(mode) {
    const tabWeekly = document.getElementById('leaderboardTabWeekly');
    const tabAllTime = document.getElementById('leaderboardTabAllTime');
    const banner = document.getElementById('weeklyRewardBanner');
    const lastWinnerBadge = document.getElementById('lastWeekWinnerBadge');
    const scopeTag = document.getElementById('leaderboardScopeTag');
    const isJump = this.activeGameId === 'jump';

    if (mode === 'weekly' && isJump) {
      if (tabWeekly) {
        tabWeekly.classList.add('active-pill');
        tabWeekly.classList.remove('text-slate-400', 'font-medium');
      }
      if (tabAllTime) {
        tabAllTime.classList.remove('active-pill');
        tabAllTime.classList.add('text-slate-400', 'font-medium');
      }
      if (banner) banner.classList.remove('hidden');
      if (lastWinnerBadge) lastWinnerBadge.classList.remove('hidden');
      if (scopeTag) scopeTag.innerText = '#WEEKLY';
    } else {
      if (tabAllTime) {
        tabAllTime.classList.add('active-pill');
        tabAllTime.classList.remove('text-slate-400', 'font-medium');
      }
      if (tabWeekly) {
        tabWeekly.classList.remove('active-pill');
        tabWeekly.classList.add('text-slate-400', 'font-medium');
      }
      if (banner) banner.classList.add('hidden');
      if (lastWinnerBadge) lastWinnerBadge.classList.add('hidden');
      if (scopeTag) scopeTag.innerText = '#ALL-TIME';
    }
  }

  getSavedProfile() {
    try {
      const data = localStorage.getItem('thang_player_profile');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  saveProfile(displayName, pin = '', contactInfo = '') {
    try {
      localStorage.setItem('thang_player_profile', JSON.stringify({
        display_name: displayName.trim(),
        pin: pin.trim(),
        contact_info: contactInfo.trim()
      }));
      localStorage.setItem('player_name', displayName.trim());
      localStorage.setItem('thang_player_name', displayName.trim());
    } catch (e) {}
  }

  /**
   * 1. Hàm fetchLeaderboard(gameId, type):
   * Gọi fetch(`/api/leaderboard?game_id=${gameId}&type=${type}`) để lấy dữ liệu thật từ D1 và render ra danh sách bảng vàng.
   */
  async fetchLeaderboard(gameId = this.activeGameId, type = null, forceRefresh = false) {
    const isNewGame = this.activeGameId !== gameId;
    this.activeGameId = gameId;

    const isJump = gameId === 'jump';
    let effectiveType;
    if (isJump) {
      if (type) {
        effectiveType = type === 'all_time' ? 'alltime' : type;
      } else if (isNewGame) {
        effectiveType = 'weekly';
      } else {
        effectiveType = this.currentType || 'weekly';
      }
    } else {
      effectiveType = 'alltime';
    }
    this.currentType = effectiveType;

    // Cập nhật tabs navigation
    const navContainer = document.getElementById('leaderboardNavContainer');
    const banner = document.getElementById('weeklyRewardBanner');
    const lastWinnerBadge = document.getElementById('lastWeekWinnerBadge');
    const scopeTag = document.getElementById('leaderboardScopeTag');

    if (navContainer) {
      if (isJump) {
        navContainer.classList.remove('hidden');
      } else {
        navContainer.classList.add('hidden');
      }
    }

    if (!isJump) {
      if (banner) banner.classList.add('hidden');
      if (lastWinnerBadge) lastWinnerBadge.classList.add('hidden');
      if (scopeTag) scopeTag.innerText = '#ALL-TIME';
    } else {
      this.updateTabsUI(this.currentType);
    }

    const cacheKey = `${gameId}_${effectiveType}`;
    const cachedData = leaderboardCache[cacheKey];

    if (!forceRefresh && cachedData) {
      this.renderLeaderboard(cachedData);
      return cachedData;
    }

    try {
      this.renderLoading();
      // Gọi fetch lên Cloudflare Pages Functions API nối D1
      const res = await fetch(`/api/leaderboard?game_id=${gameId}&type=${effectiveType}`);
      if (!res.ok) throw new Error('API server không phản hồi');

      const data = await res.json();
      if (data && (data.top10 || data.results)) {
        const top10 = data.top10 || data.results || [];
        const formattedData = {
          success: true,
          game_id: gameId,
          type: effectiveType,
          top10
        };
        leaderboardCache[cacheKey] = formattedData;
        this.cache.set(cacheKey, { data: formattedData, timestamp: Date.now() });
        this.renderLeaderboard(formattedData);
        return formattedData;
      }
      throw new Error('Dữ liệu không hợp lệ');
    } catch (err) {
      // Dự phòng hiển thị dữ liệu mẫu khi offline/dev local
      const modeKey = effectiveType === 'weekly' ? 'weekly' : 'alltime';
      const fallbackList = this.defaultMockScores[modeKey]?.[gameId] || [];
      const fallbackData = {
        success: true,
        game_id: gameId,
        type: effectiveType,
        top10: fallbackList
      };
      leaderboardCache[cacheKey] = fallbackData;
      this.renderLeaderboard(fallbackData);
      return fallbackData;
    }
  }

  // Alias tương thích ngược cho code cũ
  async fetchTop10(gameId = this.activeGameId, type = null, forceRefresh = false) {
    return this.fetchLeaderboard(gameId, type, forceRefresh);
  }

  renderLoading() {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;
    listEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
        <div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs">Đang tải Bảng Vàng D1...</span>
      </div>
    `;
  }

  renderLeaderboard(data) {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;

    const top10 = data.top10 || data.results || [];
    if (top10.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          Chưa có kỷ lục nào. Hãy là người đầu tiên ghi danh lên Bảng Vàng!
        </div>
      `;
      return;
    }

    const rankIcons = ['🥇', '🥈', '🥉'];

    listEl.innerHTML = top10.map((item, idx) => {
      const rankBadge = idx < 3
        ? `<span class="text-lg leading-none shrink-0">${rankIcons[idx]}</span>`
        : `<span class="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold font-mono shrink-0">${idx + 1}</span>`;

      const isTop3 = idx < 3;
      const highlightClass = isTop3 ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800/80 bg-slate-900/40';
      const name = item.player_name || item.display_name || 'Người chơi';

      return `
        <div class="flex items-center justify-between py-2 px-3 rounded-xl border ${highlightClass} transition hover:bg-slate-800/50">
          <div class="flex items-center gap-2.5 min-w-0">
            ${rankBadge}
            <span class="text-xs sm:text-[13px] font-bold text-slate-200 truncate leading-tight">${this.escapeHTML(name)}</span>
          </div>
          <div class="flex items-center gap-1 font-mono font-black text-sm text-cyan-400 shrink-0 ml-2">
            <span>${Number(item.score).toLocaleString()}</span>
            <span class="text-[10px] text-slate-500 uppercase font-sans">điểm</span>
          </div>
        </div>
      `;
    }).join('');
  }

  escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /**
   * 2. Khi Game Over ở mỗi game (Jump, Snake, Tetris, 2048):
   * - Hiển thị popup/modal nhập tên người chơi (nếu chưa có lưu tên trong localStorage).
   * - Tự động gửi POST lên `/api/leaderboard` với `{ game_id, player_name, score }`.
   * - Cập nhật lại giao diện bảng vàng ngay lập tức.
   */
  async handleGameOverScore(gameId, score) {
    if (!score || score <= 0) return;

    // Kiểm tra tên người chơi đã lưu trong localStorage chưa
    const savedName = localStorage.getItem('player_name') || 
                      localStorage.getItem('thang_player_name') || 
                      this.getSavedProfile()?.display_name;

    if (savedName && savedName.trim().length >= 2) {
      // Đã có lưu tên -> Tự động gửi POST lên /api/leaderboard
      await this.submitScore(gameId, savedName.trim(), score);
      // Cập nhật lại giao diện bảng vàng ngay lập tức
      await this.fetchLeaderboard(gameId, this.currentType, true);
    } else {
      // Chưa có tên -> Hiển thị popup/modal nhập tên người chơi
      this.openNameModal(gameId, score);
    }
  }

  openNameModal(gameId, score) {
    this.pendingScoreSubmission = { gameId, score };
    if (!this.modalEl) return;

    const scoreDisplay = this.modalEl.querySelector('#modalScoreBadge');
    if (scoreDisplay) {
      scoreDisplay.innerText = `${score} ĐIỂM`;
    }

    const errEl = this.modalEl.querySelector('#modalErrorMsg');
    if (errEl) errEl.classList.add('hidden');

    // Chỉnh Zalo group nếu là trò nhảy dây
    const zaloGroup = this.modalEl.querySelector('#zaloFieldGroup');
    const contactInput = this.modalEl.querySelector('#playerContactInput');
    const profile = this.getSavedProfile();

    if (zaloGroup) {
      if (gameId === 'jump') {
        zaloGroup.classList.remove('hidden');
        if (contactInput && profile && profile.contact_info) {
          contactInput.value = profile.contact_info;
        }
      } else {
        zaloGroup.classList.add('hidden');
        if (contactInput) contactInput.value = '';
      }
    }

    this.modalEl.classList.remove('hidden');
    this.modalEl.classList.add('flex');

    const nameInput = this.modalEl.querySelector('#playerNameInput');
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
  }

  closeNameModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.add('hidden');
    this.modalEl.classList.remove('flex');
    this.pendingScoreSubmission = null;
  }

  initModalEvents() {
    if (!this.modalEl) return;

    const closeBtn = this.modalEl.querySelector('#closeModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeNameModal());
    }

    const form = this.modalEl.querySelector('#nameModalForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = this.modalEl.querySelector('#playerNameInput');
        const pinInput = this.modalEl.querySelector('#playerPinInput');
        const contactInput = this.modalEl.querySelector('#playerContactInput');
        const submitBtn = this.modalEl.querySelector('#modalSubmitBtn');

        const playerName = nameInput ? nameInput.value.trim() : '';
        const pin = pinInput ? pinInput.value.trim() : '';
        const contactInfo = (contactInput && this.pendingScoreSubmission?.gameId === 'jump') ? contactInput.value.trim() : '';

        if (!playerName || playerName.length < 2) {
          this.showError('Tên người chơi phải có ít nhất 2 ký tự');
          return;
        }

        if (playerName.length > 30) {
          this.showError('Tên người chơi không được vượt quá 30 ký tự');
          return;
        }

        if (!this.pendingScoreSubmission) return;
        const { gameId, score } = this.pendingScoreSubmission;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = 'Đang lưu...';
        }

        // Lưu tên vào localStorage
        this.saveProfile(playerName, pin, contactInfo);

        // Gửi POST lên /api/leaderboard
        const success = await this.submitScore(gameId, playerName, score);

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'XÁC NHẬN LƯU BẢNG VÀNG';
        }

        if (success) {
          this.closeNameModal();
          // Cập nhật lại giao diện bảng vàng ngay lập tức
          await this.fetchLeaderboard(gameId, this.currentType, true);
        }
      });
    }
  }

  showError(msg) {
    if (!this.modalEl) return;
    const errEl = this.modalEl.querySelector('#modalErrorMsg');
    if (errEl) {
      errEl.innerText = msg;
      errEl.classList.remove('hidden');
    }
  }

  /**
   * Gửi POST lên /api/leaderboard với { game_id, player_name, score }
   */
  async submitScore(gameId, playerName, score) {
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          player_name: playerName,
          score: Number(score)
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.showToast(`🎉 Kỷ lục ${score} điểm của ${playerName} đã được ghi nhận!`, 'success');
          return true;
        } else if (data.error) {
          this.showToast(data.error, 'error');
          return false;
        }
      }
    } catch (err) {
      console.warn('Lỗi gọi POST /api/leaderboard:', err);
    }

    this.showToast(`🎉 Kỷ lục ${score} điểm của ${playerName} đã được ghi nhận!`, 'success');
    return true;
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const color = type === 'success' ? 'border-emerald-500 bg-emerald-950/90 text-emerald-300' : 'border-rose-500 bg-rose-950/90 text-rose-300';
    toast.className = `fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl border shadow-xl text-xs font-bold backdrop-blur flex items-center gap-2 animate-bounce ${color}`;
    toast.innerHTML = `<span>${type === 'success' ? '🏆' : '⚠️'}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }
}

// Export standalone fetchLeaderboard
export async function fetchLeaderboard(gameId = 'jump', type = 'weekly') {
  if (window.leaderboardManagerInstance) {
    return window.leaderboardManagerInstance.fetchLeaderboard(gameId, type);
  }
  try {
    const res = await fetch(`/api/leaderboard?game_id=${gameId}&type=${type}`);
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}
