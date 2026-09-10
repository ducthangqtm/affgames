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

      // Nút duy nhất: "📥 Lưu Mã QR Vào Máy"
      const saveQrBtn = this.modal.querySelector('#saveQrBtn');
      if (saveQrBtn) {
        saveQrBtn.addEventListener('click', (e) => {
          e.preventDefault();
          try {
            const qrImg = this.modal.querySelector('#qrDonateImg');
            const imgSrc = (qrImg && qrImg.src) ? qrImg.src : '/assets/qr-donate.jpg';
            const link = document.createElement('a');
            link.href = imgSrc;
            link.download = 'QR-ThangNhayDay.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (err) {
            console.error('Lỗi tải mã QR:', err);
          }
          this.showToast('Đã lưu mã QR! Bạn có thể quét qua MoMo hoặc App Ngân Hàng ❤️', 'success');
        });
      }
    }
  }

  showToast(message, type = 'info') {
    const existing = document.getElementById('donateToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'donateToast';
    toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl border border-emerald-500/80 bg-slate-900/95 text-emerald-300 shadow-2xl text-xs font-bold backdrop-blur flex items-center gap-2 animate-bounce';
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3000);
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

