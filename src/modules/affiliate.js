import productsData from '../data/products.json';

export class AffiliateManager {
  constructor(containerElement, tabsContainerElement) {
    this.container = containerElement;
    this.tabsContainer = tabsContainerElement;

    // 1. LUÔN LUÔN ưu tiên import dữ liệu trực tiếp từ products.json làm Single Source of Truth
    this.applyData(productsData);

    // 2. Cơ chế so sánh phiên bản (version/hash) để xóa sạch localStorage cũ nếu file mới hơn
    const fileHash = this.computeHash(JSON.stringify(productsData));
    try {
      const cachedHash = localStorage.getItem('thang_products_data_hash');
      if (cachedHash !== fileHash) {
        localStorage.removeItem('thang_admin_products_data');
        localStorage.setItem('thang_products_data_hash', fileHash);
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra cache localStorage:', e);
    }

    this.activeCategory = 'all';
    this.init();

    // 3. Cơ chế fetch động kèm query timestamp chống Vite và trình duyệt đóng băng (freeze) cache
    this.fetchFreshData();

    // 4. Hỗ trợ Vite HMR (Hot Module Replacement): Tự cập nhật giao diện ngay khi file json thay đổi
    if (import.meta.hot) {
      import.meta.hot.accept('../data/products.json', (newModule) => {
        if (newModule && newModule.default) {
          this.applyData(newModule.default);
          this.renderTabs();
          this.renderProducts();
        }
      });
    }
  }

  applyData(raw) {
    if (!raw) return;
    const isObject = !Array.isArray(raw) && raw.products;
    this.products = isObject ? [...raw.products] : (Array.isArray(raw) ? [...raw] : []);
    this.categories = isObject && Array.isArray(raw.categories)
      ? [...raw.categories]
      : ['Dây nhảy', 'Đồ tập & Giày', 'Phụ kiện & Dinh dưỡng'];

    this.sortProducts();
  }

  computeHash(str) {
    if (!str) return '0';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }

  sortProducts() {
    this.products.sort((a, b) => {
      const orderA = (a.order !== undefined && a.order !== null && a.order !== '') ? Number(a.order) : 999999;
      const orderB = (b.order !== undefined && b.order !== null && b.order !== '') ? Number(b.order) : 999999;
      return orderA - orderB;
    });
  }

  init() {
    this.renderTabs();
    this.renderProducts();
  }

  fetchFreshData() {
    fetch('/src/data/products.json?v=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((freshData) => {
        if (!freshData) return;

        const freshHash = this.computeHash(JSON.stringify(freshData));
        const currentHash = localStorage.getItem('thang_products_data_hash');

        if (freshHash !== currentHash) {
          try {
            localStorage.removeItem('thang_admin_products_data');
            localStorage.setItem('thang_products_data_hash', freshHash);
          } catch (_) {}

          this.applyData(freshData);
          this.renderTabs();
          this.renderProducts();
        }
      })
      .catch((_) => {
        // Fallback im lặng nếu chạy static dist không mount raw /src/
      });
  }

  getCategories() {
    // Tuyệt đối KHÔNG tự động sinh lại danh mục từ các sản phẩm cũ nếu danh mục đã bị xóa khỏi mảng categories
    if (this.categories && Array.isArray(this.categories) && this.categories.length > 0) {
      return ['all', ...this.categories];
    }
    return ['all'];
  }

