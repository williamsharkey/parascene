class AppRouteCreate extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .create-route .create-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
        }
        .create-route .create-button {
          padding: 10px 20px;
          background: var(--accent);
          color: var(--accent-text);
          border: none;
          border-radius: 6px;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.1s ease;
        }
        .create-route .create-button:hover:not(:disabled) {
          background: var(--focus);
          transform: translateY(-1px);
        }
        .create-route .create-button:active:not(:disabled) {
          transform: translateY(0);
        }
        .create-route .create-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .create-route .create-status {
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .create-route .create-status.loading {
          color: var(--accent);
        }
        .create-route .create-status.error {
          color: var(--error-text);
        }
      </style>
      <div class="create-route">
        <div class="route-header">
          <h3>Create</h3>
          <p>Make a new creation.  There will be a form here that is defined by the template and selected provider..</p>
        </div>
        <div class="create-controls">
          <button class="create-button" data-create-button>
            Create
          </button>
          <div class="create-status" data-create-status></div>
        </div>
      </div>
    `;
    this.setupEventListeners();
  }

  setupEventListeners() {
    const createButton = this.querySelector("[data-create-button]");
    if (createButton) {
      createButton.addEventListener("click", () => this.handleCreate());
    }
  }

  async handleCreate() {
    const button = this.querySelector("[data-create-button]");
    const status = this.querySelector("[data-create-status]");
    
    if (!button || !status) return;

    if (typeof this.onCreate === "function") {
      this.onCreate({ button, status });
    }
  }
}

customElements.define("app-route-create", AppRouteCreate);
