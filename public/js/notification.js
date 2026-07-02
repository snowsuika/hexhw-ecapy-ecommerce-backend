const Notification = {
  _timeout: null,

  show(message, type = 'info') {
    const el = document.getElementById('notification-toast');
    if (!el) return;

    const colors = {
      success: 'bg-bg-elevated text-accent-gold-light border-accent-gold',
      error: 'bg-bg-elevated text-accent-rose-light border-accent-rose-light',
      warning: 'bg-bg-elevated text-accent-gold-muted border-accent-gold',
      info: 'bg-bg-elevated text-text-secondary border-border-gold'
    };

    el.className = 'fixed top-24 right-4 z-[100] px-5 py-3 text-sm border shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-all duration-300 ' + (colors[type] || colors.info);
    el.textContent = message;
    el.style.display = 'block';
    el.style.opacity = '1';

    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; }, 300);
    }, 3000);
  }
};