  renderTabs() {
    if (!this.tabsContainer) return;
    const categories = this.getCategories();

    this.tabsContainer.innerHTML = categories.map((cat) => {
      const isActive = cat === this.activeCategory;
      const label = cat === 'all' ? 'All' : cat;
      const activeClass = isActive ? 'active' : '';
      return `
        <button
          type="button"
          class="category-tab ${activeClass}"
          data-category="${this.escapeHTML(cat)}"
        >
          ${this.escapeHTML(label)}
        </button>
      `;
    }).join('');

    this.tabsContainer.querySelectorAll('.category-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.dataset.category;
        if (cat) {
          this.activeCategory = cat;
          this.renderTabs();
          this.renderProducts();
        }
      });
    });
  }

  renderProducts() {
    if (!this.container) return;

    // Đảm bảo sản phẩm được sắp xếp tăng dần theo trường order (số nhỏ hơn ưu tiên trước)
    const sorted = [...this.products].sort((a, b) => {
      const orderA = (a.order !== undefined && a.order !== null && a.order !== '') ? Number(a.order) : 999999;
      const orderB = (b.order !== undefined && b.order !== null && b.order !== '') ? Number(b.order) : 999999;
      return orderA - orderB;
    });

    const filtered = this.activeCategory === 'all'
      ? sorted
      : sorted.filter(p => p.category === this.activeCategory);

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div class="col-span-2 text-center py-8 text-slate-400 text-xs">
          Không có sản phẩm nào trong danh mục này.
        </div>
      `;
      return;
    }

    this.container.innerHTML = filtered.map((item) => {
      const shopeeUrl = (item.shopeeUrl || item.affiliate_url || '').trim();
      const tiktokUrl = (item.tiktokUrl || '').trim();

      const hasShopee = Boolean(shopeeUrl);
      const hasTiktok = Boolean(tiktokUrl);

      const shopeeBagSvg = `<svg class="w-3.5 h-3.5 fill-current text-white flex-shrink-0" viewBox="0 0 24 24"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H7c0 2.76 2.24 5 5 5s5-2.24 5-5h-2c0 1.66-1.34 3-3 3z"/></svg>`;
      const tiktokIconSvg = `<svg class="w-3.5 h-3.5 fill-current text-white flex-shrink-0" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298 0 .591.044.87.13V9.4a6.33 6.33 0 00-.87-.06A6.34 6.34 0 003 15.68a6.34 6.34 0 009.68 5.37V13.3a8.27 8.27 0 005.15 1.79v-3.45a4.84 4.84 0 01-1.74-.71 4.79 4.79 0 01-1.5-1.5v-.01z"/></svg>`;

      let buttonsMarkup = '';

      if (hasShopee && hasTiktok) {
        // CÓ CẢ SHOPEE & TIKTOK: Tự động chia đôi 1:1 (gap: 8px)
        buttonsMarkup = `
          <div class="btn-dual-container">
            <a
              href="${this.escapeHTML(shopeeUrl)}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-dual-shopee"
              title="Mua trên Shopee"
            >
              ${shopeeBagSvg}
              <span>SHOPEE</span>
            </a>
            <a
              href="${this.escapeHTML(tiktokUrl)}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-dual-tiktok"
              title="Mua trên TikTok Shop"
            >
              ${tiktokIconSvg}
              <span>TIKTOK</span>
            </a>
          </div>
        `;
      } else if (hasShopee) {
        // CHỈ CÓ SHOPEE: Giãn full 100% bề ngang thẻ
        buttonsMarkup = `
          <a
            href="${this.escapeHTML(shopeeUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-shopee-single"
            title="Mua trên Shopee"
          >
            ${shopeeBagSvg}
            <span>XEM GIÁ ƯU ĐÃI</span>
          </a>
        `;
      } else if (hasTiktok) {
        // CHỈ CÓ TIKTOK: Giãn full 100% bề ngang thẻ
        buttonsMarkup = `
          <a
            href="${this.escapeHTML(tiktokUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-tiktok-single"
            title="Mua trên TikTok Shop"
          >
            ${tiktokIconSvg}
            <span>XEM GIÁ ƯU ĐÃI</span>
          </a>
        `;
      } else {
        buttonsMarkup = `
          <div class="w-full text-center text-[11px] text-slate-500 italic py-2">
            Đang cập nhật link mua
          </div>
        `;
      }

      return `
        <div class="product-card">
          <img
            src="${item.image_url}"
            alt="${this.escapeHTML(item.name)}"
            class="product-image"
            style="width: 100%; display: block; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 16px 16px 0 0; margin: 0; padding: 0; border: none;"
            loading="lazy"
          />
          <div class="product-body" style="padding: 10px 12px 12px;">
            <h3 class="product-title" style="margin-bottom: 8px; font-size: 13px; line-height: 18px; height: 36px;" title="${this.escapeHTML(item.name)}">
              ${this.escapeHTML(item.name)}
            </h3>
            ${buttonsMarkup}
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
}
