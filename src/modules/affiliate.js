import productsData from '../data/products.json';

export class AffiliateManager {
  constructor(containerElement, tabsContainerElement) {
    this.container = containerElement;
    this.tabsContainer = tabsContainerElement;
    this.products = productsData || [];
    this.activeCategory = 'all';

    this.init();
  }

  init() {
    this.renderTabs();
    this.renderProducts();
  }

  getCategories() {
    const cats = new Set(['all']);
    this.products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }

  renderTabs() {
    if (!this.tabsContainer) return;
    const categories = this.getCategories();
    const categoryLabels = {
      all: 'Tất cả',
      'Dây nhảy': 'Dây nhảy',
      'Đồ tập & Giày': 'Đồ tập & Giày',
      'Phụ kiện & Dinh dưỡng': 'Phụ kiện'
    };

    this.tabsContainer.innerHTML = categories.map((cat) => {
      const isActive = cat === this.activeCategory;
      const activeClass = isActive
        ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 font-medium';
      return `
        <button
          class="category-tab px-3.5 py-1.5 rounded-full text-xs transition whitespace-nowrap ${activeClass}"
          data-category="${cat}"
        >
          ${categoryLabels[cat] || cat}
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

    const filtered = this.activeCategory === 'all'
      ? this.products
      : this.products.filter(p => p.category === this.activeCategory);

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div class="col-span-2 text-center py-8 text-slate-400 text-xs">
          Không có sản phẩm nào trong danh mục này.
        </div>
      `;
      return;
    }

    this.container.innerHTML = filtered.map((item) => {
      return `
        <div class="product-card group flex flex-col justify-between bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 hover:border-cyan-500/40 rounded-2xl overflow-hidden p-3 transition duration-200 shadow-lg">
          <div>
            <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-950 mb-2.5">
              <img
                src="${item.image_url}"
                alt="${this.escapeHTML(item.name)}"
                class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                loading="lazy"
              />
              <span class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur border border-slate-700/60 text-[10px] text-cyan-400 font-semibold">
                ${this.escapeHTML(item.category)}
              </span>
            </div>
            <h3 class="text-xs font-bold text-slate-200 line-clamp-2 mb-1 group-hover:text-cyan-300 transition" title="${this.escapeHTML(item.name)}">
              ${this.escapeHTML(item.name)}
            </h3>
          </div>

          <div class="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span class="font-mono text-xs font-black text-amber-400">${item.price || 'Giá tốt'}</span>
            <a
              href="${item.affiliate_url}"
              target="_blank"
              rel="noopener noreferrer"
              class="px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/30 text-[11px] font-bold transition flex items-center gap-1"
            >
              <span>Shopee</span>
              <span>↗</span>
            </a>
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
