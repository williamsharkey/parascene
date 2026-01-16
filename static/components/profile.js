class AppProfile extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.handleHashChange = this.handleHashChange.bind(this);
    this.handleEscape = this.handleEscape.bind(this);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.handleHashChange();
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.handleHashChange);
    document.removeEventListener('keydown', this.handleEscape);
  }

  setupEventListeners() {
    window.addEventListener('hashchange', this.handleHashChange);
    document.addEventListener('keydown', this.handleEscape);

    const overlay = this.shadowRoot.querySelector('.profile-overlay');
    const closeButton = this.shadowRoot.querySelector('.profile-close');

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

  handleHashChange() {
    if (window.location.hash === '#profile') {
      this.open();
    } else {
      this.close();
    }
  }

  handleEscape(e) {
    if (e.key === 'Escape' && this.isOpen()) {
      this.close();
    }
  }

  isOpen() {
    const overlay = this.shadowRoot.querySelector('.profile-overlay');
    return overlay && overlay.classList.contains('open');
  }

  open() {
    const overlay = this.shadowRoot.querySelector('.profile-overlay');
    if (overlay) {
      overlay.classList.add('open');
      this.loadProfile();
    }
  }

  close() {
    const overlay = this.shadowRoot.querySelector('.profile-overlay');
    if (overlay) {
      overlay.classList.remove('open');
    }
    if (window.location.hash === '#profile') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  async loadProfile() {
    const content = this.shadowRoot.querySelector('.profile-content');
    if (!content) return;

    content.innerHTML = '<p>Loading...</p>';

    try {
      const response = await fetch('/api/profile');
      if (!response.ok) {
        if (response.status === 401) {
          content.innerHTML = '<p style="color: var(--text-muted);">Please log in to view your profile.</p>';
          return;
        }
        throw new Error('Failed to load profile');
      }

      const user = await response.json();
      this.displayProfile(user);
    } catch (error) {
      console.error('Error loading profile:', error);
      content.innerHTML = '<p style="color: var(--text-muted);">Failed to load profile information.</p>';
    }
  }

  displayProfile(user) {
    const content = this.shadowRoot.querySelector('.profile-content');

    const roleLabels = {
      consumer: 'Consumer',
      creator: 'Creator',
      provider: 'Provider',
      admin: 'Administrator'
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    content.innerHTML = `
      <div class="field">
        <label>Email</label>
        <div class="value">${escapeHtml(user.email)}</div>
      </div>
      <div class="field">
        <label>Role</label>
        <div class="value">${escapeHtml(roleLabels[user.role] || user.role)}</div>
      </div>
      <div class="field">
        <label>Member Since</label>
        <div class="value">${formatDate(user.created_at)}</div>
      </div>
    `;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .profile-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s, visibility 0.2s;
        }
        .profile-overlay.open {
          opacity: 1;
          visibility: visible;
        }
        .profile-modal {
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
        .profile-overlay.open .profile-modal {
          transform: scale(1);
        }
        .profile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid var(--border);
        }
        .profile-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }
        .profile-close {
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
        .profile-close:hover {
          background: var(--surface-strong);
        }
        .profile-close-icon {
          width: 24px;
          height: 24px;
        }
        .profile-body {
          padding: 20px;
        }
        .field {
          margin: 12px 0;
        }
        .field:first-child {
          margin-top: 0;
        }
        .field:last-child {
          margin-bottom: 0;
        }
        .field label,
        .field .label {
          display: block;
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .field .value {
          font-size: 1rem;
          color: var(--text);
        }
      </style>
      <div class="profile-overlay">
        <div class="profile-modal">
          <div class="profile-header">
            <h2>Profile</h2>
            <button class="profile-close" aria-label="Close">
              <svg class="profile-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="profile-body">
            <div class="profile-content">
              <p>Loading...</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('app-profile', AppProfile);
