class AppRouteServers extends HTMLElement {
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
        <h3>Servers</h3>
        <p>You will find a list of servers here that you can join as well as those you have already joined.</p>
      </div>
      <div class="route-cards" data-servers-container>
        <div class="route-empty">Loading...</div>
      </div>
    `;
    this.loadServers();
  }

  async loadServers() {
    const container = this.querySelector("[data-servers-container]");
    if (!container) return;

    try {
      const response = await fetch("/api/servers");
      if (!response.ok) throw new Error("Failed to load servers.");
      const data = await response.json();
      const servers = Array.isArray(data.servers) ? data.servers : [];

      container.innerHTML = "";
      if (servers.length === 0) {
        container.innerHTML = `<div class="route-empty">No servers available.</div>`;
        return;
      }

      for (const server of servers) {
        const card = document.createElement("div");
        card.className = "route-card";
        card.innerHTML = `
          <div class="route-title">${server.name}</div>
          <div>${server.description}</div>
          <div class="route-meta">${server.region} • ${server.status}</div>
          <div class="route-meta">${server.members_count} members</div>
        `;
        container.appendChild(card);
      }
    } catch (error) {
      container.innerHTML = `<div class="route-empty">Unable to load servers.</div>`;
    }
  }
}

customElements.define("app-route-servers", AppRouteServers);
