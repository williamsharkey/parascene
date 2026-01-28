import { formatRelativeTime } from '../../shared/datetime.js';

const html = String.raw;

// Wizard step constants
const STEPS = {
  DESCRIBE: 'describe',
  GENERATING: 'generating',
  PREVIEW: 'preview',
  TESTING: 'testing',
  DECIDE: 'decide',
  CUSTOMIZE: 'customize',
  DEPLOY: 'deploy'
};

// Cost constants
const GENERATION_COST = 20;
const REFINEMENT_COST = 10;

class AppModalAiServerGenerator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._isOpen = false;
    this.currentStep = STEPS.DESCRIBE;
    this.projectId = null;
    this.projectData = null;
    this.currentVersion = null;
    this.generatedFiles = null;
    this.testResults = null;
    this.handleEscape = this.handleEscape.bind(this);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleEscape);
  }

  setupEventListeners() {
    document.addEventListener('keydown', this.handleEscape);

    const overlay = this.shadowRoot.querySelector('.modal-overlay');
    const closeButton = this.shadowRoot.querySelector('.modal-close');

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

  handleEscape(e) {
    if (e.key === 'Escape' && this.isOpen()) {
      this.close();
    }
  }

  isOpen() {
    return this._isOpen;
  }

  async open({ projectId = null } = {}) {
    this._isOpen = true;
    this.projectId = projectId;
    this.currentStep = STEPS.DESCRIBE;
    this.projectData = null;
    this.currentVersion = null;
    this.generatedFiles = null;
    this.testResults = null;

    const overlay = this.shadowRoot.querySelector('.modal-overlay');

    // Load project if editing existing
    if (projectId) {
      await this.loadProject(projectId);
    }

    this.renderCurrentStep();

    if (overlay) {
      overlay.classList.add('open');
    }
    document.dispatchEvent(new CustomEvent('modal-opened'));
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    const overlay = this.shadowRoot.querySelector('.modal-overlay');
    if (overlay) {
      overlay.classList.remove('open');
    }
    this.currentStep = STEPS.DESCRIBE;
    this.projectId = null;
    this.projectData = null;
    document.dispatchEvent(new CustomEvent('modal-closed'));
  }

  async loadProject(projectId) {
    try {
      const response = await fetch(`/api/ai-servers/${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load project');
      const data = await response.json();
      this.projectData = data.project;
      this.currentVersion = data.liveVersion;
    } catch (error) {
      console.error('Error loading project:', error);
    }
  }

  render() {
    this.shadowRoot.innerHTML = html`
      <style>
        :host {
          display: block;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }

        .modal-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }

        .modal {
          background: var(--surface);
          border-radius: 14px;
          width: 90%;
          max-width: 700px;
          max-height: 90vh;
          box-shadow: var(--shadow);
          transform: scale(0.95);
          transition: transform 0.2s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-overlay.open .modal {
          transform: scale(1);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
        }

        .modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text);
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--text-muted);
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background 0.2s ease;
        }

        .modal-close:hover {
          background: var(--surface-strong);
        }

        .modal-body {
          padding: 1.5rem;
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
        }

        .modal-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1rem 1.5rem 1.25rem;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
          background: var(--surface);
        }

        .modal-actions button {
          flex: 1;
          padding: 0.875rem 1.5rem;
          border-radius: 6px;
          border: none;
          font-size: 0.95rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.1s ease, opacity 0.2s ease;
        }

        .modal-actions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--accent);
          color: var(--accent-text);
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--focus);
        }

        .btn-secondary {
          background: var(--surface-strong);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--surface);
        }

        .btn-danger {
          background: var(--error-bg);
          color: var(--error-text);
        }

        /* Step indicator */
        .step-indicator {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--border);
          transition: background 0.2s ease;
        }

        .step-dot.active {
          background: var(--accent);
        }

        .step-dot.completed {
          background: var(--accent);
          opacity: 0.5;
        }

        /* Form styles */
        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group label {
          display: block;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 0.5rem;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--input-bg);
          color: var(--text);
          font-size: 0.95rem;
          font-family: inherit;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
        }

        .form-group textarea {
          resize: vertical;
          min-height: 120px;
        }

        .form-hint {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 0.5rem;
        }

        /* Cost badge */
        .cost-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: color-mix(in srgb, var(--accent) 15%, transparent);
          color: var(--accent);
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        /* Loading state */
        .generating-state {
          text-align: center;
          padding: 3rem 1rem;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .generating-text {
          font-size: 1rem;
          color: var(--text);
          margin-bottom: 0.5rem;
        }

        .generating-subtext {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        /* Code preview */
        .code-preview {
          background: var(--surface-strong);
          border: 1px solid var(--border);
          border-radius: 8px;
          max-height: 300px;
          overflow: auto;
        }

        .code-preview pre {
          margin: 0;
          padding: 1rem;
          font-size: 0.8rem;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .code-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .code-tab {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font-size: 0.8rem;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .code-tab.active {
          background: var(--accent);
          color: var(--accent-text);
          border-color: var(--accent);
        }

        /* Test results */
        .test-results {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .test-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--surface-strong);
          border-radius: 8px;
        }

        .test-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          flex-shrink: 0;
        }

        .test-icon.pass {
          background: color-mix(in srgb, green 20%, transparent);
          color: green;
        }

        .test-icon.fail {
          background: var(--error-bg);
          color: var(--error-text);
        }

        .test-icon.pending {
          background: var(--border);
          color: var(--text-muted);
        }

        .test-name {
          font-weight: 500;
          color: var(--text);
        }

        .test-message {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-left: auto;
        }

        /* Decision step */
        .decision-options {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .decision-card {
          padding: 1.25rem;
          border: 1px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .decision-card:hover {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 5%, transparent);
        }

        .decision-card-title {
          font-weight: 600;
          color: var(--text);
          margin-bottom: 0.25rem;
        }

        .decision-card-desc {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        /* Deploy options */
        .deploy-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .deploy-option {
          padding: 1.25rem;
          border: 2px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          transition: border-color 0.2s ease;
          text-align: center;
        }

        .deploy-option.selected {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 5%, transparent);
        }

        .deploy-option-title {
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .deploy-option-desc {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        /* Success message */
        .success-message {
          padding: 1rem;
          background: color-mix(in srgb, var(--accent) 10%, transparent);
          border-radius: 8px;
          color: var(--accent);
          margin-bottom: 1rem;
        }

        .error-message {
          padding: 1rem;
          background: var(--error-bg);
          border-radius: 8px;
          color: var(--error-text);
          margin-bottom: 1rem;
        }

        /* Customization */
        .branding-preview {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--surface-strong);
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .branding-icon {
          width: 64px;
          height: 64px;
          border-radius: 12px;
          background: var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          color: var(--text-muted);
        }

        .branding-icon img {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          object-fit: cover;
        }

        .branding-info {
          flex: 1;
        }

        .branding-name {
          font-weight: 600;
          font-size: 1.1rem;
        }

        .branding-status {
          font-size: 0.85rem;
          color: var(--text-muted);
        }
      </style>
      <div class="modal-overlay">
        <div class="modal">
          <header class="modal-header">
            <h3 class="modal-title" data-modal-title>Create with AI</h3>
            <button type="button" class="modal-close" aria-label="Close">x</button>
          </header>
          <div class="modal-body" data-modal-body>
            <div class="generating-state">Loading...</div>
          </div>
          <div class="modal-actions" data-modal-actions style="display: none;"></div>
        </div>
      </div>
    `;
  }

  renderCurrentStep() {
    const title = this.shadowRoot.querySelector('[data-modal-title]');
    const body = this.shadowRoot.querySelector('[data-modal-body]');
    const actions = this.shadowRoot.querySelector('[data-modal-actions]');

    switch (this.currentStep) {
      case STEPS.DESCRIBE:
        this.renderDescribeStep(title, body, actions);
        break;
      case STEPS.GENERATING:
        this.renderGeneratingStep(title, body, actions);
        break;
      case STEPS.PREVIEW:
        this.renderPreviewStep(title, body, actions);
        break;
      case STEPS.TESTING:
        this.renderTestingStep(title, body, actions);
        break;
      case STEPS.DECIDE:
        this.renderDecideStep(title, body, actions);
        break;
      case STEPS.CUSTOMIZE:
        this.renderCustomizeStep(title, body, actions);
        break;
      case STEPS.DEPLOY:
        this.renderDeployStep(title, body, actions);
        break;
    }
  }

  renderStepIndicator(currentIndex) {
    const steps = [STEPS.DESCRIBE, STEPS.PREVIEW, STEPS.DECIDE, STEPS.DEPLOY];
    return html`
      <div class="step-indicator">
        ${steps.map((step, i) => {
          let className = 'step-dot';
          if (i < currentIndex) className += ' completed';
          else if (i === currentIndex) className += ' active';
          return `<div class="${className}"></div>`;
        }).join('')}
      </div>
    `;
  }

  renderDescribeStep(title, body, actions) {
    if (title) title.textContent = 'Create with AI';
    if (body) {
      body.innerHTML = html`
        ${this.renderStepIndicator(0)}
        <div class="form-group">
          <label>What do you want your server to create?</label>
          <textarea
            data-description
            placeholder="Example: Generate pixel art avatars with customizable backgrounds and accessories. Each avatar should be unique based on a random seed."
            rows="5"
          >${this.projectData?.description || ''}</textarea>
          <div class="form-hint">
            Describe the type of images your server should generate. Be specific about style, size, and any customization options.
          </div>
        </div>
        <div class="form-group">
          <label>Server Name (optional)</label>
          <input type="text" data-name placeholder="My AI Server" value="${this.projectData?.name || ''}" />
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="cost-badge">${GENERATION_COST} credits</span>
          <span style="font-size: 0.85rem; color: var(--text-muted);">
            Only charged if you accept the result
          </span>
        </div>
      `;
    }
    if (actions) {
      actions.style.display = 'flex';
      actions.innerHTML = html`
        <button type="button" class="btn-secondary" data-cancel>Cancel</button>
        <button type="button" class="btn-primary" data-generate>Generate Server</button>
      `;

      actions.querySelector('[data-cancel]').addEventListener('click', () => this.close());
      actions.querySelector('[data-generate]').addEventListener('click', () => this.handleGenerate());
    }
  }

  renderGeneratingStep(title, body, actions) {
    if (title) title.textContent = 'Generating...';
    if (body) {
      body.innerHTML = html`
        <div class="generating-state">
          <div class="spinner"></div>
          <div class="generating-text">Claude is building your server...</div>
          <div class="generating-subtext">This may take up to 30 seconds</div>
        </div>
      `;
    }
    if (actions) {
      actions.style.display = 'none';
    }
  }

  renderPreviewStep(title, body, actions) {
    if (title) title.textContent = 'Preview Generated Code';
    if (body) {
      const files = this.generatedFiles || {};
      const fileNames = Object.keys(files);
      const firstFile = fileNames[0] || 'api/index.js';

      body.innerHTML = html`
        ${this.renderStepIndicator(1)}
        <div class="code-tabs" data-code-tabs>
          ${fileNames.map((name, i) => html`
            <button class="code-tab ${i === 0 ? 'active' : ''}" data-file="${name}">${name}</button>
          `).join('')}
        </div>
        <div class="code-preview">
          <pre data-code-content>${this.escapeHtml(files[firstFile] || '')}</pre>
        </div>
        <div class="form-group" style="margin-top: 1.25rem;">
          <label>Server Name</label>
          <input type="text" data-name value="${this.currentVersion?.suggestedName || this.projectData?.name || 'AI Generated Server'}" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea data-description rows="2">${this.currentVersion?.suggestedDescription || this.projectData?.description || ''}</textarea>
        </div>
      `;

      // Setup tab switching
      const tabs = body.querySelectorAll('[data-file]');
      const codeContent = body.querySelector('[data-code-content]');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          codeContent.textContent = files[tab.dataset.file] || '';
        });
      });
    }
    if (actions) {
      actions.style.display = 'flex';
      actions.innerHTML = html`
        <button type="button" class="btn-secondary" data-back>Back</button>
        <button type="button" class="btn-primary" data-test>Run Tests</button>
      `;

      actions.querySelector('[data-back]').addEventListener('click', () => {
        this.currentStep = STEPS.DESCRIBE;
        this.renderCurrentStep();
      });
      actions.querySelector('[data-test]').addEventListener('click', () => this.handleTest());
    }
  }

  renderTestingStep(title, body, actions) {
    if (title) title.textContent = 'Testing Server';
    if (body) {
      const results = this.testResults || {};
      const testNames = {
        syntax: 'Syntax Check',
        structure: 'Handler Structure',
        getEndpoint: 'GET Endpoint',
        postEndpoint: 'POST Endpoint'
      };

      body.innerHTML = html`
        ${this.renderStepIndicator(1)}
        <div class="test-results">
          ${Object.entries(testNames).map(([key, name]) => {
            const result = results[key];
            const status = result ? (result.passed ? 'pass' : 'fail') : 'pending';
            const icon = status === 'pass' ? 'OK' : status === 'fail' ? 'X' : '...';
            const message = result?.message || 'Pending...';
            return html`
              <div class="test-item">
                <div class="test-icon ${status}">${icon}</div>
                <span class="test-name">${name}</span>
                <span class="test-message">${message}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
    if (actions) {
      const allPassed = this.testResults && Object.values(this.testResults).every(t => t?.passed);
      actions.style.display = 'flex';
      actions.innerHTML = html`
        <button type="button" class="btn-secondary" data-back>Back to Preview</button>
        <button type="button" class="btn-primary" data-continue ${allPassed ? '' : 'disabled'}>Continue</button>
      `;

      actions.querySelector('[data-back]').addEventListener('click', () => {
        this.currentStep = STEPS.PREVIEW;
        this.renderCurrentStep();
      });
      actions.querySelector('[data-continue]').addEventListener('click', () => {
        this.currentStep = STEPS.DECIDE;
        this.renderCurrentStep();
      });
    }
  }

  renderDecideStep(title, body, actions) {
    if (title) title.textContent = 'Accept or Refine?';
    if (body) {
      body.innerHTML = html`
        ${this.renderStepIndicator(2)}
        <div class="decision-options">
          <div class="decision-card" data-accept>
            <div class="decision-card-title">Accept & Pay (${GENERATION_COST} credits)</div>
            <div class="decision-card-desc">
              Save this version and proceed to deployment. Credits will be deducted now.
            </div>
          </div>
          <div class="decision-card" data-refine>
            <div class="decision-card-title">Refine (${REFINEMENT_COST} credits)</div>
            <div class="decision-card-desc">
              Request changes to the generated code. You'll only pay when you accept.
            </div>
          </div>
          <div class="decision-card" data-reject>
            <div class="decision-card-title">Reject (Free)</div>
            <div class="decision-card-desc">
              Discard this version and start over. No credits will be charged.
            </div>
          </div>
        </div>
      `;

      body.querySelector('[data-accept]').addEventListener('click', () => this.handleAccept());
      body.querySelector('[data-refine]').addEventListener('click', () => this.handleRefinePrompt());
      body.querySelector('[data-reject]').addEventListener('click', () => this.handleReject());
    }
    if (actions) {
      actions.style.display = 'none';
    }
  }

  renderCustomizeStep(title, body, actions) {
    if (title) title.textContent = 'Customize Your Server';
    if (body) {
      body.innerHTML = html`
        ${this.renderStepIndicator(2)}
        <div class="branding-preview">
          <div class="branding-icon" data-icon-preview>
            ${this.projectData?.icon_url
              ? `<img src="${this.escapeHtml(this.projectData.icon_url)}" alt="" />`
              : 'AI'}
          </div>
          <div class="branding-info">
            <div class="branding-name" data-name-preview>${this.projectData?.name || 'AI Generated Server'}</div>
            <div class="branding-status">Ready for deployment</div>
          </div>
        </div>
        <div class="form-group">
          <label>Server Name</label>
          <input type="text" data-name value="${this.projectData?.name || ''}" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea data-description rows="3">${this.projectData?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Icon URL (optional)</label>
          <input type="url" data-icon-url placeholder="https://..." value="${this.projectData?.icon_url || ''}" />
        </div>
        <div class="form-group">
          <label>Banner URL (optional)</label>
          <input type="url" data-banner-url placeholder="https://..." value="${this.projectData?.banner_url || ''}" />
        </div>
      `;

      // Live preview updates
      const nameInput = body.querySelector('[data-name]');
      const namePreview = body.querySelector('[data-name-preview]');
      nameInput.addEventListener('input', () => {
        namePreview.textContent = nameInput.value || 'AI Generated Server';
      });
    }
    if (actions) {
      actions.style.display = 'flex';
      actions.innerHTML = html`
        <button type="button" class="btn-secondary" data-skip>Skip</button>
        <button type="button" class="btn-primary" data-save>Save & Continue</button>
      `;

      actions.querySelector('[data-skip]').addEventListener('click', () => {
        this.currentStep = STEPS.DEPLOY;
        this.renderCurrentStep();
      });
      actions.querySelector('[data-save]').addEventListener('click', () => this.handleSaveCustomization());
    }
  }

  renderDeployStep(title, body, actions) {
    if (title) title.textContent = 'Deploy Your Server';
    if (body) {
      body.innerHTML = html`
        ${this.renderStepIndicator(3)}
        <p style="margin-bottom: 1.5rem; color: var(--text-muted);">
          Choose how you want to host your server:
        </p>
        <div class="deploy-options">
          <div class="deploy-option" data-option="self">
            <div class="deploy-option-title">Self-Host</div>
            <div class="deploy-option-desc">
              Download the code and deploy to your own Vercel account. Full control, no ongoing costs.
            </div>
          </div>
          <div class="deploy-option" data-option="parasharkgod">
            <div class="deploy-option-title">Host on Parasharkgod</div>
            <div class="deploy-option-desc">
              We host it for you. 50/50 royalty split on all usage. No setup required.
            </div>
          </div>
        </div>
        <div data-deploy-content></div>
      `;

      const options = body.querySelectorAll('[data-option]');
      const content = body.querySelector('[data-deploy-content]');

      options.forEach(opt => {
        opt.addEventListener('click', () => {
          options.forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          this.selectedHosting = opt.dataset.option;

          if (this.selectedHosting === 'self') {
            content.innerHTML = html`
              <div class="success-message">
                Download includes: api/index.js, package.json, vercel.json, and README with setup instructions.
              </div>
            `;
          } else {
            content.innerHTML = html`
              <div class="success-message">
                Your server will be hosted on parasharkgod.com and automatically registered. You earn 50% of all credits spent by users.
              </div>
            `;
          }
        });
      });
    }
    if (actions) {
      actions.style.display = 'flex';
      actions.innerHTML = html`
        <button type="button" class="btn-secondary" data-customize>Customize</button>
        <button type="button" class="btn-primary" data-deploy>Deploy</button>
      `;

      actions.querySelector('[data-customize]').addEventListener('click', () => {
        this.currentStep = STEPS.CUSTOMIZE;
        this.renderCurrentStep();
      });
      actions.querySelector('[data-deploy]').addEventListener('click', () => this.handleDeploy());
    }
  }

  async handleGenerate() {
    const body = this.shadowRoot.querySelector('[data-modal-body]');
    const description = body.querySelector('[data-description]')?.value?.trim();
    const name = body.querySelector('[data-name]')?.value?.trim() || 'AI Generated Server';

    if (!description) {
      alert('Please describe what you want your server to create.');
      return;
    }

    // Show generating state
    this.currentStep = STEPS.GENERATING;
    this.renderCurrentStep();

    try {
      // Create project if new
      if (!this.projectId) {
        const createRes = await fetch('/api/ai-servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, description })
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error || 'Failed to create project');
        }
        const createData = await createRes.json();
        this.projectId = createData.project.id;
        this.projectData = createData.project;
      }

      // Generate code
      const genRes = await fetch(`/api/ai-servers/${this.projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: description })
      });

      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error || 'Failed to generate server');
      }

      const genData = await genRes.json();
      this.currentVersion = genData.version;
      this.generatedFiles = genData.files;

      // Update project data with suggestions
      if (genData.suggestedName) {
        this.projectData.name = genData.suggestedName;
      }
      if (genData.suggestedDescription) {
        this.projectData.description = genData.suggestedDescription;
      }

      // Show preview
      this.currentStep = STEPS.PREVIEW;
      this.renderCurrentStep();
    } catch (error) {
      console.error('Generation error:', error);
      this.currentStep = STEPS.DESCRIBE;
      this.renderCurrentStep();

      const body = this.shadowRoot.querySelector('[data-modal-body]');
      const existingError = body.querySelector('.error-message');
      if (existingError) existingError.remove();

      body.insertAdjacentHTML('afterbegin', html`
        <div class="error-message">${this.escapeHtml(error.message)}</div>
      `);
    }
  }

  async handleTest() {
    if (!this.currentVersion?.id) return;

    this.currentStep = STEPS.TESTING;
    this.testResults = null;
    this.renderCurrentStep();

    try {
      const res = await fetch(`/api/ai-servers/${this.projectId}/versions/${this.currentVersion.id}/test`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await res.json();
      this.testResults = data.results;
      this.renderCurrentStep();
    } catch (error) {
      console.error('Test error:', error);
      this.testResults = {
        syntax: { passed: false, message: error.message },
        structure: { passed: false, message: 'Skipped' },
        getEndpoint: { passed: false, message: 'Skipped' },
        postEndpoint: { passed: false, message: 'Skipped' }
      };
      this.renderCurrentStep();
    }
  }

  async handleAccept() {
    if (!this.currentVersion?.id) return;

    try {
      const res = await fetch(`/api/ai-servers/${this.projectId}/versions/${this.currentVersion.id}/accept`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to accept version');
      }

      const data = await res.json();
      this.projectData = data.project;
      this.currentVersion = data.version;

      this.currentStep = STEPS.CUSTOMIZE;
      this.renderCurrentStep();
    } catch (error) {
      console.error('Accept error:', error);
      alert(error.message);
    }
  }

  handleRefinePrompt() {
    const body = this.shadowRoot.querySelector('[data-modal-body]');
    body.innerHTML = html`
      ${this.renderStepIndicator(2)}
      <div class="form-group">
        <label>What would you like to change?</label>
        <textarea data-refine-prompt placeholder="Example: Make the images more colorful and add a border around each one." rows="4"></textarea>
        <div class="form-hint">
          <span class="cost-badge">${REFINEMENT_COST} credits</span>
          Describe the changes you want. Only charged if you accept the refined version.
        </div>
      </div>
    `;

    const actions = this.shadowRoot.querySelector('[data-modal-actions]');
    actions.style.display = 'flex';
    actions.innerHTML = html`
      <button type="button" class="btn-secondary" data-back>Back</button>
      <button type="button" class="btn-primary" data-submit-refine>Refine</button>
    `;

    actions.querySelector('[data-back]').addEventListener('click', () => {
      this.currentStep = STEPS.DECIDE;
      this.renderCurrentStep();
    });
    actions.querySelector('[data-submit-refine]').addEventListener('click', () => this.handleRefine());
  }

  async handleRefine() {
    const body = this.shadowRoot.querySelector('[data-modal-body]');
    const prompt = body.querySelector('[data-refine-prompt]')?.value?.trim();

    if (!prompt) {
      alert('Please describe what you want to change.');
      return;
    }

    this.currentStep = STEPS.GENERATING;
    this.renderCurrentStep();

    try {
      const res = await fetch(`/api/ai-servers/${this.projectId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt, versionId: this.currentVersion?.id })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to refine server');
      }

      const data = await res.json();
      this.currentVersion = data.version;
      this.generatedFiles = data.files;

      this.currentStep = STEPS.PREVIEW;
      this.renderCurrentStep();
    } catch (error) {
      console.error('Refine error:', error);
      this.currentStep = STEPS.DECIDE;
      this.renderCurrentStep();
      alert(error.message);
    }
  }

  async handleReject() {
    if (!this.currentVersion?.id) {
      this.close();
      return;
    }

    try {
      await fetch(`/api/ai-servers/${this.projectId}/versions/${this.currentVersion.id}/reject`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Reject error:', error);
    }

    // Go back to describe step
    this.currentVersion = null;
    this.generatedFiles = null;
    this.testResults = null;
    this.currentStep = STEPS.DESCRIBE;
    this.renderCurrentStep();
  }

  async handleSaveCustomization() {
    const body = this.shadowRoot.querySelector('[data-modal-body]');
    const name = body.querySelector('[data-name]')?.value?.trim();
    const description = body.querySelector('[data-description]')?.value?.trim();
    const iconUrl = body.querySelector('[data-icon-url]')?.value?.trim();
    const bannerUrl = body.querySelector('[data-banner-url]')?.value?.trim();

    try {
      // Update project metadata
      if (name || description) {
        await fetch(`/api/ai-servers/${this.projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, description })
        });
      }

      // Update branding
      if (iconUrl !== undefined || bannerUrl !== undefined) {
        await fetch(`/api/ai-servers/${this.projectId}/branding`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ icon_url: iconUrl, banner_url: bannerUrl })
        });
      }

      // Reload project data
      await this.loadProject(this.projectId);

      this.currentStep = STEPS.DEPLOY;
      this.renderCurrentStep();
    } catch (error) {
      console.error('Save customization error:', error);
      alert('Failed to save customization');
    }
  }

  async handleDeploy() {
    if (!this.selectedHosting) {
      alert('Please select a hosting option');
      return;
    }

    try {
      if (this.selectedHosting === 'self') {
        // Download ZIP
        window.location.href = `/api/ai-servers/${this.projectId}/download`;

        // Show success and close
        setTimeout(() => {
          this.close();
          document.dispatchEvent(new CustomEvent('server-updated'));
        }, 500);
      } else {
        // Deploy to parasharkgod
        const res = await fetch(`/api/ai-servers/${this.projectId}/deploy`, {
          method: 'POST',
          credentials: 'include'
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to deploy');
        }

        const data = await res.json();

        // Show success
        const body = this.shadowRoot.querySelector('[data-modal-body]');
        body.innerHTML = html`
          <div class="success-message">
            Your server has been deployed! It's now available in your servers list.
          </div>
          <div class="branding-preview">
            <div class="branding-icon">AI</div>
            <div class="branding-info">
              <div class="branding-name">${this.escapeHtml(this.projectData?.name || 'AI Server')}</div>
              <div class="branding-status">Deployed to parasharkgod</div>
            </div>
          </div>
        `;

        const actions = this.shadowRoot.querySelector('[data-modal-actions]');
        actions.innerHTML = html`
          <button type="button" class="btn-primary" data-done>Done</button>
        `;
        actions.querySelector('[data-done]').addEventListener('click', () => {
          this.close();
          document.dispatchEvent(new CustomEvent('server-updated'));
        });
      }
    } catch (error) {
      console.error('Deploy error:', error);
      alert(error.message);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

customElements.define('app-modal-ai-server-generator', AppModalAiServerGenerator);
