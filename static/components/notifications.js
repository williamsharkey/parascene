class AppNotifications extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._isOpen = false;
    this.handleEscape = this.handleEscape.bind(this);
    this.handleOpenEvent = this.handleOpenEvent.bind(this);
    this.handleCloseEvent = this.handleCloseEvent.bind(this);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleEscape);
    document.removeEventListener('open-notifications', this.handleOpenEvent);
    document.removeEventListener('close-notifications', this.handleCloseEvent);
  }

  setupEventListeners() {
    document.addEventListener('keydown', this.handleEscape);
    document.addEventListener('open-notifications', this.handleOpenEvent);
    document.addEventListener('close-notifications', this.handleCloseEvent);

    const overlay = this.shadowRoot.querySelector('.notifications-overlay');
    const closeButton = this.shadowRoot.querySelector('.notifications-close');

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.close();
        }
      });
    }

    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.close();
      });
    }
  }

  handleOpenEvent() {
    this.open();
  }

  handleCloseEvent() {
    this.close();
  }

  handleEscape(e) {
    if (e.key === 'Escape' && this.isOpen()) {
      this.close();
    }
  }

  isOpen() {
    return this._isOpen;
  }

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    const overlay = this.shadowRoot.querySelector('.notifications-overlay');
    if (overlay) {
      overlay.classList.add('open');
      this.loadNotifications();
    }
    // Dispatch event to close profile if open
    document.dispatchEvent(new CustomEvent('close-profile'));
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    const overlay = this.shadowRoot.querySelector('.notifications-overlay');
    if (overlay) {
      overlay.classList.remove('open');
    }
  }

  async loadNotifications() {
    const content = this.shadowRoot.querySelector('.notifications-content');
    if (!content) return;

    content.innerHTML = '<p>Loading...</p>';

    try {
      // TODO: Replace with actual notifications API endpoint
      // const response = await fetch('/api/notifications');
      // if (!response.ok) {
      //   throw new Error('Failed to load notifications');
      // }
      // const notifications = await response.json();
      // this.displayNotifications(notifications);
      
      // Placeholder for now
      this.displayNotifications([]);
    } catch (error) {
      console.error('Error loading notifications:', error);
      content.innerHTML = '<p style="color: var(--text-muted);">Failed to load notifications.</p>';
    }
  }

  displayNotifications(notifications) {
    const content = this.shadowRoot.querySelector('.notifications-content');

    if (!notifications || notifications.length === 0) {
      content.innerHTML = '<p style="color: var(--text-muted);">No notifications.</p>';
      return;
    }

    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    content.innerHTML = notifications.map(notification => `
      <div class="notification-item">
        <div class="notification-content">
          <div class="notification-title">${escapeHtml(notification.title || 'Notification')}</div>
          <div class="notification-message">${escapeHtml(notification.message || '')}</div>
          <div class="notification-time">${escapeHtml(notification.time || '')}</div>
        </div>
      </div>
    `).join('');
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .notifications-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s, visibility 0.2s;
        }
        .notifications-overlay.open {
          opacity: 1;
          visibility: visible;
        }
        .notifications-modal {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: var(--shadow);
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          transform: scale(0.95);
          transition: transform 0.2s;
        }
        .notifications-overlay.open .notifications-modal {
          transform: scale(1);
        }
        .notifications-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid var(--border);
        }
        .notifications-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }
        .notifications-close {
          background: transparent;
          border: none;
          color: var(--text);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        .notifications-close:hover {
          background: var(--surface-strong);
        }
        .notifications-close-icon {
          width: 24px;
          height: 24px;
        }
        .notifications-body {
          padding: 20px;
        }
        .notifications-content {
          min-height: 100px;
        }
        .notification-item {
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .notification-item:last-child {
          border-bottom: none;
        }
        .notification-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text);
          margin-bottom: 4px;
        }
        .notification-message {
          font-size: 0.9rem;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .notification-time {
          font-size: 0.85rem;
          color: var(--text-muted);
        }
      </style>
      <div class="notifications-overlay">
        <div class="notifications-modal">
          <div class="notifications-header">
            <h2>Notifications</h2>
            <button class="notifications-close" aria-label="Close">
              <svg class="notifications-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="notifications-body">
            <div class="notifications-content">
              <p>Loading...</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('app-notifications', AppNotifications);
