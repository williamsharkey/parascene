class AppRouteTemplates extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .route-header {
          margin-bottom: 12px;
        }
        .route-header p {
          color: var(--text-muted);
        }
        .route-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
        }
        .route-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px;
          box-shadow: var(--shadow);
          display: grid;
          gap: 8px;
        }
        .route-title {
          font-weight: 600;
        }
        .route-meta {
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .route-empty {
          color: var(--text-muted);
        }
      </style>
      <div class="route-header">
        <h3>Templates</h3>
        <p>Templates ready to bootstrap new workspaces.</p>
      </div>
      <div class="route-cards" data-templates-container>
        <div class="route-empty">Loading...</div>
      </div>
    `;
    this.loadTemplates();
  }

  async loadTemplates() {
    const container = this.querySelector("[data-templates-container]");
    if (!container) return;

    try {
      const response = await fetch("/api/templates");
      if (!response.ok) throw new Error("Failed to load templates.");
      const data = await response.json();
      const templates = Array.isArray(data.templates) ? data.templates : [];

      container.innerHTML = "";
      if (templates.length === 0) {
        container.innerHTML = `<div class="route-empty">No templates yet.</div>`;
        return;
      }

      for (const template of templates) {
        const card = document.createElement("div");
        card.className = "route-card";
        card.innerHTML = `
          <div class="route-title">${template.name}</div>
          <div>${template.description}</div>
          <div class="route-meta">${template.category}</div>
        `;
        container.appendChild(card);
      }
    } catch (error) {
      container.innerHTML = `<div class="route-empty">Unable to load templates.</div>`;
    }
  }
}

customElements.define("app-route-templates", AppRouteTemplates);
