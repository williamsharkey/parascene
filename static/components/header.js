class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.profileMenuOpen = false;
    this.notificationsMenuOpen = false;
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
  }

  static get observedAttributes() {
    return ['show-notifications', 'show-profile'];
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    document.addEventListener('click', this.handleDocumentClick);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.handleDocumentClick);
  }

  attributeChangedCallback() {
    this.render();
    this.setupEventListeners();
  }

  handleDocumentClick() {
    if (this.profileMenuOpen) {
      this.closeProfileMenu();
    }
    if (this.notificationsMenuOpen) {
      this.closeNotificationsMenu();
    }
  }

  setupEventListeners() {
    const profileButton = this.querySelector('.profile-button');
    if (profileButton) {
      profileButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleProfileMenu();
      });
    }

    const notificationsButton = this.querySelector('.notifications-button');
    if (notificationsButton) {
      notificationsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleNotificationsMenu();
      });
    }

    // Prevent menus from closing when clicking inside them
    const profileMenu = this.querySelector('.profile-menu');
    if (profileMenu) {
      profileMenu.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    const notificationsMenu = this.querySelector('.notifications-menu');
    if (notificationsMenu) {
      notificationsMenu.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  toggleProfileMenu() {
    this.profileMenuOpen = !this.profileMenuOpen;
    if (this.profileMenuOpen) {
      this.closeNotificationsMenu();
    }
    const menu = this.querySelector('.profile-menu');
    if (menu) {
      menu.classList.toggle('open', this.profileMenuOpen);
    }
  }

  closeProfileMenu() {
    this.profileMenuOpen = false;
    const menu = this.querySelector('.profile-menu');
    if (menu) {
      menu.classList.remove('open');
    }
  }

  toggleNotificationsMenu() {
    this.notificationsMenuOpen = !this.notificationsMenuOpen;
    if (this.notificationsMenuOpen) {
      this.closeProfileMenu();
    }
    const menu = this.querySelector('.notifications-menu');
    if (menu) {
      menu.classList.toggle('open', this.notificationsMenuOpen);
    }
  }

  closeNotificationsMenu() {
    this.notificationsMenuOpen = false;
    const menu = this.querySelector('.notifications-menu');
    if (menu) {
      menu.classList.remove('open');
    }
  }

  render() {
    const showNotifications = this.hasAttribute('show-notifications');
    const showProfile = this.hasAttribute('show-profile');

    this.innerHTML = `
      <style>
        header .action-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--text);
          background: transparent;
          border: 1px solid transparent;
          font-size: 0.95rem;
          transition: background-color 0.2s, border-color 0.2s;
          cursor: pointer;
          font: inherit;
        }
        header .action-item:hover {
          background: var(--surface-strong);
          border-color: var(--border);
        }
        header .action-item:focus-visible {
          outline: 2px solid var(--focus);
          outline-offset: 2px;
        }
        header .action-item .icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }
        header .profile-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: var(--shadow);
          min-width: 180px;
          width: 250px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-8px);
          transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
          z-index: 1000;
          overflow: hidden;
        }
        header .profile-menu.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        header .profile-menu-item {
          display: block;
          width: 100%;
          padding: 12px 16px;
          text-decoration: none;
          color: var(--text);
          border: none;
          background: transparent;
          text-align: left;
          font-size: 0.95rem;
          cursor: pointer;
          transition: background-color 0.2s;
          font: inherit;
        }
        header .profile-menu-item:first-child {
          border-radius: 10px 10px 0 0;
        }
        header .profile-menu-item:last-child {
          border-radius: 0 0 10px 10px;
        }
        header .profile-menu-item:hover {
          background: var(--surface-strong);
        }
        header .profile-menu-item:focus-visible {
          outline: 2px solid var(--focus);
          outline-offset: -2px;
        }
        header .profile-menu-divider {
          height: 1px;
          background: var(--border);
          margin: 4px 0;
        }
        header .notifications-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: var(--shadow);
          width: 250px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-8px);
          transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
          z-index: 1000;
          overflow: hidden;
        }
        header .notifications-menu.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        header .notifications-menu-item {
          display: block;
          width: 100%;
          padding: 12px 16px;
          text-decoration: none;
          color: var(--text);
          border: none;
          background: transparent;
          text-align: left;
          font-size: 0.95rem;
          cursor: pointer;
          transition: background-color 0.2s;
          font: inherit;
        }
        header .notifications-menu-item:first-child {
          border-radius: 10px 10px 0 0;
        }
        header .notifications-menu-item:last-child {
          border-radius: 0 0 10px 10px;
        }
        header .notifications-menu-item:hover {
          background: var(--surface-strong);
        }
        header .notifications-menu-item:focus-visible {
          outline: 2px solid var(--focus);
          outline-offset: -2px;
        }
        header .notifications-menu-divider {
          height: 1px;
          background: var(--border);
          margin: 4px 0;
        }
      </style>
      <header>
        <div class="header-content">
          <div class="header-logo">
            <svg class="logo" width="200" height="40" viewBox="0 0 200 40">
              <text x="2" y="30" class="logo-text">
                <tspan opacity="1">par</tspan><tspan opacity="0.7">asc</tspan><tspan opacity="1">ene</tspan>
              </text>
            </svg>
          </div>
          <div class="header-actions">
            ${showNotifications ? `
              <div style="position: relative;">
                <button class="action-item notifications-button">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                </button>
                <div class="notifications-menu">
                  <div class="notifications-menu-item" style="color: var(--text-muted); cursor: default;">
                    No new notifications
                  </div>
                  <div class="notifications-menu-divider"></div>
                  <a href="#notifications" class="notifications-menu-item">View All</a>
                </div>
              </div>
            ` : ''}
            ${showProfile ? `
              <div style="position: relative;">
                <button class="action-item profile-button">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </button>
                <div class="profile-menu">
                  <a href="#profile" class="profile-menu-item">Profile</a>
                  <div class="profile-menu-divider"></div>
                  <form action="/logout" method="post" style="margin: 0;">
                    <button type="submit" class="profile-menu-item">Logout</button>
                  </form>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </header>
    `;
  }
}

customElements.define('app-header', AppHeader);
