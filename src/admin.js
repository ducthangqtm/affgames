import initialProducts from './data/products.json';

class AdminPortal {
  constructor() {
    this.products = [...initialProducts];
    this.editingId = null;
    this.githubConfig = this.loadConfig();

    this.currentTab = 'products';
    this.selectedWeekId = this.getISOWeekId();
    this.weeklyAwardsData = null;
    this.currentWinnerPinHash = '';
    this.currentWinnerName = '';

    this.initElements();
    this.initEvents();
    this.initTabs();
    this.initWeeklyAwards();
    this.updateAuthUI();
    this.renderProductList();
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
      const data = sessionStorage.getItem('thang_admin_gh_config');
      return data ? JSON.parse(data) : {
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
    this.githubConfig = { ...this.githubConfig, ...cfg };
    sessionStorage.setItem('thang_admin_gh_config', JSON.stringify(this.githubConfig));
    this.updateAuthUI();
  }

  initElements() {
    // Auth elements
    this.authModal = document.getElementById('authModal');
    this.authForm = document.getElementById('authForm');
    this.patInput = document.getElementById('patInput');
    this.ownerInput = document.getElementById('ownerInput');
    this.repoInput = document.getElementById('repoInput');
    this.branchInput = document.getElementById('branchInput');
    this.authStatusEl = document.getElementById('authStatus');
    this.openAuthBtn = document.getElementById('openAuthBtn');
    this.logoutBtn = document.getElementById('logoutBtn');

    // Product Form elements
    this.productForm = document.getElementById('productForm');
    this.formTitle = document.getElementById('formTitle');
    this.nameInput = document.getElementById('prodName');
    this.categoryInput = document.getElementById('prodCategory');
    this.affiliateInput = document.getElementById('prodAffiliate');
    this.imageInput = document.getElementById('prodImage');
    this.imagePreview = document.getElementById('imagePreview');
    this.cancelEditBtn = document.getElementById('cancelEditBtn');

    // Product List & Commit elements
    this.productList = document.getElementById('productList');
    this.commitBtn = document.getElementById('commitBtn');
    this.commitStatus = document.getElementById('commitStatus');
  }

  initEvents() {
    // Live Image Preview tức thì
    if (this.imageInput) {
      this.imageInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
          this.imagePreview.src = url;
          this.imagePreview.classList.remove('hidden');
        } else {
          this.imagePreview.classList.add('hidden');
        }
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

    // Auth Form
    if (this.authForm) {
      this.authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pat = this.patInput.value.trim();
        const owner = this.ownerInput.value.trim();
        const repo = this.repoInput.value.trim();
        const branch = this.branchInput.value.trim() || 'main';

        if (!pat) {
          alert('Vui lòng nhập GitHub Personal Access Token (PAT)');
          return;
        }

        this.saveConfig({ pat, owner, repo, branch });
        this.authModal.classList.add('hidden');
        this.authModal.classList.remove('flex');
        alert('Đã lưu thông tin xác thực GitHub vào session.');
      });
    }

    if (this.openAuthBtn) {
      this.openAuthBtn.addEventListener('click', () => {
        this.patInput.value = this.githubConfig.pat || '';
        this.ownerInput.value = this.githubConfig.owner || '';
        this.repoInput.value = this.githubConfig.repo || '';
        this.branchInput.value = this.githubConfig.branch || 'main';
        this.authModal.classList.remove('hidden');
        this.authModal.classList.add('flex');
      });
    }

