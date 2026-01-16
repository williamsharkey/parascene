class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.profileMenuOpen = false;
    this.notificationsMenuOpen = false;
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleRouteChange = this.handleRouteChange.bind(this);
    this.routes = [];
    this.defaultRoute = null;
    this.hasParsedRoutes = false;
  }

  static get observedAttributes() {
    return ['show-notifications', 'show-profile', 'show-generate', 'default-route'];
  }

  connectedCallback() {
    // Parse routes if not already parsed (attributeChangedCallback might have run first)
    if (!this.hasParsedRoutes) {
      this.parseRoutesFromChildren();
    }
    
    // Now render (which will replace innerHTML and children)
    this.render();
    this.setupEventListeners();
    this.setupNavListeners();
    document.addEventListener('click', this.handleDocumentClick);
    window.addEventListener('popstate', this.handleRouteChange);
    // Small delay to ensure DOM is ready for route change handler
    setTimeout(() => this.handleRouteChange(), 0);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.handleDocumentClick);
    window.removeEventListener('popstate', this.handleRouteChange);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Parse routes BEFORE rendering if not already parsed
    if (!this.hasParsedRoutes) {
      this.parseRoutesFromChildren();
    }
    
    if (name === 'default-route' && oldValue !== newValue) {
      this.defaultRoute = newValue;
      if (this.hasParsedRoutes) {
        this.handleRouteChange();
      }
    } else {
      // Re-render to update UI
      this.render();
      this.setupEventListeners();
      this.setupNavListeners();
    }
  }
  
  parseRoutesFromChildren() {
    // Parse routes from direct children - must be called BEFORE render()
    const children = Array.from(this.children);
    
    const links = children.filter(child => 
      child.tagName === 'A' && child.hasAttribute('data-route')
    );
    
    this.routes = links.map(link => ({
      id: link.getAttribute('data-route'),
      label: link.textContent.trim()
    }));
    
    if (!Array.isArray(this.routes)) {
      this.routes = [];
    }
    
    this.defaultRoute = this.getAttribute('default-route') || this.routes[0]?.id;
    this.hasParsedRoutes = true;
  }


  setupNavListeners() {
    const navLinks = this.querySelectorAll('.header-nav .nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        if (route) {
          // Use History API with pathname-based routing
          window.history.pushState({ route }, '', `/${route}`);
          this.handleRouteChange();
        }
      });
    });
  }

  updateGenerateButtonState() {
    const generateButton = this.querySelector('.generate-button');
    if (!generateButton) return;
    
    const pathname = window.location.pathname;
    const currentRoute = pathname === '/' || pathname === '' ? this.defaultRoute : pathname.slice(1);
    const isGenerateRoute = currentRoute === 'generate';
    
    generateButton.disabled = isGenerateRoute;
    if (isGenerateRoute) {
      generateButton.style.background = 'var(--surface-strong)';
      generateButton.style.color = 'var(--text)';
      generateButton.style.borderColor = 'var(--border)';
      generateButton.style.cursor = 'not-allowed';
      generateButton.style.fontWeight = '700';
    } else {
      generateButton.style.background = 'var(--accent)';
      generateButton.style.color = 'var(--accent-text)';
      generateButton.style.borderColor = 'var(--accent)';
      generateButton.style.cursor = 'pointer';
      generateButton.style.fontWeight = '500';
    }
  }

  handleRouteChange() {
    // Get route from pathname (e.g., /feed -> feed, / -> defaultRoute)
    const pathname = window.location.pathname;
    let currentRoute = pathname === '/' || pathname === '' ? this.defaultRoute : pathname.slice(1);
    
    // If at root and we have a default route, update URL to reflect it
    if ((pathname === '/' || pathname === '') && this.defaultRoute && currentRoute) {
      window.history.replaceState({ route: currentRoute }, '', `/${currentRoute}`);
    }
    
    // Update active nav link
    const navLinks = this.querySelectorAll('.header-nav .nav-link');
    navLinks.forEach(link => {
      const isActive = link.getAttribute('data-route') === currentRoute;
      link.classList.toggle('active', isActive);
    });
    
    // Update Generate button state
    this.updateGenerateButtonState();
    
    // Show/hide route content sections
    const contentSections = document.querySelectorAll('[data-route-content]');
    contentSections.forEach(section => {
      const isActive = section.getAttribute('data-route-content') === currentRoute;
      section.classList.toggle('active', isActive);
      section.style.display = isActive ? 'block' : 'none';
    });
    
    // Dispatch custom event for route change
    this.dispatchEvent(new CustomEvent('route-change', {
      detail: { route: currentRoute },
      bubbles: true
    }));
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
    const generateButton = this.querySelector('.generate-button');
    if (generateButton) {
      generateButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Don't navigate if already on generate route
        if (generateButton.disabled) return;
        // Navigate to generate route
        window.history.pushState({ route: 'generate' }, '', '/generate');
        this.handleRouteChange();
      });
    }
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

    // Handle menu item clicks
    const profileMenu = this.querySelector('.profile-menu');
    if (profileMenu) {
      profileMenu.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-action="profile"]');
        if (link) {
          e.preventDefault();
          e.stopPropagation();
          this.closeProfileMenu();
          document.dispatchEvent(new CustomEvent('open-profile'));
        } else {
          e.stopPropagation();
        }
      });
    }

    const notificationsMenu = this.querySelector('.notifications-menu');
    if (notificationsMenu) {
      notificationsMenu.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-action="notifications"]');
        if (link) {
          e.preventDefault();
          e.stopPropagation();
          this.closeNotificationsMenu();
          document.dispatchEvent(new CustomEvent('open-notifications'));
        } else {
          e.stopPropagation();
        }
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
    const showGenerate = this.hasAttribute('show-generate');

    this.innerHTML = `
      <style>
        header .action-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 6px;
          text-decoration: none;
          color: var(--text);
          background: transparent;
          border: 1px solid transparent;
          font-size: 0.875rem;
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
          width: 16px;
          height: 16px;
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
          <nav class="header-nav">
            ${(this.routes || []).map(route => {
              const routeId = route.id;
              const routeLabel = route.label;
              // Generate clean URL path (e.g., /feed, /explore)
              return `<a href="/${routeId}" class="nav-link" data-route="${routeId}">${routeLabel}</a>`;
            }).join('')}
          </nav>
          <div class="header-actions">
            ${showGenerate ? `
              <button class="action-item generate-button" style="background: var(--accent); color: var(--accent-text); border-color: var(--accent); font-weight: 500;">
                Generate
              </button>
            ` : ''}
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
                  <a href="#" data-action="notifications" class="notifications-menu-item">View All</a>
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
                  <a href="#" data-action="profile" class="profile-menu-item">Profile</a>
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
