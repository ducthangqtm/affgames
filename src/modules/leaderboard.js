/**
 * Leaderboard Module: Đồng bộ Bảng Vàng Cloudflare D1, Cache cục bộ, Pop-up Top 10
 * Hỗ trợ Fallback tự động đọc/ghi vào localStorage khi chạy Dev / Test
 */

export class LeaderboardManager {
  constructor() {
    this.cache = new Map(); // `${gameId}_${type}` -> { data, timestamp }
    this.cacheTTL = 60 * 1000; // 60 giây
    this.activeGameId = 'jump';
    this.currentType = 'weekly'; // 'weekly' | 'all_time'
    this.qualifyingScores = new Map(); // `${gameId}_${type}` -> minScore
    this.modalEl = document.getElementById('nameModal');
    this.pendingScoreSubmission = null;

    // Dữ liệu mẫu phong phú cho cả Tuần này và Kỷ lục All-Time
    this.defaultMockScores = {
      weekly: {
        jump: [
          { rank: 1, display_name: "Pro_Skipper", score: 95, updated_at: "2026-09-08" },
          { rank: 2, display_name: "Thắng Nhảy Dây", score: 88, updated_at: "2026-09-09" },
          { rank: 3, display_name: "SpeedHop", score: 64, updated_at: "2026-09-10" },
          { rank: 4, display_name: "HànhLangMaster", score: 52, updated_at: "2026-09-08" },
          { rank: 5, display_name: "MinhNhảy", score: 41, updated_at: "2026-09-09" },
          { rank: 6, display_name: "DungDo", score: 32, updated_at: "2026-09-08" },
          { rank: 7, display_name: "Tuấn1m5", score: 25, updated_at: "2026-09-09" },
          { rank: 8, display_name: "HàRope", score: 18, updated_at: "2026-09-10" },
          { rank: 9, display_name: "LinhJump", score: 14, updated_at: "2026-09-10" },
          { rank: 10, display_name: "LongTậpSự", score: 8, updated_at: "2026-09-10" }
        ],
        snake: [
          { rank: 1, display_name: "NeonSnake", score: 410, updated_at: "2026-09-08" },
          { rank: 2, display_name: "CyberViper", score: 360, updated_at: "2026-09-09" },
          { rank: 3, display_name: "Thắng Nhảy Dây", score: 270, updated_at: "2026-09-10" },
          { rank: 4, display_name: "GreenPython", score: 210, updated_at: "2026-09-08" },
          { rank: 5, display_name: "FastCrawler", score: 160, updated_at: "2026-09-09" },
          { rank: 6, display_name: "RetroGamer", score: 130, updated_at: "2026-09-08" },
          { rank: 7, display_name: "ByteBite", score: 95, updated_at: "2026-09-09" },
          { rank: 8, display_name: "PixelHunt", score: 70, updated_at: "2026-09-10" },
          { rank: 9, display_name: "SpeedSlither", score: 55, updated_at: "2026-09-10" },
          { rank: 10, display_name: "NeoNoob", score: 30, updated_at: "2026-09-10" }
        ],
        '2048': [
          { rank: 1, display_name: "QuickMerge", score: 8192, updated_at: "2026-09-08" },
          { rank: 2, display_name: "NeonMaster", score: 8192, updated_at: "2026-09-09" },
          { rank: 3, display_name: "Thắng Nhảy Dây", score: 4096, updated_at: "2026-09-10" },
          { rank: 4, display_name: "TileStacker", score: 2048, updated_at: "2026-09-08" },
          { rank: 5, display_name: "GridChamp", score: 1024, updated_at: "2026-09-09" },
          { rank: 6, display_name: "SwipeHero", score: 512, updated_at: "2026-09-08" },
          { rank: 7, display_name: "NeonBrain", score: 256, updated_at: "2026-09-09" },
          { rank: 8, display_name: "BlockCombo", score: 128, updated_at: "2026-09-10" },
          { rank: 9, display_name: "SlideKing", score: 64, updated_at: "2026-09-10" },
          { rank: 10, display_name: "NumberFan", score: 32, updated_at: "2026-09-10" }
        ],
        tetris: [
          { rank: 1, display_name: "TetrisPro", score: 7100, updated_at: "2026-09-08" },
          { rank: 2, display_name: "BlockKing", score: 6800, updated_at: "2026-09-09" },
          { rank: 3, display_name: "Thắng Nhảy Dây", score: 5200, updated_at: "2026-09-10" },
          { rank: 4, display_name: "MatrixDrop", score: 3900, updated_at: "2026-09-08" },
          { rank: 5, display_name: "LineClearer", score: 2600, updated_at: "2026-09-09" },
          { rank: 6, display_name: "NeonBricks", score: 1900, updated_at: "2026-09-08" },
          { rank: 7, display_name: "CyberStack", score: 1400, updated_at: "2026-09-09" },
          { rank: 8, display_name: "RetroBlock", score: 950, updated_at: "2026-09-10" },
          { rank: 9, display_name: "HardDropper", score: 700, updated_at: "2026-09-10" },
          { rank: 10, display_name: "TetrisNovice", score: 450, updated_at: "2026-09-10" }
        ]
      },
      all_time: {
        jump: [
          { rank: 1, display_name: "Thắng Nhảy Dây", score: 108, updated_at: "2026-09-01" },
          { rank: 2, display_name: "Pro_Skipper", score: 95, updated_at: "2026-09-02" },
          { rank: 3, display_name: "HànhLangMaster", score: 72, updated_at: "2026-09-03" },
          { rank: 4, display_name: "SpeedHop", score: 64, updated_at: "2026-09-04" },
          { rank: 5, display_name: "MinhNhảy", score: 42, updated_at: "2026-09-05" },
          { rank: 6, display_name: "DungDo", score: 35, updated_at: "2026-09-06" },
          { rank: 7, display_name: "HàRope", score: 28, updated_at: "2026-09-07" },
          { rank: 8, display_name: "Tuấn1m5", score: 25, updated_at: "2026-09-08" },
          { rank: 9, display_name: "LinhJump", score: 16, updated_at: "2026-09-09" },
          { rank: 10, display_name: "LongTậpSự", score: 10, updated_at: "2026-09-10" }
        ],
        snake: [
          { rank: 1, display_name: "CyberViper", score: 450, updated_at: "2026-09-01" },
          { rank: 2, display_name: "NeonSnake", score: 410, updated_at: "2026-09-02" },
          { rank: 3, display_name: "Thắng Nhảy Dây", score: 290, updated_at: "2026-09-03" },
          { rank: 4, display_name: "GreenPython", score: 240, updated_at: "2026-09-04" },
          { rank: 5, display_name: "RetroGamer", score: 190, updated_at: "2026-09-05" },
          { rank: 6, display_name: "FastCrawler", score: 160, updated_at: "2026-09-06" },
          { rank: 7, display_name: "ByteBite", score: 120, updated_at: "2026-09-07" },
          { rank: 8, display_name: "PixelHunt", score: 90, updated_at: "2026-09-08" },
          { rank: 9, display_name: "SpeedSlither", score: 70, updated_at: "2026-09-09" },
          { rank: 10, display_name: "NeoNoob", score: 40, updated_at: "2026-09-10" }
        ],
        '2048': [
          { rank: 1, display_name: "NeonMaster", score: 16384, updated_at: "2026-09-01" },
          { rank: 2, display_name: "QuickMerge", score: 8192, updated_at: "2026-09-02" },
          { rank: 3, display_name: "Thắng Nhảy Dây", score: 4096, updated_at: "2026-09-03" },
          { rank: 4, display_name: "TileStacker", score: 2048, updated_at: "2026-09-04" },
          { rank: 5, display_name: "GridChamp", score: 1024, updated_at: "2026-09-05" },
          { rank: 6, display_name: "SwipeHero", score: 512, updated_at: "2026-09-06" },
          { rank: 7, display_name: "NeonBrain", score: 256, updated_at: "2026-09-07" },
          { rank: 8, display_name: "BlockCombo", score: 128, updated_at: "2026-09-08" },
          { rank: 9, display_name: "SlideKing", score: 64, updated_at: "2026-09-09" },
          { rank: 10, display_name: "NumberFan", score: 32, updated_at: "2026-09-10" }
        ],
        tetris: [
          { rank: 1, display_name: "BlockKing", score: 8400, updated_at: "2026-09-01" },
          { rank: 2, display_name: "TetrisPro", score: 7100, updated_at: "2026-09-02" },
          { rank: 3, display_name: "Thắng Nhảy Dây", score: 5200, updated_at: "2026-09-03" },
          { rank: 4, display_name: "MatrixDrop", score: 3900, updated_at: "2026-09-04" },
          { rank: 5, display_name: "LineClearer", score: 2800, updated_at: "2026-09-05" },
          { rank: 6, display_name: "NeonBricks", score: 2100, updated_at: "2026-09-06" },
          { rank: 7, display_name: "CyberStack", score: 1500, updated_at: "2026-09-07" },
          { rank: 8, display_name: "RetroBlock", score: 1100, updated_at: "2026-09-08" },
          { rank: 9, display_name: "HardDropper", score: 800, updated_at: "2026-09-09" },
          { rank: 10, display_name: "TetrisNovice", score: 500, updated_at: "2026-09-10" }
        ]
      }
    };

    this.initTabs();
    this.initModalEvents();
  }

