class AppRouteFeed extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <style>
        .feed-route .route-media {
          background:
            linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(5, 199, 111, 0.2)),
            repeating-linear-gradient(
              45deg,
              rgba(255, 255, 255, 0.06) 0,
              rgba(255, 255, 255, 0.06) 6px,
              rgba(255, 255, 255, 0.02) 6px,
              rgba(255, 255, 255, 0.02) 12px
            );
        }
      </style>
      <div class="feed-route">
        <div class="route-header">
        <h3>Feed</h3>
        <p>You will find a list of creations here based on factors like popularity, recent activity, your friends, and your interests.</p>
        </div>
        <div class="route-cards route-cards-image-grid" data-feed-container>
        <div class="route-empty route-empty-image-grid">Loading...</div>
        </div>
      </div>
    `;
    this.loadFeed();
  }

  async loadFeed() {
    const container = this.querySelector("[data-feed-container]");
    if (!container) return;

    try {
      const response = await fetch("/api/feed");
      if (!response.ok) throw new Error("Failed to load feed.");
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];

      container.innerHTML = "";
      if (items.length === 0) {
        container.innerHTML = `<div class="route-empty route-empty-image-grid">No feed items yet.</div>`;
        return;
      }

      for (const item of items) {
        const card = document.createElement("div");
        card.className = "route-card route-card-image";
        card.innerHTML = `
          <div class="route-media" aria-hidden="true"></div>
          <div class="route-details">
            <div class="route-details-content">
              <div class="route-title">${item.title}</div>
              <div class="route-summary">${item.summary}</div>
              <div class="route-meta">${item.created_at}</div>
              <div class="route-meta">By ${item.author}</div>
              <div class="route-meta route-meta-spacer"></div>
              <div class="route-tags">${item.tags || ""}</div>
            </div>
          </div>
        `;
        container.appendChild(card);
      }
    } catch (error) {
      container.innerHTML = `<div class="route-empty route-empty-image-grid">Unable to load feed.</div>`;
    }
  }
}

customElements.define("app-route-feed", AppRouteFeed);