    const closeAuthBtn = document.getElementById('closeAuthBtn');
    if (closeAuthBtn) {
      closeAuthBtn.addEventListener('click', () => {
        this.authModal.classList.add('hidden');
        this.authModal.classList.remove('flex');
      });
    }

    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('thang_admin_gh_config');
        this.githubConfig = { pat: '', owner: '', repo: '', branch: 'main' };
        this.updateAuthUI();
      });
    }

    // Commit lên Git qua GitHub REST API
    if (this.commitBtn) {
      this.commitBtn.addEventListener('click', () => {
        this.commitToGit();
      });
    }
  }

  updateAuthUI() {
    const isAuthed = Boolean(this.githubConfig.pat);
    if (this.authStatusEl) {
      if (isAuthed) {
        this.authStatusEl.innerHTML = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Đã kết nối GitHub (${this.githubConfig.owner}/${this.githubConfig.repo})
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
    const affiliate_url = this.affiliateInput.value.trim();
    const image_url = this.imageInput.value.trim();

    if (!name || !category || !affiliate_url || !image_url) {
      alert('Vui lòng điền đủ cả 4 trường thông tin sản phẩm!');
      return;
    }

    if (this.editingId) {
      // Cập nhật
      const index = this.products.findIndex(p => p.id === this.editingId);
      if (index !== -1) {
        this.products[index] = {
          ...this.products[index],
          name,
          category,
          affiliate_url,
          image_url
        };
      }
    } else {
      // Thêm mới
      const newProduct = {
        id: 'prod-' + Date.now(),
        name,
        category,
        affiliate_url,
        image_url,
        price: 'Giá tốt'
      };
      this.products.unshift(newProduct);
    }

    this.resetForm();
    this.renderProductList();
  }

  resetForm() {
    this.editingId = null;
    this.formTitle.innerText = 'Thêm Sản Phẩm Mới';
    this.productForm.reset();
    this.imagePreview.src = '';
    this.imagePreview.classList.add('hidden');
    this.cancelEditBtn.classList.add('hidden');
  }

  editProduct(id) {
    const item = this.products.find(p => p.id === id);
    if (!item) return;

    this.editingId = id;
    this.formTitle.innerText = 'Chỉnh Sửa Sản Phẩm';
    this.nameInput.value = item.name;
    this.categoryInput.value = item.category;
    this.affiliateInput.value = item.affiliate_url;
    this.imageInput.value = item.image_url;

    if (item.image_url) {
      this.imagePreview.src = item.image_url;
      this.imagePreview.classList.remove('hidden');
    }

    this.cancelEditBtn.classList.remove('hidden');
    this.productForm.scrollIntoView({ behavior: 'smooth' });
  }

  deleteProduct(id) {
    if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
      this.products = this.products.filter(p => p.id !== id);
      if (this.editingId === id) this.resetForm();
      this.renderProductList();
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
      return `
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 gap-3 hover:border-slate-700 transition">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${item.image_url}" alt="" class="w-12 h-12 rounded-lg object-cover bg-slate-950 flex-shrink-0" />
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-bold text-slate-200 truncate">${this.escapeHTML(item.name)}</span>
              <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                <span class="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-semibold">${this.escapeHTML(item.category)}</span>
                <a href="${item.affiliate_url}" target="_blank" class="text-orange-400 hover:underline">Link Shopee ↗</a>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button class="edit-btn p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition" data-id="${item.id}" title="Sửa">
              ✏️
            </button>
            <button class="del-btn p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition" data-id="${item.id}" title="Xóa">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.productList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this.editProduct(btn.dataset.id));
    });

    this.productList.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteProduct(btn.dataset.id));
    });
  }

  escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  async commitToGit() {
    const { pat, owner, repo, branch } = this.githubConfig;

    if (!pat || !owner || !repo) {
      alert('Vui lòng kết nối GitHub PAT và cấu hình Owner/Repo trước khi commit!');
      this.openAuthBtn.click();
      return;
    }

    const filePath = 'src/data/products.json';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    this.commitBtn.disabled = true;
    this.commitBtn.innerText = 'Đang đồng bộ lên GitHub...';
    this.commitStatus.innerHTML = '<span class="text-cyan-400 animate-pulse">Đang liên hệ GitHub API...</span>';

    try {
      // 1. Lấy SHA hiện tại của file
      let currentSha = null;
      const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getRes.ok) {
        const fileData = await getRes.json();
        currentSha = fileData.sha;
      }

      // 2. Mã hóa UTF-8 sang Base64 an toàn
      const jsonString = JSON.stringify(this.products, null, 2);
      const utf8Bytes = new TextEncoder().encode(jsonString);
      let binaryStr = '';
      utf8Bytes.forEach(b => binaryStr += String.fromCharCode(b));
      const base64Content = btoa(binaryStr);

      // 3. PUT file lên GitHub
      const putBody = {
        message: 'chore(affiliate): cập nhật danh sách sản phẩm qua Admin portal',
        content: base64Content,
        branch: branch || 'main'
      };
      if (currentSha) {
        putBody.sha = currentSha;
      }

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(putBody)
      });

      const putData = await putRes.json();

      if (!putRes.ok) {
        throw new Error(putData.message || 'Lỗi khi commit lên GitHub');
      }

      this.commitStatus.innerHTML = `
        <div class="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <span>🚀</span>
          <span>Commit thành công! Cloudflare Pages sẽ tự động kích hoạt bản build mới.</span>
        </div>
      `;
    } catch (err) {
      console.error(err);
      this.commitStatus.innerHTML = `
        <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
          <span>⚠️</span>
          <span>${err.message || 'Lỗi không xác định'}</span>
        </div>
      `;
    } finally {
      this.commitBtn.disabled = false;
      this.commitBtn.innerText = '🚀 CẬP NHẬT LÊN GIT (CLOUDFLARE BUILD)';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminPortal();
});
