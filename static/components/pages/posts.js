class AppRoutePosts extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h3>Posts</h3>
      <p>This is a list of your own creations.</p>
    `;
  }
}

customElements.define("app-route-posts", AppRoutePosts);
