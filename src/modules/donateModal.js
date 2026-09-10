export class DonateModalManager {
  constructor(modalElement, triggerButton) {
    this.modal = modalElement;
    this.triggerBtn = triggerButton;

    this.init();
  }

  init() {
    if (this.triggerBtn && this.modal) {
      this.triggerBtn.addEventListener('click', () => this.open());
    }

    if (this.modal) {
      const closeBtn = this.modal.querySelector('#closeDonateBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }

      const dismissBtn = this.modal.querySelector('#dismissDonateBtn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => this.close());
      }

      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
          this.close();
        }
      });

      // Nút copy số tài khoản
      const copyBtn = this.modal.querySelector('#copyBankBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const accNo = copyBtn.dataset.accountNo || '0987654321';
          navigator.clipboard.writeText(accNo).then(() => {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span>✅</span><span>Đã chép!</span>';
            this.showToast('Đã chép số tài khoản!');
            setTimeout(() => {
              copyBtn.innerHTML = originalText;
            }, 2000);
          }).catch(() => {
            this.showToast('Đã chép số tài khoản: ' + accNo);
          });
        });
      }
    }
  }

  showToast(message) {
    const existing = document.getElementById('donateToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'donateToast';
    toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl border border-emerald-500/80 bg-emerald-950/95 text-emerald-300 shadow-2xl text-xs font-bold backdrop-blur flex items-center gap-2 animate-bounce';
    toast.innerHTML = `<span>📋</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 2500);
  }

  open() {
    if (!this.modal) return;
    this.modal.classList.remove('hidden');
    this.modal.classList.add('flex');
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.add('hidden');
    this.modal.classList.remove('flex');
  }
}

