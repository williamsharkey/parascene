class AppRoutePosts extends HTMLElement {
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
        .route-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
      </style>
      <div class="route-header">
        <h3>Posts</h3>
        <p>This is a list of your own creations.</p>
      </div>
      <div class="route-cards" data-posts-container>
        <div class="route-empty">Loading...</div>
      </div>
    `;
    this.loadPosts();
  }

  async loadPosts() {
    const container = this.querySelector("[data-posts-container]");
    if (!container) return;

    try {
      const response = await fetch("/api/posts");
      if (!response.ok) throw new Error("Failed to load posts.");
      const data = await response.json();
      const posts = Array.isArray(data.posts) ? data.posts : [];

      container.innerHTML = "";
      if (posts.length === 0) {
        container.innerHTML = `<div class="route-empty">No posts yet.</div>`;
        return;
      }

      for (const post of posts) {
        const card = document.createElement("div");
        card.className = "route-card";
        card.innerHTML = `
          <div class="route-title">${post.title}</div>
          <div>${post.body}</div>
          <div class="route-meta">
            ${post.created_at}
            <span class="route-status">• ${post.status}</span>
          </div>
        `;
        container.appendChild(card);
      }
    } catch (error) {
      container.innerHTML = `<div class="route-empty">Unable to load posts.</div>`;
    }
  }
}

customElements.define("app-route-posts", AppRoutePosts);