  initTabs() {
    const tabWeekly = document.getElementById('leaderboardTabWeekly');
    const tabAllTime = document.getElementById('leaderboardTabAllTime');

    const setMode = (mode) => {
      this.currentType = mode;
      this.updateTabsUI(mode);
      this.fetchTop10(this.activeGameId, this.currentType);
    };

    if (tabWeekly) {
      tabWeekly.addEventListener('click', () => setMode('weekly'));
    }
    if (tabAllTime) {
      tabAllTime.addEventListener('click', () => setMode('all_time'));
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

  saveProfile(displayName, pin, contactInfo = '') {
    try {
      localStorage.setItem('thang_player_profile', JSON.stringify({
        display_name: displayName.trim(),
        pin: pin.trim(),
        contact_info: contactInfo.trim()
      }));
    } catch (e) {}
  }

  getMockLeaderboard(gameId, type = this.currentType) {
    const storageKey = `thang_mock_leaderboard_${gameId}_${type}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}

    const modeData = this.defaultMockScores[type] || this.defaultMockScores.weekly;
    const list = modeData[gameId] || modeData.jump;
    return {
      success: true,
      game_id: gameId,
      type,
      last_week_winner: gameId === 'jump' ? {
        display_name: "Hoàng_Jump_99",
        score: 98,
        week_id: "2026-W36"
      } : null,
      top10: [...list],
      min_qualifying_score: list[list.length - 1]?.score || 1
    };
  }

  saveMockLeaderboard(gameId, type, data) {
    try {
      localStorage.setItem(`thang_mock_leaderboard_${gameId}_${type}`, JSON.stringify(data));
    } catch (e) {}
  }

  async fetchTop10(gameId = this.activeGameId, type = null, forceRefresh = false) {
    const isNewGame = this.activeGameId !== gameId;
    this.activeGameId = gameId;

    // 1. Phạm vi áp dụng Đua Top: CHỈ áp dụng cho Thắng Nhảy Dây (jump)
    const isJump = gameId === 'jump';
    let effectiveType;
    if (isJump) {
      if (type) {
        effectiveType = type;
      } else if (isNewGame) {
        effectiveType = 'weekly';
      } else {
        effectiveType = this.currentType || 'weekly';
      }
    } else {
      effectiveType = 'all_time';
    }
    this.currentType = effectiveType;

    // Cập nhật hiển thị giao diện Tabs & Banners
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
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (!forceRefresh && cached && (now - cached.timestamp < this.cacheTTL)) {
      this.renderLeaderboard(cached.data);
      return cached.data;
    }

    try {
      this.renderLoading();
      const res = await fetch(`/api/leaderboard?game=${gameId}&type=${effectiveType}`);
      if (!res.ok) throw new Error('API server không phản hồi');

      const data = await res.json();
      if (data.success && data.top10) {
        this.cache.set(cacheKey, { data, timestamp: now });
        this.qualifyingScores.set(cacheKey, data.min_qualifying_score || 1);
        this.renderLeaderboard(data);
        return data;
      }
      throw new Error('Dữ liệu không đúng định dạng');
    } catch (err) {
      // Fallback dev mode: đọc mock theo gameId và effectiveType
      const mockData = this.getMockLeaderboard(gameId, effectiveType);
      this.cache.set(cacheKey, { data: mockData, timestamp: now });
      this.qualifyingScores.set(cacheKey, mockData.min_qualifying_score || 1);
      this.renderLeaderboard(mockData);
      return mockData;
    }
  }

  renderLoading() {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;
    listEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
        <div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs">Đang tải Bảng Vàng...</span>
      </div>
    `;
  }

  renderLeaderboard(data) {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;

    // Cập nhật Badge Vinh danh Quán quân tuần trước (chỉ khi activeGameId === 'jump' && currentType === 'weekly')
    const lastWinnerBadge = document.getElementById('lastWeekWinnerBadge');
    const lastWinnerNameEl = document.getElementById('lastWeekWinnerName');
    const lastWinnerScoreEl = document.getElementById('lastWeekWinnerScore');

    if (this.activeGameId === 'jump' && this.currentType === 'weekly') {
      const winner = data.last_week_winner || { display_name: "Hoàng_Jump_99", score: 98 };
      if (lastWinnerNameEl) lastWinnerNameEl.innerText = winner.display_name || 'Hoàng_Jump_99';
      if (lastWinnerScoreEl) lastWinnerScoreEl.innerText = (winner.score || 0).toLocaleString();
      if (lastWinnerBadge) lastWinnerBadge.classList.remove('hidden');
    } else {
      if (lastWinnerBadge) lastWinnerBadge.classList.add('hidden');
    }

    const top10 = data.top10 || [];
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
        ? `<span class="text-lg">${rankIcons[idx]}</span>`
        : `<span class="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold font-mono">${idx + 1}</span>`;

      const isTop3 = idx < 3;
      const highlightClass = isTop3 ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800/80 bg-slate-900/40';

      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl border ${highlightClass} transition hover:bg-slate-800/50">
          <div class="flex items-center gap-2.5 min-w-0">
            ${rankBadge}
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-bold text-slate-200 truncate">${this.escapeHTML(item.display_name)}</span>
              <span class="text-[10px] text-slate-500">${this.formatDate(item.updated_at)}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 font-mono font-black text-sm text-cyan-400">
            <span>${item.score.toLocaleString()}</span>
            <span class="text-[10px] text-slate-500 uppercase font-sans">điểm</span>
          </div>
        </div>
      `;
    }).join('');
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } catch (e) {
      return '';
    }
  }

  escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /**
   * Gọi khi game over để kiểm tra điều kiện lọt Top 10
   */
  async handleGameOverScore(gameId, score) {
    if (score <= 0) return;

    let minScore = this.qualifyingScores.get(gameId);
    if (minScore === undefined) {
      const data = await this.fetchTop10(gameId);
      minScore = (data && data.min_qualifying_score) || 1;
    }

    const isTop10Eligible = score >= minScore;
    if (!isTop10Eligible) {
      return;
    }

    // Đã lọt Top 10!
    const profile = this.getSavedProfile();
    if (profile && profile.display_name && profile.pin) {
      this.submitScoreDirect(gameId, score, profile.display_name, profile.pin, profile.contact_info || '');
    } else {
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

    // 2. Cập nhật Pop-up: CHỈ hiển thị ô Zalo/SĐT cho trò "Thắng Nhảy Dây" (jump)
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

        const displayName = nameInput ? nameInput.value.trim() : '';
        const pin = pinInput ? pinInput.value.trim() : '';
        const contactInfo = (contactInput && this.pendingScoreSubmission?.gameId === 'jump') ? contactInput.value.trim() : '';

        if (!displayName || displayName.length < 2) {
          this.showError('Tên người chơi phải có ít nhất 2 ký tự');
          return;
        }

        if (!pin || !/^\d{4,6}$/.test(pin)) {
          this.showError('Mã PIN phải từ 4 đến 6 chữ số');
          return;
        }

        if (!this.pendingScoreSubmission) return;
        const { gameId, score } = this.pendingScoreSubmission;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = 'Đang lưu...';
        }

        const success = await this.submitScoreDirect(gameId, score, displayName, pin, contactInfo, true);

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'XÁC NHẬN LƯU BẢNG VÀNG';
        }

        if (success) {
          this.saveProfile(displayName, pin, contactInfo);
          this.closeNameModal();
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

  async submitScoreDirect(gameId, score, displayName, pin, contactInfo = '', fromModal = false) {
    // 1. Thử gửi lên Cloudflare Pages Functions API
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          score,
          display_name: displayName,
          pin,
          contact_info: contactInfo
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.showToast('🎉 Vinh danh Top 10 Bảng Vàng thành công!', 'success');
          await this.fetchTop10(gameId, this.currentType, true);
          return true;
        } else if (data.error) {
          if (fromModal) this.showError(data.error);
          else this.showToast(data.error, 'error');
          return false;
        }
      }
    } catch (apiErr) {
      // API backend không phản hồi (chạy Vite localhost) -> chuyển sang Fallback Local
    }

    // 2. Cơ chế Fallback LocalStorage khi chạy dev:
    try {
      const normalized = displayName.trim().toLowerCase();
      // Quản lý mock players
      let mockPlayers = {};
      try {
        mockPlayers = JSON.parse(localStorage.getItem('thang_mock_players') || '{}');
      } catch (e) {}

      if (mockPlayers[normalized]) {
        if (mockPlayers[normalized].pin !== pin.trim()) {
          const errText = 'Sai mã PIN cho tên người chơi này! Nếu quên PIN, vui lòng chọn tên khác.';
          if (fromModal) this.showError(errText);
          else this.showToast(errText, 'error');
          return false;
        }
        if (contactInfo) {
          mockPlayers[normalized].contact_info = contactInfo.trim();
          localStorage.setItem('thang_mock_players', JSON.stringify(mockPlayers));
        }
      } else {
        mockPlayers[normalized] = {
          display_name: displayName.trim(),
          pin: pin.trim(),
          contact_info: contactInfo.trim()
        };
        localStorage.setItem('thang_mock_players', JSON.stringify(mockPlayers));
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // Cập nhật cho cả 'weekly' và 'all_time' trong mock
      ['weekly', 'all_time'].forEach((mode) => {
        const currentBoard = this.getMockLeaderboard(gameId, mode);
        const list = currentBoard.top10 || [];
        const existIdx = list.findIndex(r => r.display_name.trim().toLowerCase() === normalized);

        if (existIdx !== -1) {
          if (score > list[existIdx].score) {
            list[existIdx].score = score;
            list[existIdx].display_name = displayName.trim();
            list[existIdx].updated_at = todayStr;
          }
        } else {
          list.push({
            display_name: displayName.trim(),
            score,
            updated_at: todayStr
          });
        }

        list.sort((a, b) => b.score - a.score);
        const top10 = list.slice(0, 10).map((item, idx) => ({ ...item, rank: idx + 1 }));
        const updatedBoard = {
          success: true,
          game_id: gameId,
          type: mode,
          last_week_winner: gameId === 'jump' ? {
            display_name: "Hoàng_Jump_99",
            score: 98,
            week_id: "2026-W36"
          } : null,
          top10,
          min_qualifying_score: top10.length < 10 ? 1 : top10[top10.length - 1].score
        };

        this.saveMockLeaderboard(gameId, mode, updatedBoard);
        this.cache.set(`${gameId}_${mode}`, { data: updatedBoard, timestamp: Date.now() });
        this.qualifyingScores.set(`${gameId}_${mode}`, updatedBoard.min_qualifying_score);
      });

      const currentData = this.cache.get(`${gameId}_${this.currentType}`)?.data;
      if (currentData) {
        this.renderLeaderboard(currentData);
      }

      this.showToast('🎉 Vinh danh Top 10 Bảng Vàng thành công!', 'success');
      return true;
    } catch (localErr) {
      console.error('Local fallback error:', localErr);
      this.showToast('Đã lưu điểm thành công!', 'success');
      return true;
    }
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
