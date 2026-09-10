import initialProducts from './data/products.json';

class AdminPortal {
  constructor() {
    this.editingId = null;
    this.githubConfig = this.loadConfig();

    this.currentTab = 'products';
    this.selectedWeekId = this.getISOWeekId();
    this.weeklyAwardsData = null;
    this.currentWinnerPinHash = '';
    this.currentWinnerName = '';

    // 1. Đọc dữ liệu ưu tiên: localStorage -> products.json
    this.loadInitialData();

    this.initElements();
    this.initEvents();
    this.initTabs();
    this.initWeeklyAwards();
    this.updateAuthUI();
    this.renderCategorySelect();
    this.renderProductList();
    this.resetForm();

    // 2. Fetch động trực tiếp file products.json với timestamp chống cache Vite
    this.fetchFreshProductsFile();

    // 3. Kéo dữ liệu mới nhất từ GitHub repo nếu đã có token
    if (this.githubConfig && this.githubConfig.pat) {
      this.syncFromGitHub();
    }
  }

  fetchFreshProductsFile() {
    fetch('/src/data/products.json?v=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && Array.isArray(data.categories)) {
          const freshHash = String(JSON.stringify(data).length);
          const cachedHash = localStorage.getItem('thang_products_data_hash');
          if (freshHash !== cachedHash) {
            localStorage.setItem('thang_products_data_hash', freshHash);
            this.categories = [...data.categories];
            this.products = Array.isArray(data.products) ? [...data.products] : [];
            this.normalizeAndSortProducts();
            this.saveLocalState();
            this.renderCategorySelect();
            this.renderCategoryList();
            this.renderProductList();
          }
        }
      })
      .catch(() => {});
  }

  loadInitialData() {
    let loadedFromLocal = false;
    try {
      const localRaw = localStorage.getItem('thang_admin_products_data');
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (parsed && Array.isArray(parsed.categories)) {
          this.categories = [...parsed.categories];
          this.products = Array.isArray(parsed.products) ? [...parsed.products] : [];
          loadedFromLocal = true;
        }
      }
    } catch (e) {}

    if (!loadedFromLocal) {
      const isObjectFormat = initialProducts && !Array.isArray(initialProducts) && initialProducts.products;
      if (isObjectFormat && Array.isArray(initialProducts.categories)) {
        this.categories = [...initialProducts.categories];
        this.products = [...initialProducts.products];
      } else if (Array.isArray(initialProducts)) {
        this.categories = ['Dây nhảy', 'Đồ tập & Giày', 'Phụ kiện & Dinh dưỡng'];
        this.products = [...initialProducts];
      } else {
        this.categories = ['Dây nhảy', 'Đồ tập & Giày', 'Phụ kiện & Dinh dưỡng'];
        this.products = [];
      }
      this.saveLocalState();
    }

    // Chuẩn hóa và sắp xếp mảng sản phẩm theo trường order
    this.normalizeAndSortProducts();
  }

  normalizeAndSortProducts() {
    if (!Array.isArray(this.products)) {
      this.products = [];
      return;
    }
    this.products.forEach((p, i) => {
      if (p.order === undefined || p.order === null || p.order === '') {
        p.order = i + 1;
      }
    });
    this.products.sort((a, b) => (Number(a.order) || 9999) - (Number(b.order) || 9999));
    this.products.forEach((p, i) => {
      p.order = i + 1;
    });
  }

  saveLocalState() {
    try {
      localStorage.setItem('thang_admin_products_data', JSON.stringify({
        categories: this.categories,
        products: this.products
      }));
    } catch (e) {
      console.error('Lỗi khi lưu localStorage:', e);
    }
  }

  async syncFromGitHub() {
    const { pat, owner, repo, branch } = this.githubConfig;
    if (!pat) return;

    const cleanToken = (pat || '').replace(/^(Bearer|token)\s+/i, '').trim();
    if (!cleanToken) return;

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/src/data/products.json?ref=${encodeURIComponent(branch || 'main')}&_t=${Date.now()}`, {
        headers: {
          'Authorization': `token ${cleanToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!res.ok) return;
      const fileData = await res.json();
      if (!fileData.content) return;

      const decodedJson = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
      const parsed = JSON.parse(decodedJson);

      if (parsed && Array.isArray(parsed.categories)) {
        this.categories = [...parsed.categories];
        this.products = Array.isArray(parsed.products) ? [...parsed.products] : [];
        this.normalizeAndSortProducts();
        this.saveLocalState();
        this.renderCategorySelect();
        this.renderCategoryList();
        this.renderProductList();
      }
    } catch (e) {
      console.warn('Không thể đồng bộ từ GitHub lúc khởi tạo:', e);
    }
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getISOWeekId(d = new Date()) {
    const vnDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const target = new Date(vnDate.valueOf());
    const dayNr = (vnDate.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
      target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
    }
    const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    const year = new Date(firstThursday).getUTCFullYear();
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
  }

  getWeekList() {
    const list = [];
    const now = new Date();
    const currentWeekId = this.getISOWeekId(now);
    list.push({ id: currentWeekId, label: `${currentWeekId} (Tuần này - Đang diễn ra)` });

    for (let i = 1; i <= 8; i++) {
      const pastDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const wid = this.getISOWeekId(pastDate);
      const label = i === 1 ? `${wid} (Tuần trước)` : wid;
      list.push({ id: wid, label });
    }
    return list;
  }

  initTabs() {
    const tabProducts = document.getElementById('adminTabProducts');
    const tabWeeklyAwards = document.getElementById('adminTabWeeklyAwards');
    const sectionProducts = document.getElementById('sectionProducts');
    const sectionWeeklyAwards = document.getElementById('sectionWeeklyAwards');

    const switchTab = (tab) => {
      this.currentTab = tab;
      if (tab === 'products') {
        if (tabProducts) {
          tabProducts.classList.add('active');
          tabProducts.classList.remove('text-slate-400');
        }
        if (tabWeeklyAwards) {
          tabWeeklyAwards.classList.remove('active');
          tabWeeklyAwards.classList.add('text-slate-400');
        }
        if (sectionProducts) sectionProducts.classList.remove('hidden');
        if (sectionWeeklyAwards) sectionWeeklyAwards.classList.add('hidden');
      } else {
        if (tabWeeklyAwards) {
          tabWeeklyAwards.classList.add('active');
          tabWeeklyAwards.classList.remove('text-slate-400');
        }
        if (tabProducts) {
          tabProducts.classList.remove('active');
          tabProducts.classList.add('text-slate-400');
        }
        if (sectionWeeklyAwards) sectionWeeklyAwards.classList.remove('hidden');
        if (sectionProducts) sectionProducts.classList.add('hidden');

        if (!this.weeklyAwardsData) {
          this.loadWeeklyAwards(this.selectedWeekId);
        }
      }
    };

    if (tabProducts) tabProducts.addEventListener('click', () => switchTab('products'));
    if (tabWeeklyAwards) tabWeeklyAwards.addEventListener('click', () => switchTab('weeklyAwards'));
  }

  initWeeklyAwards() {
    this.awardWeekSelect = document.getElementById('awardWeekSelect');
    this.refreshAwardsBtn = document.getElementById('refreshAwardsBtn');
    this.verifyPinInput = document.getElementById('verifyPinInput');
    this.verifyPinBtn = document.getElementById('verifyPinBtn');
    this.pinResultBox = document.getElementById('pinResultBox');
    this.copyContactBtn = document.getElementById('copyContactBtn');

    if (this.awardWeekSelect) {
      const weeks = this.getWeekList();
      this.awardWeekSelect.innerHTML = weeks.map(w => 
        `<option value="${w.id}">${w.label}</option>`
      ).join('');

      this.selectedWeekId = weeks[0].id;

      this.awardWeekSelect.addEventListener('change', (e) => {
        this.selectedWeekId = e.target.value;
        this.loadWeeklyAwards(this.selectedWeekId);
      });
    }

    if (this.refreshAwardsBtn) {
      this.refreshAwardsBtn.addEventListener('click', () => {
        this.loadWeeklyAwards(this.selectedWeekId);
      });
    }

    if (this.verifyPinBtn) {
      this.verifyPinBtn.addEventListener('click', () => {
        this.verifyPin();
      });
    }

    if (this.verifyPinInput) {
      this.verifyPinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.verifyPin();
        }
      });
    }

    if (this.copyContactBtn) {
      this.copyContactBtn.addEventListener('click', () => {
        const contactText = document.getElementById('winnerContactText')?.innerText.trim();
        if (contactText && contactText !== 'Chưa điền SĐT / Zalo') {
          navigator.clipboard.writeText(contactText).then(() => {
            const originalText = this.copyContactBtn.innerText;
            this.copyContactBtn.innerText = 'Đã chép!';
            setTimeout(() => this.copyContactBtn.innerText = originalText, 2000);
          });
        }
      });
    }
  }

  async hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async verifyPin() {
    if (!this.verifyPinInput || !this.pinResultBox) return;

    const pin = this.verifyPinInput.value.trim();
    if (!pin) {
      this.pinResultBox.innerHTML = `
        <div class="text-amber-400 font-bold flex items-center gap-2">
          <span>⚠️</span><span>Vui lòng nhập mã PIN từ 4 đến 6 số để kiểm tra.</span>
        </div>
      `;
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      this.pinResultBox.innerHTML = `
        <div class="text-rose-400 font-bold flex items-center gap-2">
          <span>⚠️</span><span>Mã PIN phải là dãy số gồm 4 đến 6 chữ số!</span>
        </div>
      `;
      return;
    }

    if (!this.currentWinnerPinHash) {
      this.pinResultBox.innerHTML = `
        <div class="text-slate-400 flex items-center gap-2">
          <span>ℹ️</span><span>Chưa có dữ liệu Quán quân tuần để đối soát.</span>
        </div>
      `;
      return;
    }

    const hashedInput = await this.hashPin(pin);

    if (hashedInput === this.currentWinnerPinHash) {
      this.pinResultBox.innerHTML = `
        <div class="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 space-y-1.5 animate-pulse">
          <div class="font-black flex items-center gap-2 text-sm text-emerald-400">
            <span class="text-lg">✅</span><span>KHỚP PIN - CHÍNH CHỦ!</span>
          </div>
          <p class="text-xs text-slate-200">
            Mã PIN <strong>${this.escapeHTML(pin)}</strong> trùng khớp chính xác 100% với mã bí mật do người chơi <strong>${this.escapeHTML(this.currentWinnerName)}</strong> cài đặt.
          </p>
          <div class="text-[11px] text-emerald-300 font-bold pt-1 border-t border-emerald-500/30">
            👉 Đủ điều kiện nhận quà tặng: 01 Dây nhảy PVC Thắng Nhảy Dây!
          </div>
        </div>
      `;
    } else {
      this.pinResultBox.innerHTML = `
        <div class="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 space-y-1.5">
          <div class="font-black flex items-center gap-2 text-sm text-rose-400">
            <span class="text-lg">❌</span><span>SAI MÃ PIN!</span>
          </div>
          <p class="text-xs text-slate-200">
            Mã PIN <strong>${this.escapeHTML(pin)}</strong> không khớp với dữ liệu đăng ký của người chơi <strong>${this.escapeHTML(this.currentWinnerName)}</strong>.
          </p>
          <div class="text-[11px] text-rose-400 pt-1 border-t border-rose-500/30">
            ⚠️ Vui lòng yêu cầu người nhận kiểm tra lại mã PIN bí mật đã cài đặt.
          </div>
        </div>
      `;
    }
  }

  async loadWeeklyAwards(weekId) {
    const badgeEl = document.getElementById('awardWeekBadge');
    if (badgeEl) badgeEl.innerText = weekId;

    try {
      const res = await fetch(`/api/leaderboard?game=jump&type=admin_weekly&week_id=${weekId}`);
      if (!res.ok) throw new Error('API server không phản hồi');
      const data = await res.json();
      if (data.success && data.top10) {
        this.weeklyAwardsData = data;
        this.renderWeeklyAwards(data);
        return;
      }
      throw new Error('Dữ liệu không đúng định dạng');
    } catch (err) {
      // Fallback dev mode: Lấy từ LocalStorage hoặc mock
      const mockWeeklyHash = await this.hashPin('1234');
      const mockData = {
        success: true,
        game_id: 'jump',
        type: 'admin_weekly',
        week_id: weekId,
        top10: [
          { rank: 1, display_name: "Pro_Skipper", score: 95, contact_info: "0912345678", pin_hash: mockWeeklyHash, updated_at: "2026-09-08" },
          { rank: 2, display_name: "Thắng Nhảy Dây", score: 88, contact_info: "0988776655", pin_hash: mockWeeklyHash, updated_at: "2026-09-09" },
          { rank: 3, display_name: "SpeedHop", score: 64, contact_info: "0901234567", pin_hash: mockWeeklyHash, updated_at: "2026-09-10" },
          { rank: 4, display_name: "HànhLangMaster", score: 52, contact_info: "", pin_hash: mockWeeklyHash, updated_at: "2026-09-08" },
          { rank: 5, display_name: "MinhNhảy", score: 41, contact_info: "0934567890", pin_hash: mockWeeklyHash, updated_at: "2026-09-09" },
          { rank: 6, display_name: "DungDo", score: 32, contact_info: "", pin_hash: mockWeeklyHash, updated_at: "2026-09-08" },
          { rank: 7, display_name: "Tuấn1m5", score: 25, contact_info: "0965432109", pin_hash: mockWeeklyHash, updated_at: "2026-09-09" },
          { rank: 8, display_name: "HàRope", score: 18, contact_info: "", pin_hash: mockWeeklyHash, updated_at: "2026-09-10" },
          { rank: 9, display_name: "LinhJump", score: 14, contact_info: "0977889900", pin_hash: mockWeeklyHash, updated_at: "2026-09-10" },
          { rank: 10, display_name: "LongTậpSự", score: 8, contact_info: "", pin_hash: mockWeeklyHash, updated_at: "2026-09-10" }
        ]
      };
      this.weeklyAwardsData = mockData;
      this.renderWeeklyAwards(mockData);
    }
  }

  renderWeeklyAwards(data) {
    const top10 = data.top10 || [];
    const winner = top10[0] || null;

    const winnerNameEl = document.getElementById('winnerDisplayName');
    const winnerScoreEl = document.getElementById('winnerScore');
    const winnerContactEl = document.getElementById('winnerContactText');
    const zaloChatLink = document.getElementById('zaloChatLink');
    const copyContactBtn = document.getElementById('copyContactBtn');
    const countBadge = document.getElementById('awardsCountBadge');
    const tableBody = document.getElementById('awardLeaderboardBody');

    if (countBadge) countBadge.innerText = `${top10.length} người chơi`;

    if (winner) {
      this.currentWinnerName = winner.display_name;
      this.currentWinnerPinHash = winner.pin_hash || '';

      if (winnerNameEl) winnerNameEl.innerText = winner.display_name;
      if (winnerScoreEl) winnerScoreEl.innerText = winner.score.toLocaleString();

      if (winnerContactEl) {
        if (winner.contact_info) {
          winnerContactEl.innerText = winner.contact_info;
          winnerContactEl.className = 'text-sm font-mono font-bold text-emerald-400 truncate';
          if (zaloChatLink) {
            zaloChatLink.href = `https://zalo.me/${winner.contact_info.replace(/[^0-9]/g, '')}`;
            zaloChatLink.classList.remove('hidden');
          }
          if (copyContactBtn) copyContactBtn.classList.remove('hidden');
        } else {
          winnerContactEl.innerText = 'Chưa điền SĐT / Zalo';
          winnerContactEl.className = 'text-sm font-mono text-slate-500 italic';
          if (zaloChatLink) zaloChatLink.classList.add('hidden');
          if (copyContactBtn) copyContactBtn.classList.add('hidden');
        }
      }
    } else {
      this.currentWinnerName = '';
      this.currentWinnerPinHash = '';
      if (winnerNameEl) winnerNameEl.innerText = 'Chưa có người chơi';
      if (winnerScoreEl) winnerScoreEl.innerText = '0';
      if (winnerContactEl) winnerContactEl.innerText = '---';
      if (zaloChatLink) zaloChatLink.classList.add('hidden');
      if (copyContactBtn) copyContactBtn.classList.add('hidden');
    }

    // Reset PIN verification input & box
    if (this.verifyPinInput) this.verifyPinInput.value = '';
    if (this.pinResultBox) {
      this.pinResultBox.innerHTML = `
        <span class="text-slate-400 flex items-center gap-1.5">
          <span>ℹ️</span><span>Chưa nhập mã PIN để đối soát.</span>
        </span>
      `;
    }

    // Render Table Body
    if (!tableBody) return;
    if (top10.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-500">
            Chưa có người chơi nào ghi điểm trong tuần ${this.escapeHTML(data.week_id)}.
          </td>
        </tr>
      `;
      return;
    }

    const rankIcons = ['🥇', '🥈', '🥉'];

    tableBody.innerHTML = top10.map((item, idx) => {
      const isTop1 = idx === 0;
      const rankBadge = idx < 3
        ? `<span class="text-base">${rankIcons[idx]}</span>`
        : `<span class="w-5 h-5 rounded-full bg-slate-800 text-slate-400 font-mono text-xs flex items-center justify-center">${idx + 1}</span>`;

      const contactDisplay = item.contact_info
        ? `<div class="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
             <span>📱</span><span>${this.escapeHTML(item.contact_info)}</span>
             <a href="https://zalo.me/${item.contact_info.replace(/[^0-9]/g, '')}" target="_blank" class="text-[10px] text-blue-400 hover:underline">Zalo↗</a>
           </div>`
        : `<span class="text-slate-500 italic text-[11px]">Chưa cung cấp</span>`;

      const shortPinHash = item.pin_hash
        ? `<span class="font-mono text-[11px] text-slate-400 cursor-help" title="${item.pin_hash}">${item.pin_hash.slice(0, 8)}...${item.pin_hash.slice(-6)}</span>`
        : `<span class="text-slate-600 text-[11px]">---</span>`;

      return `
        <tr class="hover:bg-slate-800/40 transition ${isTop1 ? 'bg-amber-500/5 font-semibold' : ''}">
          <td class="py-3 px-3">${rankBadge}</td>
          <td class="py-3 px-3">
            <span class="text-slate-200 ${isTop1 ? 'text-amber-300 font-bold' : ''}">${this.escapeHTML(item.display_name)}</span>
          </td>
          <td class="py-3 px-3 font-mono font-bold text-cyan-400">${item.score.toLocaleString()}</td>
          <td class="py-3 px-3">${contactDisplay}</td>
          <td class="py-3 px-3">${shortPinHash}</td>
          <td class="py-3 px-3 text-slate-400 text-[11px]">${this.escapeHTML(item.updated_at || '')}</td>
          <td class="py-3 px-3 text-right">
            <button class="select-candidate-btn px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[11px] font-bold transition" data-hash="${this.escapeHTML(item.pin_hash || '')}" data-name="${this.escapeHTML(item.display_name)}">
              Đối soát PIN
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tableBody.querySelectorAll('.select-candidate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentWinnerPinHash = btn.dataset.hash;
        this.currentWinnerName = btn.dataset.name;
        if (this.verifyPinInput) {
          this.verifyPinInput.focus();
          this.verifyPinInput.scrollIntoView({ behavior: 'smooth' });
        }
        if (this.pinResultBox) {
          this.pinResultBox.innerHTML = `
            <div class="text-cyan-400 text-xs font-bold flex items-center gap-1.5">
              <span>🎯</span><span>Đang đối soát cho người chơi: <u>${this.escapeHTML(this.currentWinnerName)}</u>. Nhập mã PIN và nhấn 'Đối Soát'.</span>
            </div>
          `;
        }
      });
    });
  }


  loadConfig() {
    try {
      const localData = localStorage.getItem('thang_admin_gh_config');
      if (localData) {
        const parsed = JSON.parse(localData);
        return {
          pat: parsed.pat || '',
          owner: 'ducthangqtm',
          repo: 'affgames',
          branch: 'main'
        };
      }

      const sessionData = sessionStorage.getItem('thang_admin_gh_config');
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        return {
          pat: parsed.pat || '',
          owner: 'ducthangqtm',
          repo: 'affgames',
          branch: 'main'
        };
      }

      return {
        pat: '',
        owner: 'ducthangqtm',
        repo: 'affgames',
        branch: 'main'
      };
    } catch (e) {
      return { pat: '', owner: 'ducthangqtm', repo: 'affgames', branch: 'main' };
    }
  }

  saveConfig(cfg) {
    this.githubConfig = { ...this.githubConfig, ...cfg, owner: 'ducthangqtm', repo: 'affgames', branch: 'main' };
    localStorage.setItem('thang_admin_gh_config', JSON.stringify(this.githubConfig));
    sessionStorage.setItem('thang_admin_gh_config', JSON.stringify(this.githubConfig));
    this.updateAuthUI();
  }

  initElements() {
    // Auth Screen elements
    this.adminAuthScreen = document.getElementById('adminAuthScreen');
    this.adminMainLayout = document.getElementById('adminMainLayout');
    this.loginForm = document.getElementById('loginForm');
    this.loginPatInput = document.getElementById('loginPatInput');
    this.toggleLoginPatBtn = document.getElementById('toggleLoginPatBtn');
    this.loginErrorAlert = document.getElementById('loginErrorAlert');
    this.loginErrorText = document.getElementById('loginErrorText');
    this.loginSubmitBtn = document.getElementById('loginSubmitBtn');
    this.authStatusEl = document.getElementById('authStatus');
    this.logoutBtn = document.getElementById('logoutBtn');

    // Category Manager Modal elements
    this.categoryModal = document.getElementById('categoryModal');
    this.openCategoryMgrBtn = document.getElementById('openCategoryMgrBtn');
    this.closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');
    this.addCategoryForm = document.getElementById('addCategoryForm');
    this.newCategoryInput = document.getElementById('newCategoryInput');
    this.categoryListContainer = document.getElementById('categoryListContainer');

    // Product Form elements
    this.productForm = document.getElementById('productForm');
    this.formTitle = document.getElementById('formTitle');
    this.nameInput = document.getElementById('prodName');
    this.categoryInput = document.getElementById('prodCategory');
    this.shopeeInput = document.getElementById('prodShopeeUrl') || document.getElementById('prodAffiliate');
    this.tiktokInput = document.getElementById('prodTiktokUrl');
    this.orderInput = document.getElementById('prodOrder');
    this.imageInput = document.getElementById('prodImage');
    this.imagePreview = document.getElementById('imagePreview');
    this.imagePlaceholder = document.getElementById('imagePlaceholder');
    this.imageErrorNotice = document.getElementById('imageErrorNotice');
    this.cancelEditBtn = document.getElementById('cancelEditBtn');

    // Product List & Commit elements
    this.productList = document.getElementById('productList');
    this.commitBtn = document.getElementById('commitBtn');
    this.commitStatus = document.getElementById('commitStatus');
  }

  updateImagePreview(url) {
    if (!this.imagePreview) return;

    if (!url) {
      this.imagePreview.src = '';
      this.imagePreview.classList.add('hidden');
      if (this.imageErrorNotice) this.imageErrorNotice.classList.add('hidden');
      if (this.imagePlaceholder) this.imagePlaceholder.classList.remove('hidden');
      return;
    }

    // Khi đã dán link ảnh: Ẩn placeholder và thông báo lỗi
    if (this.imagePlaceholder) this.imagePlaceholder.classList.add('hidden');
    if (this.imageErrorNotice) this.imageErrorNotice.classList.add('hidden');

    this.imagePreview.onload = () => {
      this.imagePreview.classList.remove('hidden');
      if (this.imagePlaceholder) this.imagePlaceholder.classList.add('hidden');
      if (this.imageErrorNotice) this.imageErrorNotice.classList.add('hidden');
    };

    this.imagePreview.onerror = () => {
      this.imagePreview.classList.add('hidden');
      if (this.imagePlaceholder) this.imagePlaceholder.classList.add('hidden');
      if (this.imageErrorNotice) this.imageErrorNotice.classList.remove('hidden');
    };

    this.imagePreview.src = url;
  }

  initEvents() {
    // Live Image Preview tức thì với xử lý lỗi ảnh onerror và ẩn/hiện placeholder
    if (this.imageInput) {
      this.imageInput.addEventListener('input', (e) => {
        this.updateImagePreview(e.target.value.trim());
      });
    }

    // Form Submit (Thêm / Sửa sản phẩm)
    if (this.productForm) {
      this.productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleProductSubmit();
      });
    }

    // Cancel Edit
    if (this.cancelEditBtn) {
      this.cancelEditBtn.addEventListener('click', () => {
        this.resetForm();
      });
    }

    // Toggle Eye PAT on Auth Screen
    if (this.toggleLoginPatBtn && this.loginPatInput) {
      this.toggleLoginPatBtn.addEventListener('click', () => {
        const isPass = this.loginPatInput.type === 'password';
        this.loginPatInput.type = isPass ? 'text' : 'password';
        this.toggleLoginPatBtn.innerText = isPass ? '🙈' : '👁️';
      });
    }

    // Auth Screen Submit (Chỉ cần 1 ô nhập duy nhất, tự động ghi nhớ phiên)
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawPat = this.loginPatInput.value.trim();
        const pat = rawPat.replace(/^(Bearer|token)\s+/i, '').trim();
        const owner = 'ducthangqtm';
        const repo = 'affgames';
        const branch = 'main';

        if (!pat) {
          if (this.loginErrorAlert) {
            this.loginErrorText.innerText = 'Vui lòng nhập mật khẩu';
            this.loginErrorAlert.classList.remove('hidden');
          }
          return;
        }

        // Loading state
        if (this.loginSubmitBtn) {
          this.loginSubmitBtn.disabled = true;
          this.loginSubmitBtn.innerHTML = '<span>⏳</span><span>ĐANG XÁC THỰC...</span>';
        }
        if (this.loginErrorAlert) {
          this.loginErrorAlert.classList.add('hidden');
        }

        try {
          // 1. Kiểm tra token với GitHub User API (xác thực ngầm)
          let userRes;
          try {
            userRes = await fetch('https://api.github.com/user', {
              headers: {
                'Authorization': `token ${pat}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            });
          } catch (netErr) {
            throw new Error(`Không thể kết nối tới GitHub: ${netErr.message}`);
          }

          if (!userRes.ok) {
            throw new Error('Mật khẩu không chính xác hoặc đã hết hạn');
          }

          // 2. Kiểm tra quyền truy cập repository (ngầm)
          let repoRes;
          try {
            repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
              headers: {
                'Authorization': `token ${pat}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            });
          } catch (netErr) {
            throw new Error(`Không thể kết nối tới repository: ${netErr.message}`);
          }

          if (!repoRes.ok && repoRes.status === 404) {
            throw new Error('Mật khẩu không có quyền truy cập hệ thống');
          }

          // Xác thực thành công: Tự động ghi nhớ phiên vào cả localStorage và sessionStorage
          const cfg = { pat, owner, repo, branch };
          this.githubConfig = cfg;
          localStorage.setItem('thang_admin_gh_config', JSON.stringify(cfg));
          sessionStorage.setItem('thang_admin_gh_config', JSON.stringify(cfg));

          this.updateAuthUI();
          this.syncFromGitHub();

          if (this.currentTab === 'weeklyAwards' || this.selectedWeekId) {
            this.loadWeeklyAwards(this.selectedWeekId);
          }
        } catch (err) {
          if (this.loginErrorAlert) {
            this.loginErrorText.innerText = err.message || 'Mật khẩu không chính xác';
            this.loginErrorAlert.classList.remove('hidden');
          }
        } finally {
          if (this.loginSubmitBtn) {
            this.loginSubmitBtn.disabled = false;
            this.loginSubmitBtn.innerHTML = '<span>🔓</span><span>ĐĂNG NHẬP</span>';
          }
        }
      });
    }

    // Modal Quản Lý Danh Mục (Mở / Đóng / Thêm)
    if (this.openCategoryMgrBtn) {
      this.openCategoryMgrBtn.addEventListener('click', () => {
        this.renderCategoryList();
        if (this.categoryModal) {
          this.categoryModal.classList.remove('hidden');
          this.categoryModal.classList.add('flex');
        }
      });
    }

    if (this.closeCategoryModalBtn) {
      this.closeCategoryModalBtn.addEventListener('click', () => {
        if (this.categoryModal) {
          this.categoryModal.classList.add('hidden');
          this.categoryModal.classList.remove('flex');
        }
      });
    }

    if (this.addCategoryForm) {
      this.addCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newCat = this.newCategoryInput.value.trim();
        if (!newCat) return;

        if (this.categories.some(c => c.toLowerCase() === newCat.toLowerCase())) {
          alert('Danh mục này đã tồn tại!');
          return;
        }

        this.categories.push(newCat);
        this.newCategoryInput.value = '';
        this.saveLocalState();
        this.renderCategorySelect(newCat);
        this.renderCategoryList();

        // Tự động ghi đè lên GitHub nếu đã kết nối
        if (this.githubConfig && this.githubConfig.pat) {
          this.commitToGit(true);
        }
      });
    }

    // Đăng xuất
    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('thang_admin_gh_config');
        sessionStorage.removeItem('thang_admin_gh_config');
        this.githubConfig = { pat: '', owner: 'ducthangqtm', repo: 'affgames', branch: 'main' };
        if (this.loginPatInput) this.loginPatInput.value = '';
        if (this.loginErrorAlert) this.loginErrorAlert.classList.add('hidden');
        this.updateAuthUI();
      });
    }

    // Commit lên Git qua GitHub REST API
    if (this.commitBtn) {
      this.commitBtn.addEventListener('click', () => {
        this.commitToGit(false);
      });
    }
  }

  renderCategorySelect(selectedValue = null) {
    if (!this.categoryInput) return;
    const currentVal = selectedValue || this.categoryInput.value || this.categories[0];
    this.categoryInput.innerHTML = this.categories.map(cat => `
      <option value="${this.escapeHTML(cat)}" ${cat === currentVal ? 'selected' : ''}>
        ${this.escapeHTML(cat)}
      </option>
    `).join('');
  }

  renderCategoryList() {
    if (!this.categoryListContainer) return;
    if (!this.categories || this.categories.length === 0) {
      this.categoryListContainer.innerHTML = '<div class="text-xs text-slate-500 py-3 text-center">Chưa có danh mục nào.</div>';
      return;
    }

    this.categoryListContainer.innerHTML = this.categories.map((cat, idx) => {
      const count = this.products.filter(p => p.category === cat).length;
      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-200">${this.escapeHTML(cat)}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 font-mono">${count} sản phẩm</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" class="rename-cat-btn px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold transition flex items-center gap-1" data-idx="${idx}" title="Đổi tên danh mục">
              <span>✏️</span><span>Đổi tên</span>
            </button>
            <button type="button" class="delete-cat-btn px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold transition flex items-center gap-1" data-idx="${idx}" title="Xóa danh mục">
              <span>🗑️</span><span>Xóa</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Event Đổi tên danh mục
    this.categoryListContainer.querySelectorAll('.rename-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const oldName = this.categories[idx];
        const newName = prompt(`Nhập tên mới cho danh mục "${oldName}":`, oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
          const trimmed = newName.trim();
          if (this.categories.some((c, i) => i !== idx && c.toLowerCase() === trimmed.toLowerCase())) {
            alert('Tên danh mục này đã tồn tại!');
            return;
          }
          this.categories[idx] = trimmed;
          // Đồng bộ các sản phẩm đang gắn danh mục cũ
          this.products.forEach(p => {
            if (p.category === oldName) {
              p.category = trimmed;
            }
          });
          this.saveLocalState();
          this.renderCategorySelect(trimmed);
          this.renderCategoryList();
          this.renderProductList();

          // Tự động ghi đè lên GitHub nếu đã kết nối
          if (this.githubConfig && this.githubConfig.pat) {
            this.commitToGit(true);
          }
        }
      });
    });

    // Event Xóa danh mục
    this.categoryListContainer.querySelectorAll('.delete-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const catName = this.categories[idx];
        if (this.categories.length <= 1) {
          alert('Bạn phải giữ lại ít nhất 1 danh mục trong hệ thống!');
          return;
        }

        // Tìm danh mục fallback: danh mục đầu tiên còn lại
        const remainingCategories = this.categories.filter((c, i) => i !== idx);
        const fallbackCat = remainingCategories[0] || 'Khác';

        const affectedProds = this.products.filter(p => p.category === catName);
        let confirmMsg = `Bạn có chắc chắn muốn xóa danh mục "${catName}"?`;
        if (affectedProds.length > 0) {
          confirmMsg = `Danh mục "${catName}" đang có ${affectedProds.length} sản phẩm.\nNếu xóa, các sản phẩm này sẽ tự động chuyển sang danh mục "${fallbackCat}". Bạn có chắc chắn muốn xóa?`;
        }
        if (!confirm(confirmMsg)) return;

        // 1. Chuyển sản phẩm sang danh mục fallback
        affectedProds.forEach(p => {
          p.category = fallbackCat;
        });

        // 2. Xóa hẳn danh mục khỏi mảng categories
        this.categories.splice(idx, 1);

        // 3. Cập nhật state & lưu ngay vào localStorage
        this.saveLocalState();
        this.renderCategorySelect();
        this.renderCategoryList();
        this.renderProductList();

        // 4. Tự động ghi đè toàn bộ object { categories, products } lên GitHub repo qua PUT
        if (this.githubConfig && this.githubConfig.pat) {
          this.commitToGit(true);
        }
      });
    });
  }

  updateAuthUI() {
    const isAuthed = Boolean(this.githubConfig.pat);

    // Chuyển đổi giữa Auth Screen và Giao diện Quản Trị
    if (this.adminAuthScreen && this.adminMainLayout) {
      if (isAuthed) {
        this.adminAuthScreen.classList.add('hidden');
        this.adminMainLayout.classList.remove('hidden');
      } else {
        this.adminMainLayout.classList.add('hidden');
        this.adminAuthScreen.classList.remove('hidden');
      }
    }

    if (this.authStatusEl) {
      if (isAuthed) {
        this.authStatusEl.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Đã kết nối GitHub (${this.escapeHTML(this.githubConfig.owner)}/${this.escapeHTML(this.githubConfig.repo)})
          </span>
        `;
        if (this.logoutBtn) this.logoutBtn.classList.remove('hidden');
      } else {
        this.authStatusEl.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            Chưa kết nối GitHub PAT
          </span>
        `;
        if (this.logoutBtn) this.logoutBtn.classList.add('hidden');
      }
    }
  }

  handleProductSubmit() {
    const name = this.nameInput.value.trim();
    const category = this.categoryInput.value.trim();
    const shopeeUrl = this.shopeeInput ? this.shopeeInput.value.trim() : '';
    const tiktokUrl = this.tiktokInput ? this.tiktokInput.value.trim() : '';
    const image_url = this.imageInput.value.trim();
    const rawOrder = this.orderInput ? this.orderInput.value.trim() : '';
    const parsedOrder = rawOrder ? parseInt(rawOrder, 10) : null;

    if (!name || !category || (!shopeeUrl && !tiktokUrl) || !image_url) {
      alert('Vui lòng điền tên, danh mục, link ảnh và ít nhất 1 link mua hàng (Shopee hoặc TikTok Shop)!');
      return;
    }

    if (this.editingId) {
      // Cập nhật
      const index = this.products.findIndex(p => p.id === this.editingId);
      if (index !== -1) {
        const order = (parsedOrder && parsedOrder > 0) ? parsedOrder : (this.products[index].order || (index + 1));
        this.products[index] = {
          ...this.products[index],
          name,
          category,
          order,
          shopeeUrl,
          tiktokUrl,
          affiliate_url: shopeeUrl || tiktokUrl,
          image_url
        };
      }
    } else {
      // Thêm mới
      const order = (parsedOrder && parsedOrder > 0) ? parsedOrder : (this.products.length + 1);
      const newProduct = {
        id: 'prod-' + Date.now(),
        name,
        category,
        order,
        shopeeUrl,
        tiktokUrl,
        affiliate_url: shopeeUrl || tiktokUrl,
        image_url,
        price: 'Giá tốt'
      };
      this.products.push(newProduct);
    }

    // Sắp xếp lại mảng theo thứ tự order và đánh số lại chuẩn 1, 2, 3...
    this.normalizeAndSortProducts();

    this.saveLocalState();
    this.resetForm();
    this.renderProductList();
  }

  resetForm() {
    this.editingId = null;
    this.formTitle.innerText = 'Thêm Sản Phẩm Mới';
    this.productForm.reset();
    if (this.shopeeInput) this.shopeeInput.value = '';
    if (this.tiktokInput) this.tiktokInput.value = '';
    if (this.orderInput) this.orderInput.value = (this.products.length + 1).toString();
    this.updateImagePreview('');
    this.cancelEditBtn.classList.add('hidden');
  }

  editProduct(id) {
    const item = this.products.find(p => p.id === id);
    if (!item) return;

    this.editingId = id;
    this.formTitle.innerText = 'Chỉnh Sửa Sản Phẩm';
    this.nameInput.value = item.name;
    this.renderCategorySelect(item.category);
    this.categoryInput.value = item.category;
    if (this.shopeeInput) this.shopeeInput.value = item.shopeeUrl || item.affiliate_url || '';
    if (this.tiktokInput) this.tiktokInput.value = item.tiktokUrl || '';
    if (this.orderInput) {
      const idx = this.products.findIndex(p => p.id === id);
      this.orderInput.value = item.order || (idx + 1);
    }
    this.imageInput.value = item.image_url;

    this.updateImagePreview(item.image_url);

    this.cancelEditBtn.classList.remove('hidden');
    this.productForm.scrollIntoView({ behavior: 'smooth' });
  }

  deleteProduct(id) {
    if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
      this.products = this.products.filter(p => p.id !== id);
      this.products.forEach((p, i) => { p.order = i + 1; });
      if (this.editingId === id) this.resetForm();
      this.saveLocalState();
      this.renderProductList();
      this.renderCategoryList();
    }
  }

  moveProduct(fromIndex, direction) {
    const targetIndex = fromIndex + direction;
    if (targetIndex < 0 || targetIndex >= this.products.length) return;

    // Đổi chỗ 2 sản phẩm trong mảng
    const temp = this.products[fromIndex];
    this.products[fromIndex] = this.products[targetIndex];
    this.products[targetIndex] = temp;

    // Cập nhật lại thuộc tính order
    this.products.forEach((p, i) => {
      p.order = i + 1;
    });

    this.saveLocalState();
    this.renderProductList();

    if (this.editingId) {
      this.resetForm();
    }
  }

  renderProductList() {
    if (!this.productList) return;

    if (this.products.length === 0) {
      this.productList.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-sm">
          Chưa có sản phẩm nào. Hãy dùng form bên trên để thêm sản phẩm đầu tiên.
        </div>
      `;
      return;
    }

    this.productList.innerHTML = this.products.map((item, idx) => {
      const shopeeLink = item.shopeeUrl || item.affiliate_url || '';
      const tiktokLink = item.tiktokUrl || '';
      const displayOrder = item.order || (idx + 1);
      const isFirst = idx === 0;
      const isLast = idx === this.products.length - 1;

      return `
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 gap-3 hover:border-slate-700 transition">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-7 h-7 rounded-lg bg-slate-800/90 border border-slate-700/80 text-amber-400 font-mono text-xs font-black flex items-center justify-center flex-shrink-0" title="Thứ tự hiển thị: ${displayOrder}">
              #${displayOrder}
            </span>
            <img src="${item.image_url}" alt="" class="w-12 h-12 rounded-lg object-contain bg-slate-950 flex-shrink-0" />
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-medium text-slate-200 truncate">${this.escapeHTML(item.name)}</span>
              <div class="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
                <span class="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-semibold">${this.escapeHTML(item.category)}</span>
                ${shopeeLink ? `<a href="${this.escapeHTML(shopeeLink)}" target="_blank" class="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-bold hover:underline">Shopee ↗</a>` : ''}
                ${tiktokLink ? `<a href="${this.escapeHTML(tiktokLink)}" target="_blank" class="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-bold hover:underline">TikTok ↗</a>` : ''}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button
              class="move-up-btn p-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition disabled:opacity-20 disabled:pointer-events-none"
              data-index="${idx}"
              title="Đẩy lên trên"
              ${isFirst ? 'disabled' : ''}
            >
              ⬆️
            </button>
            <button
              class="move-down-btn p-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition disabled:opacity-20 disabled:pointer-events-none"
              data-index="${idx}"
              title="Đẩy xuống dưới"
              ${isLast ? 'disabled' : ''}
            >
              ⬇️
            </button>
            <button class="edit-btn p-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition" data-id="${item.id}" title="Sửa">
              ✏️
            </button>
            <button class="del-btn p-1.5 px-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition" data-id="${item.id}" title="Xóa">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.productList.querySelectorAll('.move-up-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.moveProduct(idx, -1);
      });
    });

    this.productList.querySelectorAll('.move-down-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.moveProduct(idx, 1);
      });
    });

    this.productList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.editProduct(btn.dataset.id);
      });
    });

    this.productList.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.deleteProduct(btn.dataset.id);
      });
    });
  }

  escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  async commitToGit(isAuto = false) {
    const rawToken = (this.githubConfig.pat || '').trim();
    const cleanToken = rawToken.replace(/^(Bearer|token)\s+/i, '').trim();
    const owner = (this.githubConfig.owner || 'ducthangqtm').trim();
    const repo = (this.githubConfig.repo || 'affgames').trim();
    const branch = (this.githubConfig.branch || 'main').trim();

    if (!cleanToken) {
      if (!isAuto) {
        alert('Vui lòng đăng nhập bằng Mật mã Quản trị trước khi commit!');
        if (this.adminMainLayout && this.adminAuthScreen) {
          this.adminMainLayout.classList.add('hidden');
          this.adminAuthScreen.classList.remove('hidden');
        }
      }
      return;
    }

    const filePath = 'src/data/products.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    if (this.commitBtn && !isAuto) {
      this.commitBtn.disabled = true;
      this.commitBtn.innerText = 'Đang đồng bộ lên GitHub...';
    }
    if (this.commitStatus) {
      this.commitStatus.innerHTML = `<span class="text-cyan-400 animate-pulse text-xs">${isAuto ? 'Đang tự động đồng bộ danh mục lên GitHub...' : 'Đang liên hệ GitHub API...'}</span>`;
    }

    try {
      // 1. LUÔN LUÔN lấy mã SHA mới nhất trực tiếp từ GitHub với timestamp chống cache
      let latestSha = null;
      const getUrl = `${apiUrl}?ref=${encodeURIComponent(branch)}&_t=${Date.now()}`;
      let getRes;
      try {
        getRes = await fetch(getUrl, {
          method: 'GET',
          headers: {
            'Authorization': `token ${cleanToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
      } catch (netErr) {
        throw new Error(`Không thể kết nối đến GitHub API (Lỗi mạng hoặc CORS): ${netErr.message}`);
      }

      if (getRes.ok) {
        const fileData = await getRes.json();
        latestSha = fileData.sha;
      } else if (getRes.status === 404) {
        // File chưa tồn tại trên nhánh này
        latestSha = null;
      } else {
        let errMsg = `HTTP ${getRes.status} (${getRes.statusText})`;
        try {
          const errData = await getRes.json();
          if (errData.message) errMsg = `${errData.message} (HTTP ${getRes.status})`;
        } catch (_) {}
        throw new Error(`Không thể lấy SHA file từ GitHub: ${errMsg}`);
      }

      // 2. Mã hóa Base64 hỗ trợ tiếng Việt chuẩn hóa UTF-8
      const payload = {
        categories: this.categories,
        products: this.products
      };
      const jsonString = JSON.stringify(payload, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

      // 3. Gửi kèm mã sha mới nhất vừa lấy được vào body của request PUT
      const putBody = {
        message: 'Update products and categories via Admin Portal',
        content: base64Content,
        branch: branch
      };
      if (latestSha) {
        putBody.sha = latestSha;
      }

      let putRes;
      try {
        putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${cleanToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify(putBody)
        });
      } catch (netErr) {
        throw new Error(`Không thể gửi dữ liệu lên GitHub (Lỗi mạng hoặc CORS): ${netErr.message}`);
      }

      if (!putRes.ok) {
        let errMsg = `HTTP ${putRes.status} (${putRes.statusText})`;
        try {
          const errData = await putRes.json();
          if (errData.message) {
            errMsg = `${errData.message} (HTTP ${putRes.status})`;
            if (errData.errors && Array.isArray(errData.errors)) {
              errMsg += ` - ${errData.errors.map(e => e.message || JSON.stringify(e)).join(', ')}`;
            }
          }
        } catch (_) {}
        throw new Error(`GitHub từ chối lưu thay đổi: ${errMsg}`);
      }

      const putData = await putRes.json();

      if (this.commitStatus) {
        this.commitStatus.innerHTML = `
          <div class="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
            <span>🚀</span>
            <span>Đã đồng bộ lên GitHub thành công! Cloudflare Pages sẽ tự động cập nhật.</span>
          </div>
        `;
      }
    } catch (err) {
      console.error('Chi tiết lỗi commit:', err);
      let displayMsg = err.message || 'Lỗi không xác định khi đồng bộ';
      if (displayMsg.includes('Failed to fetch')) {
        displayMsg = 'Không thể kết nối tới GitHub API (Failed to fetch). Vui lòng kiểm tra lại kết nối mạng hoặc kiểm tra xem tiện ích chặn quảng cáo / VPN có đang chặn api.github.com hay không.';
      }
      if (this.commitStatus) {
        this.commitStatus.innerHTML = `
          <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>${this.escapeHTML(displayMsg)}</span>
          </div>
        `;
      }
    } finally {
      if (this.commitBtn && !isAuto) {
        this.commitBtn.disabled = false;
        this.commitBtn.innerText = '🚀 CẬP NHẬT LÊN GIT (CLOUDFLARE BUILD)';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminPortal();
});
